import { join } from "node:path";
import type { AgentConfig } from "../shared/config.ts";
import type { Logger } from "../shared/logger.ts";
import { SimulatedClient } from "../client/SimulatedClient.ts";
import { MinecraftConnection } from "../client/MinecraftConnection.ts";
import { LocalExecutor } from "../executor/LocalExecutor.ts";
import { AgentGateway } from "../gateway/AgentGateway.ts";
import { DashboardServer } from "../ui/DashboardServer.ts";
import { exportForHoloPrint } from "../blueprint/HoloPrint.ts";
import { generateBlueprint } from "../cloud/Planner.ts";
import { XboxAuth } from "../auth/XboxAuth.ts";
import { buildSnapshot } from "../ui/buildSnapshot.ts";
import { buildWorldView } from "../client/WorldView.ts";
import type { CloudServer } from "../cloud/CloudServer.ts";
import type { ControlMode } from "../shared/types.ts";

export function createLocalStack(config: AgentConfig, log: Logger, cloud?: CloudServer) {
  const xbox = new XboxAuth(config.profilesDir, config.mcUsername, log);
  const simulated = config.mcClient === "simulated";
  const client = simulated ? new SimulatedClient({ spawn: { x: 0, y: 64, z: 0 }, timeOfDay: 1000 }) : undefined;
  const connection = new MinecraftConnection(config, client);
  const mc = connection.client;
  let mcLatency: number | null = simulated ? 4 : null;

  const executor = new LocalExecutor(config, mc, log, {
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
    () => ({ status: executor.mission.status, playerOnline: mc.connected }),
  );

  const ui = new DashboardServer(
    config.uiHost,
    config.uiPort,
    {
      snapshot: () =>
        buildSnapshot({ executor, client: mc, gateway, xbox, connection, mcLatency }),
      world: () => buildWorldView(mc, executor),
      async plan(intent: string) {
        if (cloud) {
          const payload = cloud.planAndDispatch({ intent });
          return {
            missionId: payload.missionId,
            name: payload.name,
            blocks: payload.blueprint.blocks.length,
            stages: payload.blueprint.stages.map((s) => s.name),
            materials: payload.blueprint.materials,
          };
        }
        const local = generateBlueprint({ intent });
        executor.acceptPlan(local.missionId, local.name, local.blueprint);
        exportForHoloPrint(local.blueprint, join(config.dataDir, "holoprint", local.blueprint.id));
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
        if (!(mc instanceof SimulatedClient)) return;
        if (kind === "creeper") {
          mc.injectEntity({
            runtimeId: `creeper-${Date.now()}`,
            typeId: "minecraft:creeper",
            position: { ...mc.getPosition(), x: mc.getPosition().x + 3 },
          });
        } else if (kind === "zombie") {
          mc.injectEntity({
            runtimeId: `zombie-${Date.now()}`,
            typeId: "minecraft:zombie",
            position: { ...mc.getPosition(), x: mc.getPosition().x + 4 },
          });
        } else if (kind === "night") mc.setTime(14000);
        else if (kind === "day") {
          mc.setTime(1000);
          for (const e of mc.getEntities(64)) mc.removeEntity(e.runtimeId);
          if (["NIGHT", "HOSTILE_MOB", "SAFE_WAIT"].includes(executor.mission.status)) {
            executor.setStatus("RECONNECTING");
          }
        } else if (kind === "desync") {
          const p = mc.getPosition();
          mc.injectServerCorrection({ x: p.x + 8, y: p.y, z: p.z });
        }
      },
      disconnectUser() {
        void executor.performDisconnect("USER_REQUEST", "Desconectado pelo supervisor.");
      },
      emergency() {
        void executor.emergencyDisconnect();
      },
      xboxStart: () => xbox.startDeviceCode(),
      xboxStatus: () => xbox.snapshot(),
      listRealms: () => xbox.listRealms(),
      configure(target) {
        connection.configure(target);
      },
      async connectMinecraft() {
        try {
          await connection.connect();
          executor.setStatus("ONLINE", { playerOnline: true, serverReachable: true });
          return { ok: true, status: connection.getStatus() };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },
      setControl(mode: ControlMode) {
        executor.controlMode = mode;
        if (mode === "manual") executor.assumeControl();
        else if (mode === "agent") executor.returnControl();
        else {
          executor.userOverride = false;
          if (executor.mission.status === "BUILDING") executor.setStatus("BUILDING");
        }
      },
      async manualMove(delta) {
        if (!executor.userOverride) return { ok: false, reason: "not_in_manual" };
        const p = mc.getPosition();
        return mc.moveStep({
          x: p.x + (delta.x ?? 0),
          y: p.y + (delta.y ?? 0),
          z: p.z + (delta.z ?? 0),
        });
      },
    },
    log,
  );

  setInterval(() => {
    void mc.ping().then((r) => {
      mcLatency = "rttMs" in r && typeof r.rttMs === "number" ? r.rttMs : simulated ? 4 : mcLatency;
    });
  }, 4000);

  return { xbox, connection, client: mc, executor, gateway, ui };
}
