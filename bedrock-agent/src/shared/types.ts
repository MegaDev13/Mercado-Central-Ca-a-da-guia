export type Vec3 = { x: number; y: number; z: number };

export type AgentStatus =
  | "BOOTING"
  | "IDLE"
  | "CONNECTING"
  | "ONLINE"
  | "BUILDING"
  | "SAFE_WAIT"
  | "RESOURCE_WAIT"
  | "NIGHT"
  | "HOSTILE_MOB"
  | "ERROR"
  | "RECONNECTING"
  | "PAUSED"
  | "COMPLETED";

export type ThreatLevel = "SAFE" | "HOSTILE_DETECTED" | "UNKNOWN";
export type ResourceHealth = "OK" | "INSUFFICIENT" | "UNKNOWN";
export type LinkState = "ONLINE" | "OFFLINE" | "DEGRADED";

export type DisconnectReason =
  | "NIGHT"
  | "HOSTILE_MOB"
  | "CREEPER"
  | "RESOURCE_SHORTAGE"
  | "CRITICAL_ERROR"
  | "CONNECTION_LOSS"
  | "USER_REQUEST"
  | "SAFE_SHUTDOWN"
  | "CLOUD_LOST_AT_LIMIT"
  | "ENVIRONMENTAL_HAZARD"
  | "EMERGENCY"
  | "POSITION_DESYNC";

export type Severity = "INFO" | "WARNING" | "RECOVERABLE_ERROR" | "CRITICAL_ERROR";

export const PRIORITY = {
  CRITICAL_FAILURE: 0,
  HOSTILE_MOB: 1,
  NIGHT: 2,
  ENVIRONMENTAL_HAZARD: 3,
  RESOURCE_SHORTAGE: 4,
  EXECUTION_ERROR: 5,
  BUILDING: 6,
} as const;

export type PriorityLevel = (typeof PRIORITY)[keyof typeof PRIORITY];

export type ProtocolName =
  | "PROTOCOL_CONNECTION"
  | "PROTOCOL_MOVEMENT"
  | "PROTOCOL_PATHFINDING"
  | "PROTOCOL_BLOCK_INTERACTION"
  | "PROTOCOL_BUILDING"
  | "PROTOCOL_BLUEPRINT"
  | "PROTOCOL_RESOURCE_MANAGEMENT"
  | "PROTOCOL_INVENTORY"
  | "PROTOCOL_TOOL_SELECTION"
  | "PROTOCOL_ENTITY_DETECTION"
  | "PROTOCOL_HOSTILE_MOB_DETECTION"
  | "PROTOCOL_HOSTILE_MOB_EXIT"
  | "PROTOCOL_DAY_NIGHT"
  | "PROTOCOL_NIGHT_EXIT"
  | "PROTOCOL_SAFE_WAIT"
  | "PROTOCOL_RECONNECTION"
  | "PROTOCOL_ERROR_RECOVERY"
  | "PROTOCOL_BUILD_VALIDATION"
  | "PROTOCOL_PROGRESS_TRACKING"
  | "PROTOCOL_MISSION_STATE"
  | "PROTOCOL_POSITION";

export interface BlockRef {
  namespace: string;
  identifier: string;
  states?: Record<string, string | number | boolean>;
}

export interface BlockSnapshot extends BlockRef {
  position: Vec3;
  vanilla: boolean;
  whitelisted: boolean;
  solid: boolean;
  hazard: "none" | "lava" | "fire" | "cactus" | "void" | "water" | "unknown";
}

export interface ItemStack {
  namespace: string;
  identifier: string;
  count: number;
  slot: number;
  durability?: number;
  maxDurability?: number;
}

export interface InventorySnapshot {
  items: ItemStack[];
  selectedSlot: number;
  hotbar: ItemStack[];
}

export interface EntitySnapshot {
  runtimeId: string;
  typeId: string;
  namespace: string;
  identifier: string;
  position: Vec3;
  hostile: boolean;
  classification: EntityClass;
  distance: number;
}

export type EntityClass =
  | "hostile"
  | "neutral"
  | "passive"
  | "player"
  | "projectile"
  | "item"
  | "vehicle"
  | "unknown";

export interface TimeSnapshot {
  timeOfDay: number;
  day: number;
  phase: "dawn" | "day" | "sunset" | "night";
  safeToBuild: boolean;
}

export interface WorldSnapshot {
  dimension: "overworld" | "nether" | "the_end" | "unknown";
  time: TimeSnapshot;
  position: Vec3;
  nearbyEntities: EntitySnapshot[];
  sampleBlocks: BlockSnapshot[];
}

export interface LookState {
  yaw: number;
  pitch: number;
}

/** Client-local position. Never taken from HUD, /tp or showcoordinates. */
export interface PositionState {
  predicted: Vec3;
  server: Vec3 | null;
  source: "protocol" | "prediction" | "spawn" | "unknown";
  desync: number;
  desyncing: boolean;
  updatedAt: number;
}

export interface VisibleBlock {
  x: number;
  y: number;
  z: number;
  id: string;
}

export interface ActionItem {
  id: string;
  name: string;
  detail?: string;
  at: string;
}

export interface SupervisorAlert {
  id: string;
  kind:
    | "HOSTILE_MOB"
    | "CREEPER"
    | "NIGHT"
    | "RESOURCES"
    | "CONNECTION_LOSS"
    | "REALM_UNAVAILABLE"
    | "CRITICAL"
    | "SESSION_CONFLICT"
    | "POSITION_DESYNC";
  title: string;
  body: string;
  createdAt: string;
}

export type ConnectionMode = "server" | "realm" | "simulated";
export type ControlMode = "observe" | "agent" | "manual";

export interface ConnectionTarget {
  mode: ConnectionMode;
  host: string;
  port: number;
  realmId: string;
  realmInvite: string;
  offline: boolean;
}

export interface XboxProfilePublic {
  status: "unauthenticated" | "pending" | "authenticated";
  gamertag: string | null;
  xuid: string | null;
  verificationUri: string | null;
  userCode: string | null;
  message: string | null;
}

export interface MaterialNeed {
  identifier: string;
  required: number;
  available: number;
  deficit: number;
}

export interface StageSpec {
  id: string;
  name: string;
  order: number;
  status: "pending" | "ready" | "running" | "paused" | "completed" | "failed";
  materials: MaterialNeed[];
  origin: Vec3;
  size: Vec3;
  dependencies: string[];
  completedBlocks: number;
  pendingBlocks: number;
  priority: number;
}

export interface BlueprintBlock {
  position: Vec3;
  block: BlockRef;
  layer: 0 | 1;
  stageId: string;
  priority: number;
  orientation?: string;
  placed?: boolean;
}

export interface Blueprint {
  id: string;
  name: string;
  format: "mcstructure" | "internal";
  origin: Vec3;
  size: Vec3;
  rotation: 0 | 90 | 180 | 270;
  stages: StageSpec[];
  blocks: BlueprintBlock[];
  materials: MaterialNeed[];
  sourcePath?: string;
}

export interface MissionState {
  missionId: string;
  name: string;
  status: AgentStatus;
  currentStageId: string | null;
  progress: number;
  position: Vec3 | null;
  time: TimeSnapshot | null;
  resources: ResourceHealth;
  threat: ThreatLevel;
  blueprintId: string | null;
  lastDisconnectReason: DisconnectReason | null;
  lastError: AgentError | null;
  cloudConnected: boolean;
  playerOnline: boolean;
  serverReachable: boolean;
  updatedAt: string;
}

export interface AgentError {
  code: string;
  description: string;
  severity: Severity;
  timestamp: string;
  context: Record<string, unknown>;
  stageId: string | null;
  actionTaken: string;
}

export interface UserMessage {
  id: string;
  level: "info" | "warning" | "action_required" | "success";
  title: string;
  body: string;
  action?: { id: string; label: string };
  createdAt: string;
}

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function vecKey(v: Vec3): string {
  return `${v.x},${v.y},${v.z}`;
}

export function parseBlockId(id: string): BlockRef {
  const raw = id.includes(":") ? id : `minecraft:${id}`;
  const [namespace, identifier] = raw.split(":");
  return { namespace: namespace ?? "unknown", identifier: identifier ?? raw };
}

export function fullId(ref: { namespace: string; identifier: string }): string {
  return `${ref.namespace}:${ref.identifier}`;
}

export function distance(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function manhattan(a: Vec3, b: Vec3): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
}
