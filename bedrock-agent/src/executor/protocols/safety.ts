import { PRIORITY } from "../../shared/types.ts";
import { isCreeper, isHostile } from "../../shared/entities.ts";
import { makeError, ERROR_CODES } from "../../shared/errors.ts";
import type { Protocol, ProtocolAction } from "./Protocol.ts";
import type { ExecutorContext } from "../ExecutorContext.ts";

const SCAN_RADIUS = 32;

export class ProtocolEntityDetection implements Protocol {
  readonly name = "PROTOCOL_ENTITY_DETECTION" as const;
  readonly priority = PRIORITY.HOSTILE_MOB;
  wantsControl(): boolean {
    return false;
  }
  async tick(ctx: ExecutorContext): Promise<ProtocolAction> {
    if (!ctx.client.connected) return { type: "none" };
    const entities = ctx.client.getEntities(SCAN_RADIUS);
    for (const e of entities) {
      ctx.log.info("entity", "entity seen", {
        typeId: e.typeId,
        classification: e.classification,
        position: e.position,
        distance: e.distance,
      });
    }
    return { type: "none" };
  }
}

export class ProtocolHostileMobDetection implements Protocol {
  readonly name = "PROTOCOL_HOSTILE_MOB_DETECTION" as const;
  readonly priority = PRIORITY.HOSTILE_MOB;
  wantsControl(ctx: ExecutorContext): boolean {
    if (ctx.config.allowHostile) return false;
    if (!ctx.client.connected) return false;
    return ctx.client.getEntities(SCAN_RADIUS).some((e) => isHostile(e.typeId));
  }
  async tick(ctx: ExecutorContext): Promise<ProtocolAction> {
    const hostiles = ctx.client.getEntities(SCAN_RADIUS).filter((e) => isHostile(e.typeId));
    if (!hostiles.length) return { type: "none" };
    const worst = hostiles.find((e) => isCreeper(e.typeId)) ?? hostiles[0];
    ctx.lastHostile = worst;
    ctx.log.critical("hostile", "hostile mob detected — local exit, no cloud wait", {
      typeId: worst.typeId,
      position: worst.position,
      distance: worst.distance,
      time: ctx.client.getTime(),
      mission: ctx.mission.missionId,
      stage: ctx.mission.currentStageId,
    });
    const reason = isCreeper(worst.typeId) ? "CREEPER" : "HOSTILE_MOB";
    ctx.lastError = makeError(
      isCreeper(worst.typeId) ? ERROR_CODES.CREEPER : ERROR_CODES.HOSTILE_MOB,
      `Hostile ${worst.typeId} at ${worst.position.x},${worst.position.y},${worst.position.z}`,
      "CRITICAL_ERROR",
      "disconnect_and_safe_wait",
      { entity: worst },
      ctx.mission.currentStageId,
    );
    return {
      type: "disconnect",
      reason,
      message: `Jogador desconectado devido à detecção de mob hostil (${worst.identifier}).`,
    };
  }
}

export class ProtocolHostileMobExit implements Protocol {
  readonly name = "PROTOCOL_HOSTILE_MOB_EXIT" as const;
  readonly priority = PRIORITY.HOSTILE_MOB;
  wantsControl(): boolean {
    return false;
  }
  async tick(): Promise<ProtocolAction> {
    return { type: "none" };
  }
}

export class ProtocolDayNight implements Protocol {
  readonly name = "PROTOCOL_DAY_NIGHT" as const;
  readonly priority = PRIORITY.NIGHT;
  wantsControl(ctx: ExecutorContext): boolean {
    if (ctx.config.allowNight) return false;
    if (!ctx.client.connected) return false;
    return !ctx.client.getTime().safeToBuild;
  }
  async tick(ctx: ExecutorContext): Promise<ProtocolAction> {
    const time = ctx.client.getTime();
    if (time.safeToBuild) return { type: "none" };
    ctx.log.warn("time", "unsafe time of day — disconnect", { time });
    ctx.lastError = makeError(
      ERROR_CODES.NIGHT_DETECTED,
      `Time of day ${time.timeOfDay} phase=${time.phase}`,
      "WARNING",
      "disconnect_and_wait_day",
      { time },
      ctx.mission.currentStageId,
    );
    return {
      type: "disconnect",
      reason: "NIGHT",
      message: "Jogador desconectado devido ao início da noite.",
    };
  }
}

export class ProtocolNightExit implements Protocol {
  readonly name = "PROTOCOL_NIGHT_EXIT" as const;
  readonly priority = PRIORITY.NIGHT;
  wantsControl(): boolean {
    return false;
  }
  async tick(): Promise<ProtocolAction> {
    return { type: "none" };
  }
}

export class ProtocolSafeWait implements Protocol {
  readonly name = "PROTOCOL_SAFE_WAIT" as const;
  readonly priority = PRIORITY.NIGHT;
  wantsControl(ctx: ExecutorContext): boolean {
    return (
      ctx.mission.status === "SAFE_WAIT" ||
      ctx.mission.status === "NIGHT" ||
      ctx.mission.status === "HOSTILE_MOB" ||
      ctx.mission.status === "RESOURCE_WAIT"
    );
  }
  async tick(ctx: ExecutorContext): Promise<ProtocolAction> {
    if (ctx.mission.status === "RESOURCE_WAIT") {
      return { type: "wait", until: "resources", message: "Aguardando recursos do usuário." };
    }
    if (ctx.mission.lastDisconnectReason === "NIGHT") {
      return { type: "wait", until: "day", message: "Aguardando o próximo período diurno." };
    }
    if (ctx.mission.lastDisconnectReason === "HOSTILE_MOB" || ctx.mission.lastDisconnectReason === "CREEPER") {
      return { type: "wait", until: "safe", message: "Aguardando condição segura após mob hostil." };
    }
    return { type: "wait", until: "safe", message: "SAFE_WAIT." };
  }
}
