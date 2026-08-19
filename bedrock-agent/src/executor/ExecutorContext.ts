import type { IMinecraftClient } from "../client/BedrockClient.ts";
import type { AgentConfig } from "../shared/config.ts";
import type { Logger } from "../shared/logger.ts";
import type {
  AgentError,
  AgentStatus,
  Blueprint,
  DisconnectReason,
  EntitySnapshot,
  MissionState,
  UserMessage,
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
  setStatus(status: AgentStatus, extra?: Partial<MissionState>): void;
  save(): void;
  pushMessage(msg: Omit<UserMessage, "id" | "createdAt">): void;
  requestDisconnect(reason: DisconnectReason, message: string): Promise<void>;
}
