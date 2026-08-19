import { randomUUID } from "node:crypto";
import { PROTOCOL_VERSION } from "./version.ts";
import type {
  ActionItem,
  AgentError,
  AgentStatus,
  Blueprint,
  ConnectionMode,
  ControlMode,
  DisconnectReason,
  LookState,
  MaterialNeed,
  MissionState,
  PositionState,
  ResourceHealth,
  SupervisorAlert,
  ThreatLevel,
  UserMessage,
  Vec3,
  XboxProfilePublic,
} from "./types.ts";

export type MessageType =
  | "hello"
  | "hello_ack"
  | "auth"
  | "auth_ok"
  | "auth_fail"
  | "heartbeat"
  | "heartbeat_ack"
  | "ack"
  | "nack"
  | "plan"
  | "blueprint"
  | "protocol_pack"
  | "mission_update"
  | "command"
  | "event"
  | "state"
  | "progress"
  | "error"
  | "resource_request"
  | "user_message"
  | "resume"
  | "pause"
  | "cancel"
  | "disconnect_notice";

export interface Envelope<T = unknown> {
  v: number;
  id: string;
  type: MessageType;
  ts: number;
  session: string;
  from: "cloud" | "agent";
  idempotencyKey: string;
  ackOf?: string;
  payload: T;
}

export interface HelloPayload {
  agentId: string;
  agentVersion: string;
  capabilities: string[];
}

export interface AuthPayload {
  token: string;
  agentId: string;
}

export interface HeartbeatPayload {
  seq: number;
  status: AgentStatus;
  playerOnline: boolean;
}

export interface PlanPayload {
  missionId: string;
  name: string;
  intent: string;
  blueprint: Blueprint;
  notes: string[];
}

export interface CommandPayload {
  name: AuthorizedTool;
  args: Record<string, unknown>;
}

export interface EventPayload {
  kind: string;
  data: Record<string, unknown>;
}

export interface ResourceRequestPayload {
  missionId: string;
  missing: MaterialNeed[];
  message: string;
}

export type AuthorizedTool =
  | "minecraft.connect"
  | "minecraft.disconnect"
  | "minecraft.get_position"
  | "minecraft.get_block"
  | "minecraft.get_inventory"
  | "minecraft.move_to"
  | "minecraft.place_block"
  | "minecraft.break_block"
  | "minecraft.get_entities"
  | "minecraft.get_time"
  | "minecraft.get_world_state"
  | "minecraft.start_build"
  | "minecraft.pause_build"
  | "minecraft.resume_build"
  | "minecraft.get_progress"
  | "minecraft.screenshot"
  | "minecraft.get_mission"
  | "minecraft.confirm_resources";

export const AUTHORIZED_TOOLS: readonly AuthorizedTool[] = [
  "minecraft.connect",
  "minecraft.disconnect",
  "minecraft.get_position",
  "minecraft.get_block",
  "minecraft.get_inventory",
  "minecraft.move_to",
  "minecraft.place_block",
  "minecraft.break_block",
  "minecraft.get_entities",
  "minecraft.get_time",
  "minecraft.get_world_state",
  "minecraft.start_build",
  "minecraft.pause_build",
  "minecraft.resume_build",
  "minecraft.get_progress",
  "minecraft.screenshot",
  "minecraft.get_mission",
  "minecraft.confirm_resources",
] as const;

export function isAuthorizedTool(name: string): name is AuthorizedTool {
  return (AUTHORIZED_TOOLS as readonly string[]).includes(name);
}

export function envelope<T>(
  type: MessageType,
  payload: T,
  session: string,
  from: "cloud" | "agent",
  idempotencyKey?: string,
): Envelope<T> {
  const id = randomUUID();
  return {
    v: PROTOCOL_VERSION,
    id,
    type,
    ts: Date.now(),
    session,
    from,
    idempotencyKey: idempotencyKey ?? id,
    payload,
  };
}

export function parseEnvelope(raw: string): Envelope {
  const data = JSON.parse(raw) as Envelope;
  if (!data || typeof data !== "object") throw new Error("invalid envelope");
  if (typeof data.v !== "number") throw new Error("missing version");
  if (typeof data.id !== "string") throw new Error("missing id");
  if (typeof data.type !== "string") throw new Error("missing type");
  if (typeof data.idempotencyKey !== "string") throw new Error("missing idempotencyKey");
  return data;
}

export interface DashboardSnapshot {
  agent: LinkStateLike;
  cloud: LinkStateLike;
  server: LinkStateLike;
  player: LinkStateLike;
  mission: string | null;
  stage: string | null;
  progress: number;
  status: AgentStatus;
  resources: ResourceHealth;
  threat: ThreatLevel;
  position: Vec3 | null;
  look: LookState | null;
  positionState: PositionState | null;
  timeLabel: string | null;
  messages: UserMessage[];
  lastDisconnect: DisconnectReason | null;
  lastError: AgentError | null;
  missionState: MissionState | null;
  xbox: XboxProfilePublic;
  connectionMode: ConnectionMode;
  controlMode: ControlMode;
  alerts: SupervisorAlert[];
  logs: Array<{ ts: string; level: string; category: string; message: string }>;
  actions: ActionItem[];
  inventory: import("./types.ts").InventorySnapshot | null;
  materials: MaterialNeed[];
  stages: Array<{ id: string; name: string; status: string; progress: number }>;
  latency: { minecraft: number | null; cloud: number | null };
  sessionConflict: boolean;
}

type LinkStateLike = "ONLINE" | "OFFLINE" | "DEGRADED";
