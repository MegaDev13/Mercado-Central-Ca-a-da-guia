import type { IMinecraftClient } from "../client/BedrockClient.ts";
import type { AgentConfig } from "../shared/config.ts";
import type { Logger } from "../shared/logger.ts";
import type {
  ActionItem,
  AgentError,
  AgentStatus,
  Blueprint,
  ControlMode,
  DisconnectReason,
  EntitySnapshot,
  MissionState,
  UserMessage,
  Vec3,
} from "../shared/types.ts";

export interface ExecutorContext {
  config: AgentConfig;
  client: IMinecraftClient;
  log: Logger;
  mission: MissionState;
  blueprint: Blueprint | null;
  cloudConnected: boolean;
  lastHostile: EntitySnapshot | null;
  lastError: AgentError | null;
  userMessages: UserMessage[];
  awaitingResourceConfirm: boolean;
  awaitingUserContinue: boolean;
  tickIndex: number;
  userOverride: boolean;
  lastPath: Vec3[];
  setStatus(status: AgentStatus, extra?: Partial<MissionState>): void;
  save(): void;
  pushMessage(msg: Omit<UserMessage, "id" | "createdAt">): void;
  pushAction(name: string, detail?: string): void;
  requestDisconnect(reason: DisconnectReason, message: string): Promise<void>;
}
