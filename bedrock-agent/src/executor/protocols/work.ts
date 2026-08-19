import { PRIORITY } from "../../shared/types.ts";
import { isInteractionAllowed, snapshotBlock } from "../../shared/whitelist.ts";
import { makeError, ERROR_CODES } from "../../shared/errors.ts";
import { findPath } from "../Pathfinder.ts";
import { countOf, organize, selectToolFor } from "../InventoryManager.ts";
import { evaluateStage, formatResourceMessage, hasDeficit } from "../ResourceManager.ts";
import { worldPosition } from "../../blueprint/Blueprint.ts";
import type { Protocol, ProtocolAction } from "./Protocol.ts";
import type { ExecutorContext } from "../ExecutorContext.ts";
import type { Vec3 } from "../../shared/types.ts";

export class ProtocolMovement implements Protocol {
  readonly name = "PROTOCOL_MOVEMENT" as const;
  readonly priority = PRIORITY.BUILDING;
  wantsControl(): boolean {
    return false;
  }
  async tick(): Promise<ProtocolAction> {
    return { type: "none" };
  }
}

export class ProtocolPathfinding implements Protocol {
  readonly name = "PROTOCOL_PATHFINDING" as const;
  readonly priority = PRIORITY.BUILDING;
  wantsControl(): boolean {
    return false;
  }
  async tick(): Promise<ProtocolAction> {
    return { type: "none" };
  }
}

export class ProtocolBlockInteraction implements Protocol {
  readonly name = "PROTOCOL_BLOCK_INTERACTION" as const;
  readonly priority = PRIORITY.BUILDING;
  wantsControl(): boolean {
    return false;
  }
  async tick(ctx: ExecutorContext): Promise<ProtocolAction> {
    void ctx;
    return { type: "none" };
  }
}

export class ProtocolInventory implements Protocol {
  readonly name = "PROTOCOL_INVENTORY" as const;
  readonly priority = PRIORITY.BUILDING;
  wantsControl(): boolean {
    return false;
  }
  async tick(ctx: ExecutorContext): Promise<ProtocolAction> {
    if (!ctx.client.connected) return { type: "none" };
    const organized = organize(ctx.client.getInventory());
    void organized;
    return { type: "none" };
  }
}

export class ProtocolToolSelection implements Protocol {
  readonly name = "PROTOCOL_TOOL_SELECTION" as const;
  readonly priority = PRIORITY.BUILDING;
  wantsControl(): boolean {
    return false;
  }
  async tick(ctx: ExecutorContext): Promise<ProtocolAction> {
    if (!ctx.client.connected || !ctx.blueprint) return { type: "none" };
    const next = ctx.blueprint.blocks.find((b) => !b.placed && b.block.identifier !== "air");
    if (!next) return { type: "none" };
    const tool = selectToolFor(ctx.client.getInventory(), next.block.identifier);
    if (tool) ctx.client.setSelectedSlot(tool.slot);
    return { type: "none" };
  }
}

export class ProtocolResourceManagement implements Protocol {
  readonly name = "PROTOCOL_RESOURCE_MANAGEMENT" as const;
  readonly priority = PRIORITY.RESOURCE_SHORTAGE;
  wantsControl(ctx: ExecutorContext): boolean {
    if (!ctx.blueprint || ctx.mission.status === "RESOURCE_WAIT") return ctx.mission.status === "RESOURCE_WAIT";
    if (!ctx.client.connected) return false;
    const stage = ctx.blueprint.stages.find((s) => s.id === ctx.mission.currentStageId) ?? ctx.blueprint.stages.find((s) => s.status !== "completed");
    if (!stage) return false;
    const needs = evaluateStage(stage, ctx.blueprint, ctx.client.getInventory());
    return hasDeficit(needs);
  }
  async tick(ctx: ExecutorContext): Promise<ProtocolAction> {
    if (!ctx.blueprint) return { type: "none" };
    const stage =
      ctx.blueprint.stages.find((s) => s.id === ctx.mission.currentStageId) ??
      ctx.blueprint.stages.find((s) => s.status !== "completed");
    if (!stage) return { type: "none" };
    const needs = evaluateStage(stage, ctx.blueprint, ctx.client.getInventory());
    if (!hasDeficit(needs)) {
      ctx.awaitingResourceConfirm = false;
      if (ctx.mission.status === "RESOURCE_WAIT") ctx.setStatus("BUILDING", { resources: "OK" });
      return { type: "continue" };
    }
    const message = formatResourceMessage(needs);
    ctx.log.warn("resource", "resource shortage — will not start incomplete stage", { needs, stage: stage.id });
    ctx.lastError = makeError(
      ERROR_CODES.RESOURCE_SHORTAGE,
      "Insufficient resources for current stage",
      "WARNING",
      "disconnect_and_resource_wait",
      { needs, stage: stage.id },
      stage.id,
    );
    ctx.pushMessage({
      level: "action_required",
      title: "CONSTRUÇÃO PAUSADA",
      body: message,
      action: { id: "continue", label: "CONTINUAR" },
    });
    ctx.awaitingResourceConfirm = true;
    ctx.setStatus("RESOURCE_WAIT", { resources: "INSUFFICIENT" });
    return { type: "disconnect", reason: "RESOURCE_SHORTAGE", message };
  }
}

export class ProtocolBlueprint implements Protocol {
  readonly name = "PROTOCOL_BLUEPRINT" as const;
  readonly priority = PRIORITY.BUILDING;
  wantsControl(): boolean {
    return false;
  }
  async tick(ctx: ExecutorContext): Promise<ProtocolAction> {
    if (!ctx.blueprint) return { type: "none" };
    for (const b of ctx.blueprint.blocks) {
      const infoOk = isInteractionAllowed(`${b.block.namespace}:${b.block.identifier}`, "block") || b.block.identifier === "air";
      if (!infoOk) {
        return {
          type: "escalate",
          code: ERROR_CODES.BLUEPRINT_INVALID,
          message: `Blueprint contains non-whitelisted block ${b.block.namespace}:${b.block.identifier}`,
        };
      }
    }
    return { type: "none" };
  }
}

export class ProtocolBuilding implements Protocol {
  readonly name = "PROTOCOL_BUILDING" as const;
  readonly priority = PRIORITY.BUILDING;
  wantsControl(ctx: ExecutorContext): boolean {
    if (ctx.userOverride || ctx.mission.status === "PAUSED") return false;
    return ctx.mission.status === "BUILDING" && !!ctx.blueprint && ctx.client.connected;
  }
  async tick(ctx: ExecutorContext): Promise<ProtocolAction> {
    const bp = ctx.blueprint;
    if (!bp) return { type: "none" };
    const stage = nextStage(ctx);
    if (!stage) {
      ctx.setStatus("COMPLETED");
      ctx.pushMessage({ level: "success", title: "Construção concluída", body: `Missão ${ctx.mission.name} finalizada.` });
      return { type: "none" };
    }
    ctx.mission.currentStageId = stage.id;
    stage.status = "running";

    const next = bp.blocks
      .filter((b) => b.stageId === stage.id && !b.placed && b.block.identifier !== "air")
      .sort((a, b) => a.position.y - b.position.y || a.position.z - b.position.z || a.position.x - b.position.x)[0];
    if (!next) {
      stage.status = "completed";
      ctx.log.info("stage", "stage completed", { stage: stage.id });
      return { type: "continue" };
    }

    const world = worldPosition(bp, next.position);
    const id = `${next.block.namespace}:${next.block.identifier}`;
    if (!isInteractionAllowed(id, "block")) {
      ctx.log.error("block", "refused non-whitelisted block", { id, world });
      next.placed = true;
      return { type: "continue" };
    }
    if (countOf(ctx.client.getInventory(), id) <= 0) {
      return { type: "none" };
    }

    const stand = standNextTo(world, ctx.client.getPosition());
    const moved = await walkTo(ctx, stand);
    if (!moved) {
      ctx.lastError = makeError(ERROR_CODES.PATH_BLOCKED, "No local path to next block", "RECOVERABLE_ERROR", "retry_or_escalate", { world }, stage.id);
      return { type: "escalate", code: ERROR_CODES.PATH_BLOCKED, message: "Sem rota local até o próximo bloco." };
    }

    const existing = ctx.client.getBlock(world);
    if (!existing.vanilla && existing.identifier !== "air") {
      ctx.log.warn("block", "mod block occupies target — skipping, never destroy", { world, existing });
      return { type: "escalate", code: ERROR_CODES.BLOCK_NOT_VANILLA, message: "Bloco de mod no alvo." };
    }
    if (existing.solid && existing.identifier !== next.block.identifier) {
      if (!existing.whitelisted) {
        ctx.log.warn("block", "occupied by non-whitelisted block, will not break", { existing });
        return { type: "continue" };
      }
      await ctx.client.breakBlock(world);
    }

    ctx.client.lookAt(world);
    const placed = await ctx.client.placeBlock(world, id, next.block.states);
    if (!placed.ok) {
      ctx.log.warn("block", "place failed", { world, id, reason: placed.reason });
      return { type: "continue" };
    }
    next.placed = true;
    stage.completedBlocks += 1;
    stage.pendingBlocks = Math.max(0, stage.pendingBlocks - 1);
    ctx.log.info("block", "placed", { world, id, stage: stage.id });
    return { type: "continue" };
  }
}

export class ProtocolBuildValidation implements Protocol {
  readonly name = "PROTOCOL_BUILD_VALIDATION" as const;
  readonly priority = PRIORITY.BUILDING;
  wantsControl(ctx: ExecutorContext): boolean {
    return ctx.mission.status === "BUILDING" && !!ctx.blueprint && ctx.tickIndex % 40 === 0;
  }
  async tick(ctx: ExecutorContext): Promise<ProtocolAction> {
    const bp = ctx.blueprint;
    if (!bp || !ctx.client.connected) return { type: "none" };
    let mismatches = 0;
    let corrected = 0;
    for (const b of bp.blocks) {
      if (b.block.identifier === "air") continue;
      const world = worldPosition(bp, b.position);
      const actual = ctx.client.getBlock(world);
      const expected = `${b.block.namespace}:${b.block.identifier}`;
      const actualId = `${actual.namespace}:${actual.identifier}`;
      if (actualId === expected) {
        b.placed = true;
        continue;
      }
      if (!actual.vanilla || !actual.whitelisted) {
        if (actual.identifier !== "air") {
          mismatches += 1;
          ctx.log.warn("block", "external or mod mismatch, will not touch", { world, actual: actualId, expected });
          continue;
        }
      }
      if (b.placed && actual.identifier === "air") {
        b.placed = false;
        mismatches += 1;
        ctx.log.warn("block", "block missing after placement — will rebuild", { world, expected });
      } else if (b.placed && actualId !== expected && actual.whitelisted) {
        mismatches += 1;
        const br = await ctx.client.breakBlock(world);
        if (br.ok) {
          b.placed = false;
          corrected += 1;
        }
      }
    }
    if (mismatches && ctx.tickIndex % 40 === 0) {
      ctx.log.info("progress", "validation pass", { mismatches, corrected });
    }
    if (mismatches > 64) {
      return {
        type: "escalate",
        code: ERROR_CODES.BUILD_MISMATCH,
        message: `Alteração estrutural significativa (${mismatches} blocos).`,
      };
    }
    void snapshotBlock;
    return { type: "none" };
  }
}

function nextStage(ctx: ExecutorContext) {
  const bp = ctx.blueprint;
  if (!bp) return null;
  return (
    bp.stages.find((s) => s.id === ctx.mission.currentStageId && s.status !== "completed") ??
    bp.stages.find((s) => s.status !== "completed") ??
    null
  );
}

function standNextTo(target: Vec3, current: Vec3): Vec3 {
  const options = [
    { x: target.x + 1, y: target.y, z: target.z },
    { x: target.x - 1, y: target.y, z: target.z },
    { x: target.x, y: target.y, z: target.z + 1 },
    { x: target.x, y: target.y, z: target.z - 1 },
  ];
  options.sort((a, b) => Math.abs(a.x - current.x) + Math.abs(a.z - current.z) - (Math.abs(b.x - current.x) + Math.abs(b.z - current.z)));
  return options[0];
}

async function walkTo(ctx: ExecutorContext, dest: Vec3): Promise<boolean> {
  const lookup = (p: Vec3) => ctx.client.getBlock(p);
  let from = ctx.client.getPosition();
  from = { x: Math.round(from.x), y: Math.round(from.y), z: Math.round(from.z) };
  const goal = { x: Math.round(dest.x), y: Math.round(from.y), z: Math.round(dest.z) };
  if (from.x === goal.x && from.y === goal.y && from.z === goal.z) return true;
  const manhattan = Math.abs(from.x - goal.x) + Math.abs(from.z - goal.z);
  if (manhattan <= 2) {
    ctx.pushAction("Move To", `${goal.x},${goal.y},${goal.z}`);
    const step = await ctx.client.moveStep(goal);
    if (step.ok) {
      ctx.lastPath = [from, goal];
      return true;
    }
  }
  const result = findPath(lookup, { from, to: goal, maxIter: 1200 });
  if (!result.ok) {
    ctx.log.warn("protocol", "pathfinder failed, trying alternate", { reason: result.reason, from, goal });
    const alt = findPath(lookup, { from, to: { ...goal, y: from.y }, maxIter: 1200, allowWater: false });
    if (!alt.ok) return false;
    return follow(ctx, alt.path);
  }
  return follow(ctx, result.path);
}

async function follow(ctx: ExecutorContext, path: Vec3[]): Promise<boolean> {
  ctx.lastPath = path;
  ctx.pushAction("Move", `${path.length} steps`);
  for (const step of path.slice(1)) {
    const r = await ctx.client.moveStep(step);
    if (!r.ok) return false;
  }
  return true;
}
