/**
 * Cloud planner — strategic brain.
 *
 * Interprets a user request, generates a blueprint, splits it into stages,
 * computes materials. Never emits per-block movement commands.
 */
import { randomUUID } from "node:crypto";
import { addBlock, classifyStageFor, emptyBlueprint, ensureStages, recomputeMaterials } from "../blueprint/Blueprint.ts";
import type { Blueprint, Vec3 } from "../shared/types.ts";
import { identify } from "../shared/whitelist.ts";

export interface PlanRequest {
  intent: string;
  origin?: Vec3;
  material?: string;
}

export interface PlanResult {
  missionId: string;
  name: string;
  intent: string;
  blueprint: Blueprint;
  notes: string[];
}

const TEMPLATES = ["wall", "house", "tower", "platform", "castle"] as const;

export function interpretIntent(intent: string): {
  template: (typeof TEMPLATES)[number];
  material: string;
  width: number;
  height: number;
  depth: number;
} {
  const t = intent.toLowerCase();
  const material = pickMaterial(t);
  if (t.includes("castelo") || t.includes("castle")) {
    return { template: "castle", material, width: 21, height: 8, depth: 21 };
  }
  if (t.includes("torre") || t.includes("tower")) {
    return { template: "tower", material, width: 7, height: 12, depth: 7 };
  }
  if (t.includes("casa") || t.includes("house") || t.includes("cabana")) {
    return { template: "house", material, width: 9, height: 5, depth: 9 };
  }
  if (t.includes("plataforma") || t.includes("platform") || t.includes("piso")) {
    return { template: "platform", material, width: 11, height: 1, depth: 11 };
  }
  return { template: "wall", material, width: 21, height: 5, depth: 1 };
}

function pickMaterial(t: string): string {
  const options: Array<[RegExp, string]> = [
    [/spruce|pinho|abeto/, "minecraft:spruce_planks"],
    [/oak|carvalho/, "minecraft:oak_planks"],
    [/cobble|seixo/, "minecraft:cobblestone"],
    [/brick|tijolo/, "minecraft:stone_bricks"],
    [/quartz|quartzo/, "minecraft:quartz_block"],
    [/deepslate|ardósia/, "minecraft:deepslate_bricks"],
  ];
  for (const [re, id] of options) if (re.test(t)) return id;
  return "minecraft:stone_bricks";
}

export function generateBlueprint(req: PlanRequest): PlanResult {
  const parsed = interpretIntent(req.intent);
  const origin = req.origin ?? { x: 2, y: 64, z: 2 };
  const material = req.material ?? parsed.material;
  const info = identify(material, "block");
  if (!info.allowed) {
    throw new Error(`Planner refused non-whitelisted material ${material}`);
  }
  const missionId = `mission_${randomUUID().slice(0, 8)}`;
  const name = `${parsed.template}_${parsed.width}x${parsed.height}`;
  const bp = emptyBlueprint(missionId, name, origin, {
    x: parsed.width,
    y: parsed.height,
    z: parsed.depth,
  });

  const place = (x: number, y: number, z: number, id: string): void => {
    const ref = identify(id, "block");
    if (!ref.allowed) return;
    const [ns, ident] = id.split(":");
    const block = {
      position: { x, y, z },
      block: { namespace: ns, identifier: ident },
      layer: 0 as const,
      stageId: "walls",
      priority: y,
    };
    block.stageId = classifyStageFor(block, bp.size);
    addBlock(bp, block);
  };

  if (parsed.template === "wall") {
    for (let x = 0; x < parsed.width; x++) {
      for (let y = 0; y < parsed.height; y++) place(x, y, 0, material);
    }
  } else if (parsed.template === "platform") {
    for (let x = 0; x < parsed.width; x++) {
      for (let z = 0; z < parsed.depth; z++) place(x, 0, z, material);
    }
  } else if (parsed.template === "house") {
    buildBox(place, parsed.width, parsed.height, parsed.depth, material, true);
    place(Math.floor(parsed.width / 2), 1, 0, "minecraft:oak_door");
    place(2, 2, 0, "minecraft:glass");
    place(parsed.width - 3, 2, 0, "minecraft:glass");
    place(1, 2, 1, "minecraft:torch");
  } else if (parsed.template === "tower") {
    buildBox(place, parsed.width, parsed.height, parsed.depth, material, false);
    for (let y = 1; y < parsed.height; y += 3) {
      place(1, y, 1, "minecraft:ladder");
      place(Math.floor(parsed.width / 2), y, 1, "minecraft:torch");
    }
  } else if (parsed.template === "castle") {
    buildBox(place, parsed.width, parsed.height, parsed.depth, material, true);
    const turrets = [
      [0, 0],
      [parsed.width - 3, 0],
      [0, parsed.depth - 3],
      [parsed.width - 3, parsed.depth - 3],
    ];
    for (const [tx, tz] of turrets) {
      for (let x = 0; x < 3; x++) {
        for (let z = 0; z < 3; z++) {
          for (let y = 0; y < parsed.height + 3; y++) {
            if (x === 0 || z === 0 || x === 2 || z === 2) place(tx + x, y, tz + z, material);
          }
        }
      }
    }
    place(Math.floor(parsed.width / 2), 1, 0, "minecraft:oak_door");
    place(Math.floor(parsed.width / 2), parsed.height, Math.floor(parsed.depth / 2), "minecraft:torch");
  }

  ensureStages(bp);
  recomputeMaterials(bp);
  return {
    missionId,
    name,
    intent: req.intent,
    blueprint: bp,
    notes: [
      `Template ${parsed.template}`,
      `Material ${material}`,
      `${bp.blocks.length} blocos`,
      `${bp.stages.length} etapas`,
      "HoloPrint deve usar o mesmo .mcstructure exportado pelo agente.",
    ],
  };
}

function buildBox(
  place: (x: number, y: number, z: number, id: string) => void,
  w: number,
  h: number,
  d: number,
  material: string,
  withRoof: boolean,
): void {
  for (let x = 0; x < w; x++) {
    for (let z = 0; z < d; z++) {
      place(x, 0, z, material);
      if (withRoof) place(x, h - 1, z, material);
    }
  }
  for (let y = 1; y < h; y++) {
    for (let x = 0; x < w; x++) {
      place(x, y, 0, material);
      place(x, y, d - 1, material);
    }
    for (let z = 0; z < d; z++) {
      place(0, y, z, material);
      place(w - 1, y, z, material);
    }
  }
}

function requireStage(): typeof import("../blueprint/Blueprint.ts") {
  return {
    classifyStageFor: (block, size) => {
      const id = block.block.identifier;
      if (id.includes("torch") || id.includes("lantern")) return "lighting";
      if (id.includes("door")) return "doors";
      if (id.includes("glass")) return "windows";
      if (id.includes("stairs") || id.includes("ladder")) return "stairs";
      if (block.position.y === 0) return "foundation";
      if (block.position.y >= size.y - 1) return "roof";
      return "walls";
    },
  } as typeof import("../blueprint/Blueprint.ts");
}
