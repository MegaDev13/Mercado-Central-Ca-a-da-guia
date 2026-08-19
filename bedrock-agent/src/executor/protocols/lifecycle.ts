import { PRIORITY } from "../../shared/types.ts";
import { makeError, ERROR_CODES } from "../../shared/errors.ts";
import type { Protocol, ProtocolAction } from "./Protocol.ts";
import type { ExecutorContext } from "../ExecutorContext.ts";

export class ProtocolConnection implements Protocol {
  readonly name = "PROTOCOL_CONNECTION" as const;
  readonly priority = PRIORITY.CRITICAL_FAILURE;
  wantsControl(ctx: ExecutorContext): boolean {
    return ctx.mission.status === "CONNECTING" || ctx.mission.status === "BOOTING";
  }
  async tick(ctx: ExecutorContext): Promise<ProtocolAction> {
    const next = ctx.blueprint ? "BUILDING" : "ONLINE";
    if (ctx.client.connected) {
      ctx.setStatus(next);
      return { type: "continue" };
    }
    try {
      await ctx.client.connect();
      ctx.setStatus(next, { playerOnline: true, serverReachable: true });
      ctx.log.info("connection", "player connected", { position: ctx.client.getPosition() });
      return { type: "continue" };
    } catch (err) {
      ctx.lastError = makeError(
        ERROR_CODES.CONNECTION_LOST,
        err instanceof Error ? err.message : String(err),
        "RECOVERABLE_ERROR",
        "retry_reconnect",
      );
      return { type: "wait", until: "safe", message: "Falha ao conectar." };
    }
  }
}

export class ProtocolReconnection implements Protocol {
  readonly name = "PROTOCOL_RECONNECTION" as const;
  readonly priority = PRIORITY.EXECUTION_ERROR;
  wantsControl(ctx: ExecutorContext): boolean {
    return ctx.mission.status === "RECONNECTING";
  }
  async tick(ctx: ExecutorContext): Promise<ProtocolAction> {
    if (ctx.client.connected) {
      ctx.setStatus(ctx.blueprint ? "BUILDING" : "ONLINE");
      return { type: "continue" };
    }
    try {
      await ctx.client.connect();
      const time = ctx.client.getTime();
      const hostiles = ctx.client.getEntities(32).filter((e) => e.hostile);
      if (hostiles.length) {
        return {
          type: "disconnect",
          reason: "HOSTILE_MOB",
          message: "Reconexão abortada: mob hostil presente.",
        };
      }
      if (!time.safeToBuild) {
        return { type: "disconnect", reason: "NIGHT", message: "Reconexão abortada: ainda é noite." };
      }
      ctx.setStatus(ctx.blueprint && ctx.mission.progress < 100 ? "BUILDING" : "ONLINE", {
        playerOnline: true,
        serverReachable: true,
      });
      ctx.log.info("reconnect", "reconnected and world is safe", {
        position: ctx.client.getPosition(),
        time,
        progress: ctx.mission.progress,
      });
      return { type: "continue" };
    } catch (err) {
      ctx.log.error("reconnect", "reconnect failed", { err: String(err) });
      return { type: "wait", until: "safe", message: "Reconexão falhou, nova tentativa." };
    }
  }
}

export class ProtocolErrorRecovery implements Protocol {
  readonly name = "PROTOCOL_ERROR_RECOVERY" as const;
  readonly priority = PRIORITY.EXECUTION_ERROR;
  wantsControl(ctx: ExecutorContext): boolean {
    return ctx.mission.status === "ERROR" && ctx.lastError?.severity !== "CRITICAL_ERROR";
  }
  async tick(ctx: ExecutorContext): Promise<ProtocolAction> {
    if (!ctx.lastError) {
      ctx.setStatus(ctx.blueprint ? "BUILDING" : "IDLE");
      return { type: "continue" };
    }
    if (ctx.lastError.severity === "CRITICAL_ERROR") {
      return {
        type: "disconnect",
        reason: "CRITICAL_ERROR",
        message: ctx.lastError.description,
      };
    }
    ctx.log.warn("error", "recoverable error, resuming locally", { error: ctx.lastError });
    ctx.setStatus(ctx.blueprint ? "BUILDING" : "IDLE");
    return { type: "continue" };
  }
}

export class ProtocolMissionState implements Protocol {
  readonly name = "PROTOCOL_MISSION_STATE" as const;
  readonly priority = PRIORITY.BUILDING;
  wantsControl(): boolean {
    return false;
  }
  async tick(ctx: ExecutorContext): Promise<ProtocolAction> {
    ctx.mission.updatedAt = new Date().toISOString();
    ctx.mission.position = ctx.client.connected ? ctx.client.getPosition() : ctx.mission.position;
    ctx.mission.time = ctx.client.connected ? ctx.client.getTime() : ctx.mission.time;
    ctx.mission.cloudConnected = ctx.cloudConnected;
    ctx.mission.playerOnline = ctx.client.connected;
    ctx.save();
    return { type: "none" };
  }
}

export class ProtocolProgressTracking implements Protocol {
  readonly name = "PROTOCOL_PROGRESS_TRACKING" as const;
  readonly priority = PRIORITY.BUILDING;
  wantsControl(): boolean {
    return false;
  }
  async tick(ctx: ExecutorContext): Promise<ProtocolAction> {
    if (!ctx.blueprint) return { type: "none" };
    const total = ctx.blueprint.blocks.filter((b) => b.block.identifier !== "air").length;
    const done = ctx.blueprint.blocks.filter((b) => b.placed && b.block.identifier !== "air").length;
    ctx.mission.progress = total ? Math.round((done / total) * 1000) / 10 : 0;
    if (ctx.tickIndex % 20 === 0) {
      ctx.log.info("progress", "mission progress", {
        mission: ctx.mission.missionId,
        stage: ctx.mission.currentStageId,
        progress: ctx.mission.progress,
        done,
        total,
      });
    }
    return { type: "none" };
  }
}
