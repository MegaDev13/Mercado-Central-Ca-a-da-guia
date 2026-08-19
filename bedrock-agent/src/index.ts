/**
 * Local agent entrypoint.
 * Opens an OUTBOUND WebSocket to the cloud planner and serves the local UI.
 */
import { join } from "node:path";
import { loadConfig } from "./shared/config.ts";
import { Logger, defaultLogPath } from "./shared/logger.ts";
import { SimulatedClient } from "./client/SimulatedClient.ts";
import { ProtocolClient } from "./client/ProtocolClient.ts";
import { LocalExecutor } from "./executor/LocalExecutor.ts";
import { AgentGateway } from "./gateway/AgentGateway.ts";
import { DashboardServer } from "./ui/DashboardServer.ts";
import { exportForHoloPrint } from "./blueprint/HoloPrint.ts";
import { generateBlueprint } from "./cloud/Planner.ts";
import type { IMinecraftClient } from "./client/BedrockClient.ts";
import type { DashboardSnapshot } from "./shared/messages.ts";

const config = loadConfig();
const log = new Logger(defaultLogPath(config.dataDir));

function createClient(): IMinecraftClient {
  if (config.mcClient === "protocol") return new ProtocolClient(config);
  return new SimulatedClient({ spawn: { x: 0, y: 64, z: 0 }, timeOfDay: 1000 });
}

const client = createClient();
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

gateway.start();
executor.start(80);

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
      const local = generateBlueprint({ intent });
      executor.acceptPlan(local.missionId, local.name, local.blueprint);
      exportForHoloPrint(local.blueprint, join(config.dataDir, "holoprint", local.blueprint.id));
      gateway.emit("event", { kind: "local_plan", data: { missionId: local.missionId } });
      return { missionId: local.missionId, name: local.name, blocks: local.blueprint.blocks.length };
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
      if (client instanceof SimulatedClient) {
        if (kind === "creeper") {
          client.injectEntity({
            runtimeId: `creeper-${Date.now()}`,
            typeId: "minecraft:creeper",
            position: { ...client.getPosition(), x: client.getPosition().x + 3 },
          });
        } else if (kind === "zombie") {
          client.injectEntity({
            runtimeId: `zombie-${Date.now()}`,
            typeId: "minecraft:zombie",
            position: { ...client.getPosition(), x: client.getPosition().x + 4 },
          });
        } else if (kind === "night") client.setTime(14000);
        else if (kind === "day") {
          client.setTime(1000);
          for (const e of client.getEntities(64)) client.removeEntity(e.runtimeId);
          if (["NIGHT", "HOSTILE_MOB", "SAFE_WAIT"].includes(executor.mission.status)) {
            executor.setStatus("RECONNECTING");
          }
        }
      }
    },
    disconnectUser() {
      void executor.performDisconnect("USER_REQUEST", "Desconectado pelo painel.");
    },
  },
  log,
);
ui.start();
