/**
 * Single-process demo: cloud planner + local agent + dashboard.
 * Uses the simulated Bedrock world so the stack runs without a game server.
 */
import { loadConfig } from "./shared/config.ts";
import { Logger, defaultLogPath } from "./shared/logger.ts";
import { SimulatedClient } from "./client/SimulatedClient.ts";
import { LocalExecutor } from "./executor/LocalExecutor.ts";
import { AgentGateway } from "./gateway/AgentGateway.ts";
import { CloudServer } from "./cloud/CloudServer.ts";
import { DashboardServer } from "./ui/DashboardServer.ts";
import { exportForHoloPrint } from "./blueprint/HoloPrint.ts";
import { join } from "node:path";
import type { DashboardSnapshot } from "./shared/messages.ts";

const config = loadConfig();
const log = new Logger(defaultLogPath(config.dataDir));
const cloud = new CloudServer(config, log);
cloud.start();

const client = new SimulatedClient({ spawn: { x: 0, y: 64, z: 0 }, timeOfDay: 1000 });
const executor = new LocalExecutor(config, client, log, {
  onEvent: (kind, data) => gateway.emit("event", { kind, data }),
  onEscalate: (code, message) => gateway.emit("error", { code, message }),
});

const gateway = new AgentGateway(
  config,
  log,
  {
    onPlan: (plan) => {
      executor.acceptPlan(plan.missionId, plan.name, plan.blueprint);
      exportForHoloPrint(plan.blueprint, join(config.dataDir, "holoprint", plan.blueprint.id));
    },
    onCommand: async (cmd) => executor.invokeTool(cmd.name, cmd.args),
    onResume: () => executor.resumeBuild(),
    onPause: () => executor.pauseBuild(),
    onCancel: () => void executor.performDisconnect("USER_REQUEST", "Cancelado pela IA."),
    onOpen: () => executor.onCloudRestored(),
    onClose: () => executor.onCloudLost(),
  },
  () => ({ status: executor.mission.status, playerOnline: client.connected }),
);

setTimeout(() => gateway.start(), 250);
executor.start(60);

const ui = new DashboardServer(
  config.uiHost,
  config.uiPort,
  {
    snapshot(): DashboardSnapshot {
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
        position: executor.mission.position,
        messages: executor.userMessages,
        lastDisconnect: executor.mission.lastDisconnectReason,
        lastError: executor.mission.lastError,
        missionState: executor.mission,
      };
    },
    async plan(intent: string) {
      const payload = cloud.planAndDispatch({ intent });
      return {
        missionId: payload.missionId,
        name: payload.name,
        blocks: payload.blueprint.blocks.length,
        stages: payload.blueprint.stages.map((s) => s.name),
        materials: payload.blueprint.materials,
        notes: payload.notes,
      };
    },
    start() {
      executor.startBuild();
    },
    pause() {
      executor.pauseBuild();
    },
    resume() {
      executor.resumeBuild();
    },
    confirmResources() {
      executor.confirmResources();
    },
    inject(kind) {
      if (kind === "creeper") {
        client.injectEntity({
          runtimeId: `creeper-${Date.now()}`,
          typeId: "minecraft:creeper",
          position: { x: client.getPosition().x + 3, y: 64, z: client.getPosition().z },
          namespace: "minecraft",
          identifier: "creeper",
          hostile: true,
          classification: "hostile",
          distance: 3,
        });
      } else if (kind === "zombie") {
        client.injectEntity({
          runtimeId: `zombie-${Date.now()}`,
          typeId: "minecraft:zombie",
          position: { x: client.getPosition().x + 4, y: 64, z: client.getPosition().z },
          namespace: "minecraft",
          identifier: "zombie",
          hostile: true,
          classification: "hostile",
          distance: 4,
        });
      } else if (kind === "night") {
        client.setTime(14000);
      } else if (kind === "day") {
        client.setTime(1000);
        for (const e of client.getEntities(64)) client.removeEntity(e.runtimeId);
        if (executor.mission.status === "NIGHT" || executor.mission.status === "HOSTILE_MOB" || executor.mission.status === "SAFE_WAIT") {
          executor.setStatus("RECONNECTING");
        }
      }
    },
    disconnectUser() {
      void executor.performDisconnect("USER_REQUEST", "Desconectado pelo painel local.");
    },
  },
  log,
);
ui.start();

log.info("connection", `dashboard → http://127.0.0.1:${config.uiPort}`);
log.info("cloud", `planner ws → ${config.cloudWsUrl}`);
