import { identify } from "../shared/whitelist.ts";
import type { Blueprint, BlueprintBlock, MaterialNeed, StageSpec, Vec3 } from "../shared/types.ts";
import { vecKey } from "../shared/types.ts";

export const DEFAULT_STAGES = [
  "foundation",
  "structure",
  "walls",
  "doors",
  "windows",
  "stairs",
  "roof",
  "towers",
  "decoration",
  "lighting",
  "validation",
] as const;

export function emptyBlueprint(id: string, name: string, origin: Vec3, size: Vec3): Blueprint {
  return {
    id,
    name,
    format: "internal",
    origin,
    size,
    rotation: 0,
    stages: [],
    blocks: [],
    materials: [],
  };
}

export function addBlock(bp: Blueprint, block: BlueprintBlock): void {
  const info = identify(`${block.block.namespace}:${block.block.identifier}`, "block");
  if (!info.allowed && block.block.identifier !== "air") {
    throw new Error(`Blueprint rejected non-whitelisted block ${info.full}`);
  }
  const key = vecKey(block.position);
  const existing = bp.blocks.findIndex((b) => vecKey(b.position) === key && b.layer === block.layer);
  if (existing >= 0) bp.blocks[existing] = block;
  else bp.blocks.push(block);
}

export function recomputeMaterials(bp: Blueprint): MaterialNeed[] {
  const counts = new Map<string, number>();
  for (const b of bp.blocks) {
    if (b.block.identifier === "air" || b.block.identifier === "structure_void") continue;
    const id = `${b.block.namespace}:${b.block.identifier}`;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  bp.materials = [...counts.entries()].map(([identifier, required]) => ({
    identifier,
    required,
    available: 0,
    deficit: required,
  }));
  return bp.materials;
}

export function classifyStageFor(block: BlueprintBlock, size: Vec3): string {
  const { position } = block;
  const id = block.block.identifier;
  if (id.includes("torch") || id.includes("lantern") || id.includes("glowstone") || id === "sea_lantern") {
    return "lighting";
  }
  if (id.includes("door")) return "doors";
  if (id.includes("glass")) return "windows";
  if (id.includes("stairs") || id.includes("ladder")) return "stairs";
  if (position.y === 0) return "foundation";
  if (position.y >= size.y - 1) return "roof";
  if (id.includes("log") || id.includes("wood")) return "structure";
  return "walls";
}

export function ensureStages(bp: Blueprint): StageSpec[] {
  const byStage = new Map<string, BlueprintBlock[]>();
  for (const b of bp.blocks) {
    const list = byStage.get(b.stageId) ?? [];
    list.push(b);
    byStage.set(b.stageId, list);
  }
  const stages: StageSpec[] = [];
  let order = 0;
  for (const name of DEFAULT_STAGES) {
    const blocks = byStage.get(name);
    if (!blocks || !blocks.length) continue;
    const materials = new Map<string, number>();
    let min: Vec3 = { ...blocks[0].position };
    let max: Vec3 = { ...blocks[0].position };
    for (const b of blocks) {
      const id = `${b.block.namespace}:${b.block.identifier}`;
      if (b.block.identifier !== "air") materials.set(id, (materials.get(id) ?? 0) + 1);
      min = {
        x: Math.min(min.x, b.position.x),
        y: Math.min(min.y, b.position.y),
        z: Math.min(min.z, b.position.z),
      };
      max = {
        x: Math.max(max.x, b.position.x),
        y: Math.max(max.y, b.position.y),
        z: Math.max(max.z, b.position.z),
      };
    }
    stages.push({
      id: name,
      name: name.replace(/_/g, " "),
      order: order++,
      status: "pending",
      materials: [...materials.entries()].map(([identifier, required]) => ({
        identifier,
        required,
        available: 0,
        deficit: required,
      })),
      origin: min,
      size: { x: max.x - min.x + 1, y: max.y - min.y + 1, z: max.z - min.z + 1 },
      dependencies: order > 1 ? [stages[stages.length - 1]?.id].filter(Boolean) as string[] : [],
      completedBlocks: blocks.filter((b) => b.placed).length,
      pendingBlocks: blocks.filter((b) => !b.placed && b.block.identifier !== "air").length,
      priority: order,
    });
  }
  bp.stages = stages;
  return stages;
}

export function rotateOffset(pos: Vec3, size: Vec3, rotation: 0 | 90 | 180 | 270): Vec3 {
  if (rotation === 0) return { ...pos };
  if (rotation === 90) return { x: pos.z, y: pos.y, z: size.x - 1 - pos.x };
  if (rotation === 180) return { x: size.x - 1 - pos.x, y: pos.y, z: size.z - 1 - pos.z };
  return { x: size.z - 1 - pos.z, y: pos.y, z: pos.x };
}

export function worldPosition(bp: Blueprint, local: Vec3): Vec3 {
  const r = rotateOffset(local, bp.size, bp.rotation);
  return { x: bp.origin.x + r.x, y: bp.origin.y + r.y, z: bp.origin.z + r.z };
}

export function progressOf(bp: Blueprint): number {
  const total = bp.blocks.filter((b) => b.block.identifier !== "air").length;
  if (!total) return 0;
  const done = bp.blocks.filter((b) => b.placed && b.block.identifier !== "air").length;
  return Math.round((done / total) * 1000) / 10;
}

export function indexBlocks(bp: Blueprint): Map<string, BlueprintBlock> {
  const map = new Map<string, BlueprintBlock>();
  for (const b of bp.blocks) map.set(vecKey(b.position), b);
  return map;
}
