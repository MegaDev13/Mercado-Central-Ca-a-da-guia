/**
 * Local A* pathfinder. The cloud NEVER computes individual steps.
 *
 * Safety > speed.
 * Recalculates locally on blockage. Only escalates to the cloud when no
 * local route exists.
 */
import type { BlockSnapshot, Vec3 } from "../shared/types.ts";
import { manhattan, vecKey } from "../shared/types.ts";

export interface PathQuery {
  from: Vec3;
  to: Vec3;
  maxIter?: number;
  allowWater?: boolean;
  maxFall?: number;
  maxJump?: number;
}

export interface PathResult {
  ok: boolean;
  path: Vec3[];
  reason?: "ok" | "blocked" | "hazard" | "mod_block" | "too_far" | "no_route";
  examined: number;
}

export type BlockLookup = (pos: Vec3) => BlockSnapshot;

interface Node {
  pos: Vec3;
  g: number;
  f: number;
  parent: Node | null;
}

function neighbors(p: Vec3): Vec3[] {
  return [
    { x: p.x + 1, y: p.y, z: p.z },
    { x: p.x - 1, y: p.y, z: p.z },
    { x: p.x, y: p.y, z: p.z + 1 },
    { x: p.x, y: p.y, z: p.z - 1 },
    { x: p.x + 1, y: p.y, z: p.z + 1 },
    { x: p.x + 1, y: p.y, z: p.z - 1 },
    { x: p.x - 1, y: p.y, z: p.z + 1 },
    { x: p.x - 1, y: p.y, z: p.z - 1 },
    { x: p.x, y: p.y + 1, z: p.z },
    { x: p.x, y: p.y - 1, z: p.z },
  ];
}

function walkable(lookup: BlockLookup, pos: Vec3, opts: { allowWater: boolean; maxFall: number }): { ok: boolean; reason?: PathResult["reason"] } {
  const feet = lookup(pos);
  const head = lookup({ x: pos.x, y: pos.y + 1, z: pos.z });
  if (feet.hazard === "lava" || head.hazard === "lava" || feet.hazard === "fire" || head.hazard === "fire") {
    return { ok: false, reason: "hazard" };
  }
  if ((!feet.vanilla && feet.identifier !== "air") || (!head.vanilla && head.identifier !== "air")) {
    return { ok: false, reason: "mod_block" };
  }
  if (!feet.whitelisted && feet.identifier !== "air") return { ok: false, reason: "mod_block" };
  if (feet.solid || head.solid) return { ok: false, reason: "blocked" };
  if (feet.hazard === "water" && !opts.allowWater) return { ok: false, reason: "hazard" };

  let supportY = pos.y - 1;
  let fall = 0;
  while (fall <= opts.maxFall) {
    const below = lookup({ x: pos.x, y: supportY, z: pos.z });
    if (below.hazard === "lava" || below.hazard === "void") return { ok: false, reason: "hazard" };
    if (!below.vanilla && below.identifier !== "air") return { ok: false, reason: "mod_block" };
    if (below.solid) return { ok: true };
    if (below.hazard === "water" && opts.allowWater) return { ok: true };
    supportY -= 1;
    fall += 1;
  }
  return { ok: false, reason: "hazard" };
}

export function findPath(lookup: BlockLookup, query: PathQuery): PathResult {
  const from = { x: Math.round(query.from.x), y: Math.round(query.from.y), z: Math.round(query.from.z) };
  const to = { x: Math.round(query.to.x), y: Math.round(query.to.y), z: Math.round(query.to.z) };
  const allowWater = query.allowWater ?? false;
  const maxFall = query.maxFall ?? 2;
  const maxIter = query.maxIter ?? 4000;

  if (manhattan(from, to) > 256) return { ok: false, path: [], reason: "too_far", examined: 0 };

  const open: Node[] = [{ pos: from, g: 0, f: manhattan(from, to), parent: null }];
  const bestG = new Map<string, number>([[vecKey(from), 0]]);
  let examined = 0;

  while (open.length && examined < maxIter) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
    const current = open.splice(best, 1)[0]!;
    examined += 1;
    if (current.pos.x === to.x && current.pos.y === to.y && current.pos.z === to.z) {
      const path: Vec3[] = [];
      let n: Node | null = current;
      while (n) {
        path.push(n.pos);
        n = n.parent;
      }
      path.reverse();
      return { ok: true, path, reason: "ok", examined };
    }
    for (const nb of neighbors(current.pos)) {
      const step = walkable(lookup, nb, { allowWater, maxFall });
      if (!step.ok) continue;
      const cost = current.g + (nb.x !== current.pos.x && nb.z !== current.pos.z ? 1.4 : 1) + Math.abs(nb.y - current.pos.y) * 0.6;
      const key = vecKey(nb);
      const prev = bestG.get(key);
      if (prev !== undefined && prev <= cost) continue;
      bestG.set(key, cost);
      open.push({ pos: nb, g: cost, f: cost + manhattan(nb, to), parent: current });
    }
  }
  return { ok: false, path: [], reason: "no_route", examined };
}

export function nextSafeStand(lookup: BlockLookup, around: Vec3): Vec3 | null {
  for (let r = 0; r <= 6; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const p = { x: around.x + dx, y: around.y, z: around.z + dz };
        if (walkable(lookup, p, { allowWater: false, maxFall: 1 }).ok) return p;
      }
    }
  }
  return null;
}
