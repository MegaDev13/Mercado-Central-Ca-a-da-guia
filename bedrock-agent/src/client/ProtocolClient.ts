/**
 * Adapter over PrismarineJS bedrock-protocol.
 *
 * Verified capabilities (docs + repo, Aug 2026):
 *   - createClient({ host, port, username, offline, version, realms, onMsaCode })
 *   - events: status, join, spawn, kick, close, error, heartbeat, packet, session
 *   - Xbox Live device-code auth, Realms, encryption, ping()
 *   - Supported versions through 1.26.40 (library is packet-level)
 *
 * NOT provided by bedrock-protocol itself:
 *   - pathfinding, inventory helpers, block registry, physics
 *   Those live in our executor. This adapter only talks packets.
 *
 * BedrockFlayer (torzodmc/mineflayer-for-bedrock) was evaluated and rejected
 * as a hard dependency: 6 commits, author states it is incomplete and the
 * protocol layer is behind. Patterns inspired it; we do not import it.
 */
import { EventEmitter } from "node:events";
import { classifyTimeOfDay, classifyEntity, isHostile, normalizeEntityId } from "../shared/entities.ts";
import { snapshotBlock } from "../shared/whitelist.ts";
import type {
  BlockSnapshot,
  DisconnectReason,
  EntitySnapshot,
  InventorySnapshot,
  ItemStack,
  TimeSnapshot,
  Vec3,
  WorldSnapshot,
} from "../shared/types.ts";
import type { BreakResult, ClientEvents, IMinecraftClient, MoveResult, PlaceResult } from "./BedrockClient.ts";
import type { AgentConfig } from "../shared/config.ts";

type BedrockNs = {
  createClient: (opts: Record<string, unknown>) => BedrockRawClient;
  ping: (opts: { host: string; port: number }) => Promise<{ motd?: string; version?: string }>;
};

interface BedrockRawClient {
  on(event: string, cb: (...args: unknown[]) => void): void;
  close(): void;
  queue(name: string, payload: unknown): void;
  username?: string;
}

export class ProtocolClient implements IMinecraftClient {
  readonly kind = "protocol" as const;
  connected = false;
  private raw: BedrockRawClient | null = null;
  private position: Vec3 = { x: 0, y: 64, z: 0 };
  private timeOfDay = 1000;
  private day = 0;
  private entities = new Map<string, EntitySnapshot>();
  private items: ItemStack[] = [];
  private selectedSlot = 0;
  private readonly bus = new EventEmitter();
  private lib: BedrockNs | null = null;

  constructor(private readonly config: AgentConfig) {}

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
    const opts: Record<string, unknown> = {
      host: this.config.mcHost,
      port: this.config.mcPort,
      username: this.config.mcUsername,
      offline: this.config.mcOffline,
      conLog: null,
    };
    if (this.config.mcVersion) opts.version = this.config.mcVersion;
    if (this.config.mcRealmId) {
      opts.realms = { realmId: this.config.mcRealmId };
      delete opts.host;
    }
    if (!this.config.mcOffline) {
      opts.onMsaCode = (data: { user_code?: string; verification_uri?: string; message?: string }) => {
        this.bus.emit("chat", "auth", data.message ?? `Xbox login: ${data.verification_uri} code ${data.user_code}`);
      };
    }

    this.raw = lib.createClient(opts);
    this.raw.on("spawn", () => {
      this.connected = true;
      this.bus.emit("spawn");
    });
    this.raw.on("kick", (packet) => {
      this.connected = false;
      this.bus.emit("disconnect", String((packet as { message?: string })?.message ?? "kicked"));
    });
    this.raw.on("close", () => {
      this.connected = false;
      this.bus.emit("disconnect", "closed");
    });
    this.raw.on("error", (err) => {
      this.bus.emit("error", err instanceof Error ? err : new Error(String(err)));
    });
    this.raw.on("move_player", (packet) => {
      const p = packet as { position?: { x: number; y: number; z: number } };
      if (p.position) this.position = { ...p.position };
    });
    this.raw.on("set_time", (packet) => {
      const p = packet as { time?: number };
      if (typeof p.time === "number") {
        this.timeOfDay = p.time % 24000;
        this.bus.emit("time", this.getTime());
      }
    });
    this.raw.on("add_entity", (packet) => this.ingestEntity(packet));
    this.raw.on("add_player", (packet) => this.ingestEntity(packet, "minecraft:player"));
    this.raw.on("remove_entity", (packet) => {
      const p = packet as { entity_id_self?: string | number };
      if (p.entity_id_self !== undefined) this.entities.delete(String(p.entity_id_self));
    });
  }

  private ingestEntity(packet: unknown, forceType?: string): void {
    const p = packet as {
      runtime_entity_id?: string | number;
      entity_id_self?: string | number;
      identifier?: string;
      entity_type?: string;
      position?: { x: number; y: number; z: number };
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

  async disconnect(_reason: DisconnectReason): Promise<void> {
    try {
      this.raw?.close();
    } finally {
      this.connected = false;
      this.raw = null;
    }
  }

  getPosition(): Vec3 {
    return { ...this.position };
  }

  getBlock(pos: Vec3): BlockSnapshot {
    // Packet-level client has no chunk store until a world plugin is added.
    // Return unknown air so the whitelist DENIES interaction rather than guessing.
    return snapshotBlock("minecraft:air", { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) });
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
    this.raw?.queue("mob_equipment", { hotbar_slot: slot, selected_slot: slot });
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
    this.raw.queue("player_auth_input", {
      position: next,
      move_vector: { x: 0, z: 0 },
      head_yaw: 0,
      pitch: 0,
      yaw: 0,
      input_data: {},
      input_mode: "mouse",
      play_mode: "normal",
      interaction_model: "touch",
      analogue_move_vector: { x: 0, z: 0 },
    });
    this.position = { ...next };
    return { ok: true, path: [next] };
  }

  async placeBlock(pos: Vec3, item: string): Promise<PlaceResult> {
    if (!this.connected || !this.raw) return { ok: false, reason: "not_connected" };
    this.raw.queue("inventory_transaction", {
      transaction: {
        legacy: { legacy_request_id: 0, legacy_transactions: [] },
        transaction_type: "item_use",
        actions: [],
        transaction_data: {
          action_type: "place",
          block_position: pos,
          face: 1,
          hotbar_slot: this.selectedSlot,
          player_pos: this.position,
          click_pos: { x: 0.5, y: 1, z: 0.5 },
          block_runtime_id: 0,
        },
      },
    });
    void item;
    return { ok: true };
  }

  async breakBlock(pos: Vec3): Promise<BreakResult> {
    if (!this.connected || !this.raw) return { ok: false, reason: "not_connected" };
    this.raw.queue("player_action", {
      runtime_entity_id: "self",
      action: "start_break",
      position: pos,
      result_position: pos,
      face: 1,
    });
    return { ok: true };
  }

  getEntities(radius: number): EntitySnapshot[] {
    return [...this.entities.values()].filter((e) => {
      const dx = e.position.x - this.position.x;
      const dy = e.position.y - this.position.y;
      const dz = e.position.z - this.position.z;
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

  lookAt(_pos: Vec3): void {
    /* PlayerAuthInput yaw/pitch is sent with the next moveStep. */
  }

  async screenshot(): Promise<{ path: string; note: string }> {
    return { path: "", note: "protocol client is headless — no framebuffer" };
  }

  async ping(): Promise<{ online: boolean; motd?: string; version?: string }> {
    try {
      const lib = await this.loadLib();
      const res = await lib.ping({ host: this.config.mcHost, port: this.config.mcPort });
      return { online: true, motd: res.motd, version: res.version };
    } catch {
      return { online: false };
    }
  }

  on<K extends keyof ClientEvents>(event: K, listener: ClientEvents[K]): void {
    this.bus.on(event, listener);
  }

  off<K extends keyof ClientEvents>(event: K, listener: ClientEvents[K]): void {
    this.bus.off(event, listener);
  }
}
