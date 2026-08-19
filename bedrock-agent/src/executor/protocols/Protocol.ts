import type { PriorityLevel, ProtocolName } from "../../shared/types.ts";
import type { ExecutorContext } from "../ExecutorContext.ts";

export type ProtocolAction =
  | { type: "none" }
  | { type: "continue" }
  | { type: "disconnect"; reason: import("../../shared/types.ts").DisconnectReason; message: string }
  | { type: "wait"; until: "day" | "resources" | "cloud" | "safe"; message: string }
  | { type: "place"; local: import("../../shared/types.ts").Vec3 }
  | { type: "move"; to: import("../../shared/types.ts").Vec3 }
  | { type: "escalate"; code: string; message: string };

export interface Protocol {
  readonly name: ProtocolName;
  readonly priority: PriorityLevel;
  /** True when this protocol currently demands control. */
  wantsControl(ctx: ExecutorContext): boolean;
  tick(ctx: ExecutorContext): Promise<ProtocolAction>;
}
