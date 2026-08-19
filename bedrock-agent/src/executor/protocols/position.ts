import { PRIORITY } from "../../shared/types.ts";
import { makeError, ERROR_CODES } from "../../shared/errors.ts";
import { DESYNC_HARD } from "../../client/PositionTracker.ts";
import type { Protocol, ProtocolAction } from "./Protocol.ts";
import type { ExecutorContext } from "../ExecutorContext.ts";

/**
 * Detects POSITION_DESYNC between predicted client motion and the last
 * server-confirmed packet. Never "fixes" position with /tp.
 */
export class ProtocolPosition implements Protocol {
  readonly name = "PROTOCOL_POSITION" as const;
  readonly priority = PRIORITY.ENVIRONMENTAL_HAZARD;

  wantsControl(ctx: ExecutorContext): boolean {
    if (!ctx.client.connected) return false;
    return ctx.client.getPositionState().desync >= DESYNC_HARD;
  }

  async tick(ctx: ExecutorContext): Promise<ProtocolAction> {
    const st = ctx.client.getPositionState();
    if (st.desync < DESYNC_HARD) return { type: "none" };
    ctx.log.warn("protocol", "POSITION_DESYNC — interrupting build, resyncing from server packet", {
      predicted: st.predicted,
      server: st.server,
      desync: st.desync,
    });
    ctx.lastError = makeError(
      ERROR_CODES.POSITION_DESYNC,
      `Client/server position desync ${st.desync.toFixed(2)} blocks`,
      "RECOVERABLE_ERROR",
      "interrupt_recalculate_path",
      { predicted: st.predicted, server: st.server },
      ctx.mission.currentStageId,
    );
    ctx.pushMessage({
      level: "warning",
      title: "POSITION_DESYNC",
      body: `Posição prevista ${fmt(st.predicted)} diverge da posição do servidor ${st.server ? fmt(st.server) : "—"}. Recalculando. Sem /tp.`,
    });
    ctx.pushAction("resync", `${st.desync.toFixed(2)} blocks`);
    ctx.client.resyncFromServer();
    ctx.lastPath = [];
    return { type: "continue" };
  }
}

function fmt(v: { x: number; y: number; z: number }): string {
  return `${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.z.toFixed(1)}`;
}
