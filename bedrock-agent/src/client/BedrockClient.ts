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

export interface MoveResult {
  ok: boolean;
  path: Vec3[];
  reason?: string;
}

export interface PlaceResult {
  ok: boolean;
  reason?: string;
}

export interface BreakResult {
  ok: boolean;
  reason?: string;
}

export interface ClientEvents {
  spawn: () => void;
  disconnect: (reason: string) => void;
  error: (err: Error) => void;
  entity: (entity: EntitySnapshot) => void;
  time: (time: TimeSnapshot) => void;
  chat: (from: string, message: string) => void;
}

export interface IMinecraftClient {
  readonly kind: "simulated" | "protocol" | "fallback";
  readonly connected: boolean;
  connect(): Promise<void>;
  disconnect(reason: DisconnectReason): Promise<void>;
  getPosition(): Vec3;
  getBlock(pos: Vec3): BlockSnapshot;
  getInventory(): InventorySnapshot;
  setSelectedSlot(slot: number): void;
  addItem(item: ItemStack): void;
  consumeItem(identifier: string, count: number): boolean;
  moveStep(next: Vec3): Promise<MoveResult>;
  placeBlock(pos: Vec3, item: string, states?: Record<string, string | number | boolean>): Promise<PlaceResult>;
  breakBlock(pos: Vec3): Promise<BreakResult>;
  getEntities(radius: number): EntitySnapshot[];
  getTime(): TimeSnapshot;
  setTime(timeOfDay: number): void;
  getWorldState(): WorldSnapshot;
  lookAt(pos: Vec3): void;
  screenshot(): Promise<{ path: string; note: string }>;
  ping(): Promise<{ online: boolean; motd?: string; version?: string }>;
  injectEntity?(entity: EntitySnapshot): void;
  removeEntity?(runtimeId: string): void;
  on<K extends keyof ClientEvents>(event: K, listener: ClientEvents[K]): void;
  off<K extends keyof ClientEvents>(event: K, listener: ClientEvents[K]): void;
}
