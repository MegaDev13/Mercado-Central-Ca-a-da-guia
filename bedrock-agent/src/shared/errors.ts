import type { AgentError, Severity } from "./types.ts";

export function makeError(
  code: string,
  description: string,
  severity: Severity,
  actionTaken: string,
  context: Record<string, unknown> = {},
  stageId: string | null = null,
): AgentError {
  return {
    code,
    description,
    severity,
    timestamp: new Date().toISOString(),
    context,
    stageId,
    actionTaken,
  };
}

export const ERROR_CODES = {
  AUTH_FAILED: "AUTH_FAILED",
  PROTOCOL_MISMATCH: "PROTOCOL_MISMATCH",
  DUPLICATE_MESSAGE: "DUPLICATE_MESSAGE",
  UNKNOWN_TOOL: "UNKNOWN_TOOL",
  TOOL_DENIED: "TOOL_DENIED",
  BLOCK_NOT_VANILLA: "BLOCK_NOT_VANILLA",
  BLOCK_NOT_WHITELISTED: "BLOCK_NOT_WHITELISTED",
  BLOCK_UNKNOWN: "BLOCK_UNKNOWN",
  HOSTILE_MOB: "HOSTILE_MOB",
  CREEPER: "CREEPER",
  NIGHT_DETECTED: "NIGHT_DETECTED",
  RESOURCE_SHORTAGE: "RESOURCE_SHORTAGE",
  PATH_BLOCKED: "PATH_BLOCKED",
  HAZARD: "HAZARD",
  BUILD_MISMATCH: "BUILD_MISMATCH",
  BLUEPRINT_INVALID: "BLUEPRINT_INVALID",
  CONNECTION_LOST: "CONNECTION_LOST",
  CRITICAL: "CRITICAL",
  CLOUD_UNREACHABLE: "CLOUD_UNREACHABLE",
  UNSUPPORTED_COMMAND: "UNSUPPORTED_COMMAND",
  POSITION_DESYNC: "POSITION_DESYNC",
  ADMIN_COMMAND_DENIED: "ADMIN_COMMAND_DENIED",
  SESSION_CONFLICT: "SESSION_CONFLICT",
} as const;
