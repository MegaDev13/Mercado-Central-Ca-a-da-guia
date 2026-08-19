import { resolve } from "node:path";

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "yes";
}

export interface AgentConfig {
  cloudWsUrl: string;
  cloudBindHost: string;
  cloudBindPort: number;
  agentToken: string;
  agentId: string;
  protocolVersion: number;
  uiHost: string;
  uiPort: number;
  mcHost: string;
  mcPort: number;
  mcUsername: string;
  mcOffline: boolean;
  mcVersion: string;
  mcRealmId: string;
  mcRealmInvite: string;
  mcClient: "simulated" | "protocol";
  profilesDir: string;
  allowNight: boolean;
  allowHostile: boolean;
  safeDayStart: number;
  safeDayEnd: number;
  dataDir: string;
}

export function loadConfig(cwd = process.cwd()): AgentConfig {
  return {
    cloudWsUrl: env("CLOUD_WS_URL", "ws://127.0.0.1:8787"),
    cloudBindHost: env("CLOUD_BIND_HOST", "0.0.0.0"),
    cloudBindPort: envInt("CLOUD_BIND_PORT", 8787),
    agentToken: env("AGENT_TOKEN", "dev-token-change-me"),
    agentId: env("AGENT_ID", "local-agent-01"),
    protocolVersion: envInt("PROTOCOL_VERSION", 1),
    uiHost: env("UI_HOST", "0.0.0.0"),
    uiPort: envInt("UI_PORT", 8788),
    mcHost: env("MC_HOST", "127.0.0.1"),
    mcPort: envInt("MC_PORT", 19132),
    mcUsername: env("MC_USERNAME", "AutonomousBuilder"),
    mcOffline: envBool("MC_OFFLINE", true),
    mcVersion: env("MC_VERSION", ""),
    mcRealmId: env("MC_REALM_ID", ""),
    mcRealmInvite: env("MC_REALM_INVITE", ""),
    mcClient: env("MC_CLIENT", "simulated") === "protocol" ? "protocol" : "simulated",
    profilesDir: resolve(cwd, env("PROFILES_DIR", env("DATA_DIR", "./data") + "/profiles")),
    allowNight: envBool("ALLOW_NIGHT", false),
    allowHostile: envBool("ALLOW_HOSTILE", false),
    safeDayStart: envInt("SAFE_DAY_START", 0),
    safeDayEnd: envInt("SAFE_DAY_END", 11000),
    dataDir: resolve(cwd, env("DATA_DIR", "./data")),
  };
}
