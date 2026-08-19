import { EventEmitter } from "node:events";
import { classifyTimeOfDay, classifyEntity, isHostile, normalizeEntityId } from "../shared/entities.ts";
import { snapshotBlock, isInteractionAllowed } from "../shared/whitelist.ts";
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
import { distance, vecKey } from "../shared/types.ts";
import type { BreakResult, ClientEvents, IMinecraftClient, MoveResult, PlaceResult } from "./BedrockClient.ts";

export interface SimulatedWorldOptions {
  spawn?: Vec3;
  timeOfDay?: number;
  inventory?: ItemStack[];
}

/**
 * Deterministic in-process Bedrock world used for tests, demos and
 * development when no real server is available.
 */
export class SimulatedClient implements IMinecraftClient {
  readonly kind = "simulated" as const;
  connected = false;
  private position: Vec3;
  private timeOfDay: number;
  private day = 0;
  private blocks = new Map<string, string>();
  private entities = new Map<string, EntitySnapshot>();
  private items: ItemStack[];
  private selectedSlot = 0;
  private yaw = 0;
  private pitch = 0;
  private readonly bus = new EventEmitter();
  private entitySeq = 1;

  constructor(opts: SimulatedWorldOptions = {}) {
    this.position = opts.spawn ?? { x: 0, y: 64, z: 0 };
    this.timeOfDay = opts.timeOfDay ?? 1000;
    this.items = opts.inventory ?? defaultInventory();
    this.seedFlatWorld();
  }

  private seedFlatWorld(): void {
    for (let x = -48; x <= 48; x++) {
      for (let z = -48; z <= 48; z++) {
        this.blocks.set(vecKey({ x, y: 63, z }), "minecraft:grass_block");
        this.blocks.set(vecKey({ x, y: 62, z }), "minecraft:dirt");
        this.blocks.set(vecKey({ x, y: 61, z }), "minecraft:stone");
      }
    }
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.bus.emit("spawn");
  }

  async disconnect(_reason: DisconnectReason): Promise<void> {
    this.connected = false;
    this.bus.emit("disconnect", _reason);
  }

  getPosition(): Vec3 {
    return { ...this.position };
  }

  getBlock(pos: Vec3): BlockSnapshot {
    const p = { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) };
    const id = this.blocks.get(vecKey(p)) ?? "minecraft:air";
    return snapshotBlock(id, p);
  }

  setBlockRaw(pos: Vec3, id: string): void {
    const p = { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) };
    if (id === "minecraft:air") this.blocks.delete(vecKey(p));
    else this.blocks.set(vecKey(p), id);
  }

  getInventory(): InventorySnapshot {
    return {
      items: this.items.map((i) => ({ ...i })),
      selectedSlot: this.selectedSlot,
      hotbar: this.items.filter((i) => i.slot >= 0 && i.slot < 9).map((i) => ({ ...i })),
    };
  }

  setSelectedSlot(slot: number): void {
    this.selectedSlot = slot;
  }

  addItem(item: ItemStack): void {
    const existing = this.items.find((i) => i.identifier === item.identifier && i.namespace === item.namespace);
    if (existing) existing.count += item.count;
    else this.items.push({ ...item });
  }

  consumeItem(identifier: string, count: number): boolean {
    const full = identifier.includes(":") ? identifier : `minecraft:${identifier}`;
    const item = this.items.find((i) => `${i.namespace}:${i.identifier}` === full);
    if (!item || item.count < count) return false;
    item.count -= count;
    if (item.count <= 0) this.items = this.items.filter((i) => i !== item);
    return true;
  }

  async moveStep(next: Vec3): Promise<MoveResult> {
    if (!this.connected) return { ok: false, path: [], reason: "not_connected" };
    const feet = this.getBlock(next);
    const head = this.getBlock({ x: next.x, y: next.y + 1, z: next.z });
    const below = this.getBlock({ x: next.x, y: next.y - 1, z: next.z });
    if (feet.hazard === "lava" || head.hazard === "lava") {
      return { ok: false, path: [], reason: "lava" };
    }
    if (feet.solid || head.solid) return { ok: false, path: [], reason: "blocked" };
    if (!below.solid && below.identifier !== "water") {
      return { ok: false, path: [], reason: "no_footing" };
    }
    this.position = { ...next };
    return { ok: true, path: [next] };
  }

  async placeBlock(
    pos: Vec3,
    item: string,
    _states?: Record<string, string | number | boolean>,
  ): Promise<PlaceResult> {
    if (!this.connected) return { ok: false, reason: "not_connected" };
    if (!isInteractionAllowed(item, "block")) return { ok: false, reason: "not_whitelisted" };
    const target = this.getBlock(pos);
    if (target.solid) return { ok: false, reason: "occupied" };
    if (!this.consumeItem(item, 1)) return { ok: false, reason: "missing_item" };
    const full = item.includes(":") ? item : `minecraft:${item}`;
    this.setBlockRaw(pos, full);
    return { ok: true };
  }

  async breakBlock(pos: Vec3): Promise<BreakResult> {
    if (!this.connected) return { ok: false, reason: "not_connected" };
    const target = this.getBlock(pos);
    if (!target.vanilla || !target.whitelisted) return { ok: false, reason: "not_whitelisted" };
    if (target.identifier === "air") return { ok: false, reason: "air" };
    if (target.identifier === "bedrock") return { ok: false, reason: "unbreakable" };
    this.setBlockRaw(pos, "minecraft:air");
    return { ok: true };
  }

  getEntities(radius: number): EntitySnapshot[] {
    const me = this.position;
    return [...this.entities.values()]
      .map((e) => ({ ...e, distance: distance(me, e.position) }))
      .filter((e) => e.distance <= radius);
  }

  getTime(): TimeSnapshot {
    const { phase, safeToBuild } = classifyTimeOfDay(this.timeOfDay);
    return { timeOfDay: this.timeOfDay, day: this.day, phase, safeToBuild };
  }

  setTime(timeOfDay: number): void {
    this.timeOfDay = timeOfDay;
    this.bus.emit("time", this.getTime());
  }

  advanceTime(delta: number): void {
    this.timeOfDay += delta;
    if (this.timeOfDay >= 24000) {
      this.timeOfDay -= 24000;
      this.day += 1;
    }
    this.bus.emit("time", this.getTime());
  }

  getWorldState(): WorldSnapshot {
    const sample: BlockSnapshot[] = [];
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -1; dy <= 2; dy++) {
        for (let dz = -2; dz <= 2; dz++) {
          sample.push(this.getBlock({ x: this.position.x + dx, y: this.position.y + dy, z: this.position.z + dz }));
        }
      }
    }
    return {
      dimension: "overworld",
      time: this.getTime(),
      position: this.getPosition(),
      nearbyEntities: this.getEntities(48),
      sampleBlocks: sample,
    };
  }

  lookAt(pos: Vec3): void {
    const dx = pos.x - this.position.x;
    const dz = pos.z - this.position.z;
    this.yaw = Math.atan2(-dx, dz);
    this.pitch = Math.atan2(-(pos.y - this.position.y), Math.hypot(dx, dz));
  }

  async screenshot(): Promise<{ path: string; note: string }> {
    return { path: "", note: "simulated client has no framebuffer" };
  }

  async ping(): Promise<{ online: boolean; motd?: string; version?: string }> {
    return { online: true, motd: "Simulated Bedrock world", version: "simulated" };
  }

  injectEntity(partial: Omit<EntitySnapshot, "hostile" | "classification" | "distance" | "namespace" | "identifier"> & Partial<EntitySnapshot>): void {
    const typeId = normalizeEntityId(partial.typeId);
    const [namespace, identifier] = typeId.split(":");
    const classification = classifyEntity(typeId);
    const entity: EntitySnapshot = {
      runtimeId: partial.runtimeId || `sim-${this.entitySeq++}`,
      typeId,
      namespace,
      identifier,
      position: { ...partial.position },
      hostile: isHostile(typeId),
      classification,
      distance: distance(this.position, partial.position),
    };
    this.entities.set(entity.runtimeId, entity);
    this.bus.emit("entity", entity);
  }

  removeEntity(runtimeId: string): void {
    this.entities.delete(runtimeId);
  }

  on<K extends keyof ClientEvents>(event: K, listener: ClientEvents[K]): void {
    this.bus.on(event, listener);
  }

  off<K extends keyof ClientEvents>(event: K, listener: ClientEvents[K]): void {
    this.bus.off(event, listener);
  }
}

function defaultInventory(): ItemStack[] {
  const stacks: Array<[string, number]> = [
    ["stone_bricks", 64],
    ["stone_bricks", 64],
    ["stone_bricks", 64],
    ["oak_planks", 64],
    ["spruce_planks", 64],
    ["glass", 64],
    ["oak_door", 16],
    ["torch", 64],
    ["oak_stairs", 64],
    ["cobblestone", 64],
    ["stone_pickaxe", 1],
    ["stone_axe", 1],
    ["stone_shovel", 1],
    ["bread", 16],
  ];
  return stacks.map(([id, count], slot) => ({
    namespace: "minecraft",
    identifier: id,
    count,
    slot,
    durability: id.endsWith("pickaxe") || id.endsWith("axe") || id.endsWith("shovel") ? 120 : undefined,
    maxDurability: id.endsWith("pickaxe") || id.endsWith("axe") || id.endsWith("shovel") ? 132 : undefined,
  }));
}
