import type { DashboardSnapshot } from "../shared/messages.ts";
import type { LocalExecutor } from "../executor/LocalExecutor.ts";
import type { AgentGateway } from "../gateway/AgentGateway.ts";
import type { XboxAuth } from "../auth/XboxAuth.ts";
import type { MinecraftConnection } from "../client/MinecraftConnection.ts";
import { materialPanel } from "../client/WorldView.ts";
import type { IMinecraftClient } from "../client/BedrockClient.ts";

export function clockFromTicks(timeOfDay: number): string {
  const t = ((timeOfDay % 24000) + 24000) % 24000;
  const hours = (Math.floor(t / 1000) + 6) % 24;
  const minutes = Math.floor(((t % 1000) / 1000) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function buildSnapshot(opts: {
  executor: LocalExecutor;
  client: IMinecraftClient;
  gateway: AgentGateway;
  xbox: XboxAuth;
  connection: MinecraftConnection;
  mcLatency: number | null;
}): DashboardSnapshot {
  const { executor, client, gateway, xbox, connection, mcLatency } = opts;
  const time = client.connected ? client.getTime() : executor.mission.time;
  const pos = client.getPosition();
  return {
    agent: "ONLINE",
    cloud: gateway.authenticated ? "ONLINE" : gateway.connected ? "DEGRADED" : "OFFLINE",
    server: client.connected ? "ONLINE" : "OFFLINE",
    player: client.connected ? "ONLINE" : "OFFLINE",
    mission: executor.mission.name,
    stage: executor.mission.currentStageId,
    progress: executor.mission.progress,
    status: executor.mission.status,
    resources: executor.mission.resources,
    threat: executor.mission.threat,
    position: client.connected ? pos : executor.mission.position,
    look: client.connected ? client.getLook() : null,
    positionState: client.getPositionState(),
    timeLabel: time ? `${time.phase.toUpperCase()} — ${clockFromTicks(time.timeOfDay)}` : null,
    messages: executor.userMessages,
    lastDisconnect: executor.mission.lastDisconnectReason,
    lastError: executor.mission.lastError,
    missionState: executor.mission,
    xbox: xbox.snapshot(),
    connectionMode: connection.target.mode,
    controlMode: executor.controlMode,
    alerts: executor.alerts,
    logs: executor.log.recent(60).map((r) => ({
      ts: r.ts,
      level: r.level,
      category: r.category,
      message: r.message,
    })),
    actions: executor.actions,
    inventory: client.getInventory(),
    materials: materialPanel(executor, client),
    stages: (executor.blueprint?.stages ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      progress:
        s.completedBlocks + s.pendingBlocks === 0
          ? 0
          : Math.round((s.completedBlocks / (s.completedBlocks + s.pendingBlocks)) * 100),
    })),
    latency: { minecraft: mcLatency, cloud: gateway.lastRttMs },
    sessionConflict: connection.possibleSessionConflict,
  };
}
