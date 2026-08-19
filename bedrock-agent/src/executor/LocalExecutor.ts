import { randomUUID } from "node:crypto";
import type { IMinecraftClient } from "../client/BedrockClient.ts";
import type { AgentConfig } from "../shared/config.ts";
import type { Logger } from "../shared/logger.ts";
import type {
  ActionItem,
  AgentStatus,
  Blueprint,
  ControlMode,
  DisconnectReason,
  EntitySnapshot,
  MissionState,
  SupervisorAlert,
  UserMessage,
  Vec3,
} from "../shared/types.ts";
import { PRIORITY } from "../shared/types.ts";
import type { AuthorizedTool } from "../shared/messages.ts";
import { isAuthorizedTool } from "../shared/messages.ts";
import { identify } from "../shared/whitelist.ts";
import { isHostile } from "../shared/entities.ts";
import { progressOf } from "../blueprint/Blueprint.ts";
import { PersistentStore } from "./PersistentStore.ts";
import type { ExecutorContext } from "./ExecutorContext.ts";
import type { Protocol, ProtocolAction } from "./protocols/Protocol.ts";
import {
  ProtocolDayNight,
  ProtocolEntityDetection,
  ProtocolHostileMobDetection,
  ProtocolHostileMobExit,
  ProtocolNightExit,
  ProtocolSafeWait,
} from "./protocols/safety.ts";
import {
  ProtocolConnection,
  ProtocolErrorRecovery,
  ProtocolMissionState,
  ProtocolProgressTracking,
  ProtocolReconnection,
} from "./protocols/lifecycle.ts";
import {
  ProtocolBlockInteraction,
  ProtocolBlueprint,
  ProtocolBuildValidation,
  ProtocolBuilding,
  ProtocolInventory,
  ProtocolMovement,
  ProtocolPathfinding,
  ProtocolResourceManagement,
  ProtocolToolSelection,
} from "./protocols/work.ts";
import { ProtocolPosition } from "./protocols/position.ts";

export interface ExecutorHooks {
  onState?: (state: MissionState, messages: UserMessage[]) => void;
  onEvent?: (kind: string, data: Record<string, unknown>) => void;
  onEscalate?: (code: string, message: string) => void;
}

export class LocalExecutor {
  readonly protocols: Protocol[];
  readonly store: PersistentStore;
  mission: MissionState;
  blueprint: Blueprint | null = null;
  cloudConnected = false;
  lastHostile: EntitySnapshot | null = null;
  lastError: MissionState["lastError"] = null;
  userMessages: UserMessage[] = [];
  awaitingResourceConfirm = false;
  awaitingUserContinue = false;
  tickIndex = 0;
  running = false;
  userOverride = false;
  controlMode: ControlMode = "agent";
  lastPath: Vec3[] = [];
  actions: ActionItem[] = [];
  alerts: SupervisorAlert[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private disconnecting = false;

  constructor(
    readonly config: AgentConfig,
    readonly client: IMinecraftClient,
    readonly log: Logger,
    private readonly hooks: ExecutorHooks = {},
  ) {
    this.store = new PersistentStore(config.dataDir);
    this.protocols = [
      new ProtocolHostileMobDetection(),
      new ProtocolHostileMobExit(),
      new ProtocolEntityDetection(),
      new ProtocolDayNight(),
      new ProtocolNightExit(),
      new ProtocolPosition(),
      new ProtocolSafeWait(),
      new ProtocolConnection(),
      new ProtocolReconnection(),
      new ProtocolErrorRecovery(),
      new ProtocolResourceManagement(),
      new ProtocolBlueprint(),
      new ProtocolBuilding(),
      new ProtocolBuildValidation(),
      new ProtocolInventory(),
      new ProtocolToolSelection(),
      new ProtocolMovement(),
      new ProtocolPathfinding(),
      new ProtocolBlockInteraction(),
      new ProtocolProgressTracking(),
      new ProtocolMissionState(),
    ];
    this.mission = this.store.loadCurrentMission() ?? this.freshMission();
    if (this.mission.blueprintId) {
      this.blueprint = this.store.loadBlueprint(this.mission.blueprintId);
    }
  }

  private freshMission(): MissionState {
    return {
      missionId: "idle",
      name: "Nenhuma missão",
      status: "IDLE",
      currentStageId: null,
      progress: 0,
      position: null,
      time: null,
      resources: "UNKNOWN",
      threat: "SAFE",
      blueprintId: null,
      lastDisconnectReason: null,
      lastError: null,
      cloudConnected: false,
      playerOnline: false,
      serverReachable: false,
      updatedAt: new Date().toISOString(),
    };
  }

  context(): ExecutorContext {
    return {
      config: this.config,
      client: this.client,
      log: this.log,
      mission: this.mission,
      blueprint: this.blueprint,
      cloudConnected: this.cloudConnected,
      lastHostile: this.lastHostile,
      lastError: this.lastError,
      userMessages: this.userMessages,
      awaitingResourceConfirm: this.awaitingResourceConfirm,
      awaitingUserContinue: this.awaitingUserContinue,
      tickIndex: this.tickIndex,
      userOverride: this.userOverride,
      lastPath: this.lastPath,
      setStatus: (status, extra) => this.setStatus(status, extra),
      save: () => this.persist(),
      pushMessage: (msg) => this.pushMessage(msg),
      pushAction: (name, detail) => this.pushAction(name, detail),
      requestDisconnect: (reason, message) => this.performDisconnect(reason, message),
    };
  }

  setStatus(status: AgentStatus, extra: Partial<MissionState> = {}): void {
    this.mission = { ...this.mission, ...extra, status, updatedAt: new Date().toISOString() };
    this.persist();
    this.hooks.onState?.(this.mission, this.userMessages);
  }

  persist(): void {
    this.mission.updatedAt = new Date().toISOString();
    this.mission.lastError = this.lastError;
    this.store.saveMission(this.mission);
    if (this.blueprint) this.store.saveBlueprint(this.blueprint);
  }

  pushMessage(msg: Omit<UserMessage, "id" | "createdAt">): void {
    const full: UserMessage = { ...msg, id: randomUUID(), createdAt: new Date().toISOString() };
    this.userMessages = [full, ...this.userMessages].slice(0, 50);
    this.hooks.onState?.(this.mission, this.userMessages);
  }

  pushAction(name: string, detail?: string): void {
    this.actions = [{ id: randomUUID(), name, detail, at: new Date().toISOString() }, ...this.actions].slice(0, 40);
  }

  pushAlert(alert: Omit<SupervisorAlert, "id" | "createdAt">): void {
    this.alerts = [{ ...alert, id: randomUUID(), createdAt: new Date().toISOString() }, ...this.alerts].slice(0, 20);
  }

  assumeControl(): void {
    this.userOverride = true;
    this.controlMode = "manual";
    if (this.mission.status === "BUILDING") this.setStatus("PAUSED");
    this.pushMessage({ level: "warning", title: "USER_OVERRIDE", body: "Usuário assumiu o controle. Ações automáticas suspensas." });
    this.log.info("protocol", "user override on");
  }

  returnControl(): void {
    this.userOverride = false;
    this.controlMode = "agent";
    this.client.resyncFromServer();
    this.lastPath = [];
    if (this.blueprint && this.client.connected && this.mission.status === "PAUSED") {
      this.setStatus("BUILDING");
    }
    this.pushMessage({ level: "info", title: "Controle devolvido", body: "Estado do mundo recalculado. Agente retomando." });
    this.log.info("protocol", "user override off — world state refreshed");
  }

  async emergencyDisconnect(): Promise<void> {
    this.lastPath = [];
    this.actions = [];
    await this.performDisconnect("EMERGENCY", "EMERGENCY DISCONNECT — fila cancelada, estado mínimo salvo.");
  }

  acceptPlan(missionId: string, name: string, blueprint: Blueprint): void {
    this.blueprint = blueprint;
    this.mission = {
      ...this.freshMission(),
      missionId,
      name,
      status: "IDLE",
      blueprintId: blueprint.id,
      currentStageId: blueprint.stages[0]?.id ?? null,
      progress: progressOf(blueprint),
      resources: "UNKNOWN",
    };
    this.awaitingResourceConfirm = false;
    this.persist();
    this.pushMessage({
      level: "info",
      title: "Plano recebido",
      body: `Missão ${name} pronta. ${blueprint.blocks.length} blocos em ${blueprint.stages.length} etapas.`,
    });
    this.hooks.onEvent?.("plan_accepted", { missionId, name, blocks: blueprint.blocks.length });
  }

  startBuild(): void {
    if (!this.blueprint) {
      this.pushMessage({ level: "warning", title: "Sem blueprint", body: "Nenhum plano carregado." });
      return;
    }
    this.setStatus("CONNECTING");
  }

  pauseBuild(): void {
    this.setStatus("PAUSED");
  }

  resumeBuild(): void {
    if (this.mission.status === "RESOURCE_WAIT") {
      this.awaitingResourceConfirm = false;
      this.setStatus("RECONNECTING", { resources: "UNKNOWN" });
      return;
    }
    if (this.mission.status === "SAFE_WAIT" || this.mission.status === "NIGHT" || this.mission.status === "HOSTILE_MOB") {
      this.setStatus("RECONNECTING");
      return;
    }
    this.setStatus(this.client.connected ? "BUILDING" : "RECONNECTING");
  }

  confirmResources(): void {
    this.awaitingResourceConfirm = false;
    this.setStatus("RECONNECTING", { resources: "UNKNOWN" });
    this.pushMessage({ level: "info", title: "Continuando", body: "Recursos confirmados pelo usuário." });
  }

  async invokeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!isAuthorizedTool(name)) {
      this.log.critical("security", "rejected unauthorized tool", { name });
      throw new Error(`Unauthorized tool: ${name}`);
    }
    return this.dispatchTool(name, args);
  }

  private async dispatchTool(name: AuthorizedTool, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case "minecraft.connect":
        this.setStatus("CONNECTING");
        return { ok: true };
      case "minecraft.disconnect":
        await this.performDisconnect("USER_REQUEST", "Desconectado a pedido do usuário.");
        return { ok: true };
      case "minecraft.get_position":
        return this.client.getPosition();
      case "minecraft.get_block": {
        const pos = args as { x: number; y: number; z: number };
        return this.client.getBlock(pos);
      }
      case "minecraft.get_inventory":
        return this.client.getInventory();
      case "minecraft.move_to":
        return this.client.moveStep(args as { x: number; y: number; z: number });
      case "minecraft.place_block": {
        const id = String(args.item ?? "");
        const info = identify(id, "block");
        if (!info.allowed) return { ok: false, reason: info.reason };
        return this.client.placeBlock(args as { x: number; y: number; z: number }, id);
      }
      case "minecraft.break_block": {
        const pos = args as { x: number; y: number; z: number };
        const block = this.client.getBlock(pos);
        if (!block.whitelisted) return { ok: false, reason: "not_whitelisted" };
        return this.client.breakBlock(pos);
      }
      case "minecraft.get_entities":
        return this.client.getEntities(Number(args.radius ?? 32));
      case "minecraft.get_time":
        return this.client.getTime();
      case "minecraft.get_world_state":
        return this.client.getWorldState();
      case "minecraft.start_build":
        this.startBuild();
        return { ok: true };
      case "minecraft.pause_build":
        this.pauseBuild();
        return { ok: true };
      case "minecraft.resume_build":
        this.resumeBuild();
        return { ok: true };
      case "minecraft.get_progress":
        return { progress: this.mission.progress, stage: this.mission.currentStageId, status: this.mission.status };
      case "minecraft.screenshot":
        return this.client.screenshot();
      case "minecraft.get_mission":
        return this.mission;
      case "minecraft.confirm_resources":
        this.confirmResources();
        return { ok: true };
      default:
        throw new Error(`Unhandled tool ${name}`);
    }
  }

  start(intervalMs = 80): void {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<void> {
    this.tickIndex += 1;
    const ctx = this.context();

    if (this.client.connected) {
      const hostiles = this.client.getEntities(32).filter((e) => isHostile(e.typeId));
      this.mission.threat = hostiles.length ? "HOSTILE_DETECTED" : "SAFE";
      this.mission.time = this.client.getTime();
      this.mission.position = this.client.getPosition();
      this.mission.playerOnline = true;
    }

    const active = this.protocols
      .filter((p) => p.wantsControl(ctx))
      .sort((a, b) => a.priority - b.priority);

    if (this.userOverride || this.mission.status === "PAUSED") {
      const safety = active.filter((p) => p.priority < PRIORITY.BUILDING);
      if (safety[0]) {
        const action = await safety[0].tick(ctx);
        await this.apply(action);
      }
      this.hooks.onState?.(this.mission, this.userMessages);
      return;
    }

    const controller = active[0];
    if (controller && controller.priority < PRIORITY.BUILDING && this.mission.status === "BUILDING") {
      this.log.warn("protocol", "higher priority protocol interrupting build", {
        protocol: controller.name,
        priority: controller.priority,
      });
    }

    const observers = this.protocols.filter((p) => !p.wantsControl(ctx));
    for (const p of observers) {
      if (p.name === "PROTOCOL_ENTITY_DETECTION" || p.name === "PROTOCOL_PROGRESS_TRACKING" || p.name === "PROTOCOL_MISSION_STATE" || p.name === "PROTOCOL_INVENTORY" || p.name === "PROTOCOL_TOOL_SELECTION" || p.name === "PROTOCOL_BLUEPRINT") {
        await p.tick(ctx);
      }
    }

    if (!controller) {
      if (this.mission.status === "CONNECTING") {
        await this.protocols.find((p) => p.name === "PROTOCOL_CONNECTION")?.tick(ctx);
      } else if (this.mission.status === "RECONNECTING") {
        await this.protocols.find((p) => p.name === "PROTOCOL_RECONNECTION")?.tick(ctx);
      }
      this.hooks.onState?.(this.mission, this.userMessages);
      return;
    }

    const action = await controller.tick(ctx);
    await this.apply(action);
    this.hooks.onState?.(this.mission, this.userMessages);
  }

  private async apply(action: ProtocolAction): Promise<void> {
    switch (action.type) {
      case "none":
      case "continue":
        return;
      case "disconnect":
        await this.performDisconnect(action.reason, action.message);
        return;
      case "wait":
        if (action.until === "resources") this.setStatus("RESOURCE_WAIT");
        else if (action.until === "day") this.setStatus("NIGHT");
        else this.setStatus("SAFE_WAIT");
        return;
      case "escalate":
        this.log.warn("cloud", "escalating to cloud planner", { code: action.code, message: action.message });
        this.hooks.onEscalate?.(action.code, action.message);
        this.pushMessage({ level: "warning", title: "Decisão da IA necessária", body: action.message });
        return;
      default:
        return;
    }
  }

  async performDisconnect(reason: DisconnectReason, message: string): Promise<void> {
    if (this.disconnecting) return;
    this.disconnecting = true;
    try {
      this.mission.lastDisconnectReason = reason;
      this.persist();
      this.log.warn("disconnect", "disconnecting", {
        reason,
        position: this.client.getPosition(),
        stage: this.mission.currentStageId,
        progress: this.mission.progress,
      });
      if (this.client.connected) await this.client.disconnect(reason);
      const status: AgentStatus =
        reason === "NIGHT"
          ? "NIGHT"
          : reason === "HOSTILE_MOB" || reason === "CREEPER"
            ? "HOSTILE_MOB"
            : reason === "RESOURCE_SHORTAGE"
              ? "RESOURCE_WAIT"
              : reason === "CRITICAL_ERROR"
                ? "ERROR"
                : "SAFE_WAIT";
      this.setStatus(status, { playerOnline: false, lastDisconnectReason: reason });
      this.pushMessage({
        level: reason === "RESOURCE_SHORTAGE" ? "action_required" : "warning",
        title: `Desconectado: ${reason}`,
        body: message,
        action: reason === "RESOURCE_SHORTAGE" ? { id: "continue", label: "CONTINUAR" } : undefined,
      });
      if (reason === "HOSTILE_MOB" || reason === "CREEPER") {
        this.pushAlert({
          kind: reason === "CREEPER" ? "CREEPER" : "HOSTILE_MOB",
          title: reason === "CREEPER" ? "CREEPER DETECTADO" : "MOB HOSTIL DETECTADO",
          body: message,
        });
      } else if (reason === "NIGHT") {
        this.pushAlert({ kind: "NIGHT", title: "NOITE DETECTADA", body: message });
      } else if (reason === "RESOURCE_SHORTAGE") {
        this.pushAlert({ kind: "RESOURCES", title: "RECURSOS INSUFICIENTES", body: message });
      } else if (reason === "EMERGENCY") {
        this.pushAlert({ kind: "CRITICAL", title: "EMERGÊNCIA", body: message });
      }
      this.hooks.onEvent?.("disconnected", { reason, message });
    } finally {
      this.disconnecting = false;
    }
  }

  /**
   * If the cloud link drops mid-mission: keep executing the current local
   * protocol when safe, never start a new strategic decision.
   */
  onCloudLost(): void {
    this.cloudConnected = false;
    this.log.warn("cloud", "cloud link lost — continuing current local protocols only");
    if (this.mission.status === "IDLE") {
      this.setStatus("SAFE_WAIT");
      this.pushMessage({
        level: "warning",
        title: "IA indisponível",
        body: "Sem novas decisões estratégicas até a reconexão da IA.",
      });
    }
  }

  onCloudRestored(): void {
    this.cloudConnected = true;
    this.log.info("cloud", "cloud link restored");
  }
}
