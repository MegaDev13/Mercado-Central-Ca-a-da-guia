/**
 * Adapter over PrismarineJS bedrock-protocol.
 *
 * Position: ONLY from movement/spawn packets (start_game, move_player,
 * correct_player_move_prediction, player_auth_input echo). Never from
 * /tp, /gamerule, showcoordinates or any command_request.
 *
 * Realms: createClient({ realms: { realmId | realmInvite | pickRealm } }).
 * Host/port are omitted when a Realm is selected — the library resolves them.
 */
import { EventEmitter } from "node:events";
import { classifyTimeOfDay, classifyEntity, isHostile, normalizeEntityId } from "../shared/entities.ts";
import { snapshotBlock, isInteractionAllowed } from "../shared/whitelist.ts";
import type {
  BlockSnapshot,
  DisconnectReason,
  EntitySnapshot,
  InventorySnapshot,
  ItemStack,
  LookState,
  PositionState,
  TimeSnapshot,
  Vec3,
  VisibleBlock,
  WorldSnapshot,
} from "../shared/types.ts";
import type { BreakResult, ClientEvents, IMinecraftClient, MoveResult, PlaceResult } from "./BedrockClient.ts";
import type { AgentConfig } from "../shared/config.ts";
import { isForbiddenCommand, PositionTracker } from "./PositionTracker.ts";
import { vecKey } from "../shared/types.ts";

export interface LiveDestination {
  mode: "server" | "realm" | "simulated";
  host: string;
  port: number;
  realmId: string;
  realmInvite: string;
  offline: boolean;
  username: string;
  version: string;
  profilesFolder: string;
}

type BedrockNs = {
  createClient: (opts: Record<string, unknown>) => BedrockRawClient;
  ping: (opts: { host: string; port: number }) => Promise<{ motd?: string; version?: string }>;
};

interface BedrockRawClient {
  on(event: string, cb: (...args: unknown[]) => void): void;
  close(): void;
  queue(name: string, payload: unknown): void;
  username?: string;
  profile?: { name?: string; xuid?: string };
}

export class ProtocolClient implements IMinecraftClient {
  readonly kind = "protocol" as const;
  connected = false;
  private raw: BedrockRawClient | null = null;
  private readonly tracker = new PositionTracker();
  private yaw = 0;
  private pitch = 0;
  private timeOfDay = 1000;
  private day = 0;
  private entities = new Map<string, EntitySnapshot>();
  private knownBlocks = new Map<string, string>();
  private items: ItemStack[] = [];
  private selectedSlot = 0;
  private readonly bus = new EventEmitter();
  private lib: BedrockNs | null = null;
  onMsaCode: ((data: { user_code?: string; verification_uri?: string; message?: string }) => void) | null = null;

  constructor(
    private readonly config: AgentConfig,
    private readonly destFn?: () => LiveDestination,
  ) {}

  private dest(): LiveDestination {
    return (
      this.destFn?.() ?? {
        mode: this.config.mcRealmId ? "realm" : "server",
        host: this.config.mcHost,
        port: this.config.mcPort,
        realmId: this.config.mcRealmId,
        realmInvite: this.config.mcRealmInvite,
        offline: this.config.mcOffline,
        username: this.config.mcUsername,
        version: this.config.mcVersion,
        profilesFolder: this.config.profilesDir,
      }
    );
  }

  private async loadLib(): Promise<BedrockNs> {
    if (this.lib) return this.lib;
    try {
      const mod = (await import("bedrock-protocol")) as unknown as BedrockNs;
      this.lib = mod;
      return mod;
    } catch (err) {
      throw new Error(
        "bedrock-protocol is not installed. Run `npm i bedrock-protocol` in bedrock-agent/ or keep MC_CLIENT=simulated.",
        { cause: err },
      );
    }
  }

  async connect(): Promise<void> {
    const lib = await this.loadLib();
    const d = this.dest();
    const opts: Record<string, unknown> = {
      username: d.username,
      offline: d.offline,
      conLog: null,
      profilesFolder: d.profilesFolder,
    };
    if (d.version) opts.version = d.version;
    if (d.mode === "realm" && (d.realmId || d.realmInvite)) {
      opts.realms = d.realmId ? { realmId: d.realmId } : { realmInvite: d.realmInvite };
    } else {
      opts.host = d.host;
      opts.port = d.port;
    }
    if (!d.offline) {
      opts.onMsaCode = (data: { user_code?: string; verification_uri?: string; message?: string }) => {
        this.onMsaCode?.(data);
        this.bus.emit("chat", "auth", data.message ?? `Xbox: ${data.verification_uri} code ${data.user_code}`);
      };
    }

    this.raw = lib.createClient(opts);
    this.bindPackets(this.raw);
  }

  private bindPackets(raw: BedrockRawClient): void {
    raw.on("spawn", () => {
      this.connected = true;
      this.bus.emit("spawn");
    });
    raw.on("kick", (packet) => {
      this.connected = false;
      this.bus.emit("disconnect", String((packet as { message?: string })?.message ?? "kicked"));
    });
    raw.on("close", () => {
      this.connected = false;
      this.bus.emit("disconnect", "closed");
    });
    raw.on("error", (err) => {
      this.bus.emit("error", err instanceof Error ? err : new Error(String(err)));
    });
    raw.on("start_game", (packet) => {
      const p = packet as { player_position?: Vec3; position?: Vec3 };
      const pos = p.player_position ?? p.position;
      if (pos) this.tracker.acceptServer(pos, "spawn");
    });
    raw.on("move_player", (packet) => this.ingestMove(packet));
    raw.on("correct_player_move_prediction", (packet) => this.ingestMove(packet));
    raw.on("set_entity_motion", (packet) => this.ingestMove(packet));
    raw.on("set_time", (packet) => {
      const p = packet as { time?: number };
      if (typeof p.time === "number") {
        this.timeOfDay = p.time % 24000;
        this.bus.emit("time", this.getTime());
      }
    });
    raw.on("add_entity", (packet) => this.ingestEntity(packet));
    raw.on("add_player", (packet) => this.ingestEntity(packet, "minecraft:player"));
    raw.on("remove_entity", (packet) => {
      const p = packet as { entity_id_self?: string | number };
      if (p.entity_id_self !== undefined) this.entities.delete(String(p.entity_id_self));
    });
    raw.on("inventory_content", (packet) => this.ingestInventory(packet));
    raw.on("inventory_slot", (packet) => this.ingestSlot(packet));
    raw.on("update_block", (packet) => {
      const p = packet as { position?: Vec3; block_runtime_id?: number };
      if (p.position) this.knownBlocks.set(vecKey(floor(p.position)), "minecraft:unknown_runtime");
    });
  }

  private ingestMove(packet: unknown): void {
    const p = packet as { position?: Vec3; pos?: Vec3; yaw?: number; pitch?: number };
    const pos = p.position ?? p.pos;
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) return;
    this.tracker.acceptServer(pos, "protocol");
    if (typeof p.yaw === "number") this.yaw = p.yaw;
    if (typeof p.pitch === "number") this.pitch = p.pitch;
  }

  private ingestInventory(packet: unknown): void {
    const p = packet as { input?: Array<{ network_id?: number; count?: number; extra?: { identifier?: string } }> };
    if (!Array.isArray(p.input)) return;
    this.items = p.input
      .map((it, slot) => {
        const id = it.extra?.identifier ?? "";
        if (!id) return null;
        const [namespace, identifier] = id.includes(":") ? id.split(":") : ["minecraft", id];
        return { namespace, identifier, count: it.count ?? 1, slot } satisfies ItemStack;
      })
      .filter((x): x is ItemStack => !!x);
  }

  private ingestSlot(packet: unknown): void {
    const p = packet as { slot?: number; item?: { extra?: { identifier?: string }; count?: number } };
    if (p.slot === undefined || !p.item?.extra?.identifier) return;
    const id = p.item.extra.identifier;
    const [namespace, identifier] = id.includes(":") ? id.split(":") : ["minecraft", id];
    const existing = this.items.find((i) => i.slot === p.slot);
    if (existing) {
      existing.identifier = identifier;
      existing.namespace = namespace;
      existing.count = p.item.count ?? 1;
    } else {
      this.items.push({ namespace, identifier, count: p.item.count ?? 1, slot: p.slot });
    }
  }

  private ingestEntity(packet: unknown, forceType?: string): void {
    const p = packet as {
      runtime_entity_id?: string | number;
      entity_id_self?: string | number;
      identifier?: string;
      entity_type?: string;
      position?: Vec3;
    };
    const typeId = normalizeEntityId(forceType ?? p.identifier ?? p.entity_type ?? "unknown");
    const [namespace, identifier] = typeId.split(":");
    const position = p.position ?? { x: 0, y: 0, z: 0 };
    const runtimeId = String(p.runtime_entity_id ?? p.entity_id_self ?? `${typeId}:${position.x}:${position.z}`);
    const entity: EntitySnapshot = {
      runtimeId,
      typeId,
      namespace,
      identifier,
      position,
      hostile: isHostile(typeId),
      classification: classifyEntity(typeId),
      distance: 0,
    };
    this.entities.set(runtimeId, entity);
    this.bus.emit("entity", entity);
  }

  /** Hard deny: the protocol client never emits command_request. */
  queueSafe(name: string, payload: unknown): void {
    if (name === "command_request" || name === "command") {
      throw new Error("ADMIN_COMMAND_DENIED: the agent never sends slash commands");
    }
    if (typeof payload === "object" && payload && "command" in (payload as Record<string, unknown>)) {
      const cmd = String((payload as { command?: string }).command ?? "");
      if (isForbiddenCommand(cmd)) {
        throw new Error(`ADMIN_COMMAND_DENIED: ${cmd}`);
      }
    }
    this.raw?.queue(name, payload);
  }

  async disconnect(_reason: DisconnectReason): Promise<void> {
    try {
      this.raw?.close();
    } finally {
      this.connected = false;
      this.raw = null;
    }
  }

  getPosition(): Vec3 {
    return { ...this.tracker.predicted };
  }

  getLook(): LookState {
    return { yaw: this.yaw, pitch: this.pitch };
  }

  getPositionState(): PositionState {
    return this.tracker.snapshot();
  }

  resyncFromServer(): Vec3 {
    return this.tracker.resync();
  }

  getVisibleBlocks(radius: number, limit = 4000): VisibleBlock[] {
    const me = this.tracker.predicted;
    const out: VisibleBlock[] = [];
    for (const [key, id] of this.knownBlocks) {
      const [x, y, z] = key.split(",").map(Number);
      if (Math.abs(x - me.x) > radius || Math.abs(z - me.z) > radius || Math.abs(y - me.y) > radius) continue;
      out.push({ x, y, z, id });
    }
    out.sort((a, b) => Math.abs(a.x - me.x) + Math.abs(a.z - me.z) - (Math.abs(b.x - me.x) + Math.abs(b.z - me.z)));
    return out.slice(0, limit);
  }

  getBlock(pos: Vec3): BlockSnapshot {
    const p = floor(pos);
    const id = this.knownBlocks.get(vecKey(p)) ?? "minecraft:air";
    return snapshotBlock(id === "minecraft:unknown_runtime" ? "minecraft:air" : id, p);
  }

  getInventory(): InventorySnapshot {
    return {
      items: this.items.map((i) => ({ ...i })),
      selectedSlot: this.selectedSlot,
      hotbar: this.items.filter((i) => i.slot >= 0 && i.slot < 9),
    };
  }

  setSelectedSlot(slot: number): void {
    this.selectedSlot = slot;
    this.queueSafe("mob_equipment", { hotbar_slot: slot, selected_slot: slot });
  }

  addItem(item: ItemStack): void {
    this.items.push(item);
  }

  consumeItem(identifier: string, count: number): boolean {
    const full = identifier.includes(":") ? identifier : `minecraft:${identifier}`;
    const item = this.items.find((i) => `${i.namespace}:${i.identifier}` === full);
    if (!item || item.count < count) return false;
    item.count -= count;
    return true;
  }

  async moveStep(next: Vec3): Promise<MoveResult> {
    if (!this.connected || !this.raw) return { ok: false, path: [], reason: "not_connected" };
    this.queueSafe("player_auth_input", {
      position: next,
      move_vector: { x: 0, z: 0 },
      head_yaw: this.yaw,
      pitch: this.pitch,
      yaw: this.yaw,
      input_data: {},
      input_mode: "mouse",
      play_mode: "normal",
      interaction_model: "touch",
      analogue_move_vector: { x: 0, z: 0 },
    });
    this.tracker.predict(next);
    return { ok: true, path: [next] };
  }

  async placeBlock(pos: Vec3, item: string): Promise<PlaceResult> {
    if (!this.connected || !this.raw) return { ok: false, reason: "not_connected" };
    if (!isInteractionAllowed(item, "block")) return { ok: false, reason: "not_whitelisted" };
    this.queueSafe("inventory_transaction", {
      transaction: {
        legacy: { legacy_request_id: 0, legacy_transactions: [] },
        transaction_type: "item_use",
        actions: [],
        transaction_data: {
          action_type: "place",
          block_position: pos,
          face: 1,
          hotbar_slot: this.selectedSlot,
          player_pos: this.tracker.predicted,
          click_pos: { x: 0.5, y: 1, z: 0.5 },
          block_runtime_id: 0,
        },
      },
    });
    const full = item.includes(":") ? item : `minecraft:${item}`;
    this.knownBlocks.set(vecKey(floor(pos)), full);
    return { ok: true };
  }

  async breakBlock(pos: Vec3): Promise<BreakResult> {
    if (!this.connected || !this.raw) return { ok: false, reason: "not_connected" };
    const target = this.getBlock(pos);
    if (target.identifier !== "air" && !target.whitelisted) return { ok: false, reason: "not_whitelisted" };
    this.queueSafe("player_action", {
      runtime_entity_id: "self",
      action: "start_break",
      position: pos,
      result_position: pos,
      face: 1,
    });
    this.knownBlocks.delete(vecKey(floor(pos)));
    return { ok: true };
  }

  getEntities(radius: number): EntitySnapshot[] {
    const me = this.tracker.predicted;
    return [...this.entities.values()].filter((e) => {
      const dx = e.position.x - me.x;
      const dy = e.position.y - me.y;
      const dz = e.position.z - me.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz) <= radius;
    });
  }

  getTime(): TimeSnapshot {
    const { phase, safeToBuild } = classifyTimeOfDay(this.timeOfDay);
    return { timeOfDay: this.timeOfDay, day: this.day, phase, safeToBuild };
  }

  setTime(timeOfDay: number): void {
    this.timeOfDay = timeOfDay;
  }

  getWorldState(): WorldSnapshot {
    return {
      dimension: "overworld",
      time: this.getTime(),
      position: this.getPosition(),
      nearbyEntities: this.getEntities(48),
      sampleBlocks: [],
    };
  }

  lookAt(pos: Vec3): void {
    const me = this.tracker.predicted;
    const dx = pos.x - me.x;
    const dz = pos.z - me.z;
    this.yaw = Math.atan2(-dx, dz);
    this.pitch = Math.atan2(-(pos.y - me.y), Math.hypot(dx, dz));
  }

  async screenshot(): Promise<{ path: string; note: string }> {
    return { path: "", note: "protocol client is headless — no framebuffer" };
  }

  async ping(): Promise<{ online: boolean; motd?: string; version?: string; rttMs?: number }> {
    const d = this.dest();
    if (d.mode === "realm") return { online: this.connected, motd: "realm" };
    const t0 = Date.now();
    try {
      const lib = await this.loadLib();
      const res = await lib.ping({ host: d.host, port: d.port });
      return { online: true, motd: res.motd, version: res.version, rttMs: Date.now() - t0 };
    } catch {
      return { online: false, rttMs: Date.now() - t0 };
    }
  }

  on<K extends keyof ClientEvents>(event: K, listener: ClientEvents[K]): void {
    this.bus.on(event, listener);
  }

  off<K extends keyof ClientEvents>(event: K, listener: ClientEvents[K]): void {
    this.bus.off(event, listener);
  }
}

function floor(pos: Vec3): Vec3 {
  return { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) };
}
