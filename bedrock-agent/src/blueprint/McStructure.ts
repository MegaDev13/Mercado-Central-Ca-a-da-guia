/**
 * Bedrock .mcstructure codec.
 *
 * Format (tryashtar / Bedrock Wiki, verified):
 *   little-endian uncompressed NBT
 *   format_version: 1
 *   size: [x, y, z]
 *   structure.block_indices: [layer0[], layer1[]]  — ZYX order
 *     index = SZ*SY*X + SZ*Y + Z
 *     -1 = structure void (keep existing)
 *   structure.palette.default.block_palette[]: { name, states, version }
 *
 * This is the single source of truth for builds. HoloPrint and the
 * Build Engine both consume the same Blueprint object produced here.
 */
import { writeFileSync, readFileSync } from "node:fs";
import nbt from "prismarine-nbt";
import { addBlock, classifyStageFor, emptyBlueprint, ensureStages, recomputeMaterials } from "./Blueprint.ts";
import type { Blueprint, Vec3 } from "../shared/types.ts";
import { parseBlockId } from "../shared/types.ts";

const BLOCK_VERSION = 18165359;

type NbtTag = { type: string; value: unknown };

function intTag(value: number): NbtTag {
  return { type: "int", value };
}
function stringTag(value: string): NbtTag {
  return { type: "string", value };
}
function listTag(type: string, value: unknown[]): NbtTag {
  return { type: "list", value: { type, value } };
}
function compTag(value: Record<string, NbtTag>): NbtTag {
  return { type: "compound", value };
}

export async function parseMcStructure(buf: Buffer, id: string, origin: Vec3): Promise<Blueprint> {
  const parsed = await nbt.parse(buf, "little");
  const root = nbt.simplify(parsed.parsed) as {
    format_version?: number;
    size?: number[];
    structure?: {
      block_indices?: number[][];
      palette?: { default?: { block_palette?: Array<{ name: string; states?: Record<string, unknown> }> } };
    };
  };
  const sizeArr = root.size ?? [0, 0, 0];
  const size: Vec3 = { x: sizeArr[0] ?? 0, y: sizeArr[1] ?? 0, z: sizeArr[2] ?? 0 };
  const palette = root.structure?.palette?.default?.block_palette ?? [];
  const layer0 = root.structure?.block_indices?.[0] ?? [];
  const bp = emptyBlueprint(id, id, origin, size);
  bp.format = "mcstructure";

  for (let i = 0; i < layer0.length; i++) {
    const idx = layer0[i];
    if (idx < 0) continue;
    const entry = palette[idx];
    if (!entry) continue;
    const ref = parseBlockId(entry.name);
    const x = Math.floor(i / (size.z * size.y));
    const rem = i % (size.z * size.y);
    const y = Math.floor(rem / size.z);
    const z = rem % size.z;
    const local = { x, y, z };
    const block = {
      position: local,
      block: { ...ref, states: (entry.states ?? {}) as Record<string, string | number | boolean> },
      layer: 0 as const,
      stageId: "walls",
      priority: y,
    };
    block.stageId = classifyStageFor(block, size);
    addBlock(bp, block);
  }
  ensureStages(bp);
  recomputeMaterials(bp);
  return bp;
}

export function serializeMcStructure(bp: Blueprint): Buffer {
  const palette: Array<{ name: string; states: Record<string, unknown> }> = [];
  const indexOf = new Map<string, number>();

  const ensure = (name: string, states?: Record<string, unknown>): number => {
    const k = name + JSON.stringify(states ?? {});
    const existing = indexOf.get(k);
    if (existing !== undefined) return existing;
    const i = palette.length;
    palette.push({ name, states: states ?? {} });
    indexOf.set(k, i);
    return i;
  };

  const volume = bp.size.x * bp.size.y * bp.size.z;
  const layer0 = new Array<number>(volume).fill(-1);
  const layer1 = new Array<number>(volume).fill(-1);

  for (const b of bp.blocks) {
    const i = bp.size.z * bp.size.y * b.position.x + bp.size.z * b.position.y + b.position.z;
    if (i < 0 || i >= volume) continue;
    const name = `${b.block.namespace}:${b.block.identifier}`;
    layer0[i] = ensure(name, b.block.states);
  }

  const paletteCompounds = palette.map((p) => {
    const states: Record<string, NbtTag> = {};
    for (const [k, v] of Object.entries(p.states)) {
      if (typeof v === "string") states[k] = stringTag(v);
      else if (typeof v === "boolean") states[k] = { type: "byte", value: v ? 1 : 0 };
      else states[k] = intTag(Number(v));
    }
    return {
      name: stringTag(p.name),
      states: compTag(states),
      version: intTag(BLOCK_VERSION),
    };
  });

  const root = {
    type: "compound",
    name: "",
    value: {
      format_version: intTag(1),
      size: listTag("int", [bp.size.x, bp.size.y, bp.size.z]),
      structure_world_origin: listTag("int", [bp.origin.x, bp.origin.y, bp.origin.z]),
      structure: compTag({
        block_indices: listTag("list", [
          { type: "int", value: layer0 },
          { type: "int", value: layer1 },
        ]),
        entities: listTag("compound", []),
        palette: compTag({
          default: compTag({
            block_palette: listTag("compound", paletteCompounds),
            block_position_data: compTag({}),
          }),
        }),
      }),
    },
  };

  return nbt.writeUncompressed(root as unknown as nbt.NBT, "little");
}

export function writeMcStructure(bp: Blueprint, filePath: string): void {
  writeFileSync(filePath, serializeMcStructure(bp));
}

export async function readMcStructure(filePath: string, origin: Vec3): Promise<Blueprint> {
  const buf = readFileSync(filePath);
  const id = filePath.split(/[\\/]/).pop()?.replace(/\.mcstructure$/i, "") ?? "structure";
  const bp = await parseMcStructure(buf, id, origin);
  bp.sourcePath = filePath;
  return bp;
}

/** JSON twin of a blueprint — used when NBT is not required. Same source of truth. */
export function blueprintToJson(bp: Blueprint): string {
  return JSON.stringify(bp, null, 2);
}

export function blueprintFromJson(raw: string): Blueprint {
  return JSON.parse(raw) as Blueprint;
}
