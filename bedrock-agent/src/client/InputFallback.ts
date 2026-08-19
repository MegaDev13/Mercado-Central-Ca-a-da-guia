/**
 * Keyboard / mouse fallback.
 *
 * Explicitly NOT the primary control path. Used only when the protocol
 * client cannot perform an action (e.g. a server plugin that rejects
 * headless clients). Implementation is a no-op stub so the cloud cannot
 * accidentally drive OS input.
 */
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
import { snapshotBlock } from "../shared/whitelist.ts";
import { classifyTimeOfDay } from "../shared/entities.ts";
import type { BreakResult, ClientEvents, IMinecraftClient, MoveResult, PlaceResult } from "./BedrockClient.ts";

export class InputFallbackClient implements IMinecraftClient {
  readonly kind = "fallback" as const;
  connected = false;

  async connect(): Promise<void> {
    throw new Error("Input fallback is disabled by default. Protocol client is mandatory.");
  }
  async disconnect(_reason: DisconnectReason): Promise<void> {
    this.connected = false;
  }
  getPosition(): Vec3 {
    return { x: 0, y: 0, z: 0 };
  }
  getLook(): LookState {
    return { yaw: 0, pitch: 0 };
  }
  getPositionState(): PositionState {
    return {
      predicted: { x: 0, y: 0, z: 0 },
      server: null,
      source: "unknown",
      desync: 0,
      desyncing: false,
      updatedAt: 0,
    };
  }
  getVisibleBlocks(): VisibleBlock[] {
    return [];
  }
  resyncFromServer(): Vec3 {
    return this.getPosition();
  }
  getBlock(pos: Vec3): BlockSnapshot {
    return snapshotBlock("minecraft:air", pos);
  }
  getInventory(): InventorySnapshot {
    return { items: [], selectedSlot: 0, hotbar: [] };
  }
  setSelectedSlot(): void {}
  addItem(_item: ItemStack): void {}
  consumeItem(): boolean {
    return false;
  }
  async moveStep(): Promise<MoveResult> {
    return { ok: false, path: [], reason: "fallback_disabled" };
  }
  async placeBlock(): Promise<PlaceResult> {
    return { ok: false, reason: "fallback_disabled" };
  }
  async breakBlock(): Promise<BreakResult> {
    return { ok: false, reason: "fallback_disabled" };
  }
  getEntities(): EntitySnapshot[] {
    return [];
  }
  getTime(): TimeSnapshot {
    const { phase, safeToBuild } = classifyTimeOfDay(0);
    return { timeOfDay: 0, day: 0, phase, safeToBuild };
  }
  setTime(): void {}
  getWorldState(): WorldSnapshot {
    return {
      dimension: "unknown",
      time: this.getTime(),
      position: this.getPosition(),
      nearbyEntities: [],
      sampleBlocks: [],
    };
  }
  lookAt(): void {}
  async screenshot(): Promise<{ path: string; note: string }> {
    return { path: "", note: "fallback disabled" };
  }
  async ping(): Promise<{ online: boolean }> {
    return { online: false };
  }
  on(_e: keyof ClientEvents, _l: ClientEvents[keyof ClientEvents]): void {}
  off(_e: keyof ClientEvents, _l: ClientEvents[keyof ClientEvents]): void {}
}
