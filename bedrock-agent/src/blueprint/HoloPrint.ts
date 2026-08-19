/**
 * HoloPrint adapter.
 *
 * HoloPrint (https://github.com/SuperLlama88888/holoprint, holoprint-mc.github.io)
 * converts .mcstructure → Bedrock resource pack holograms. It is a
 * VISUALIZATION tool, not an executor.
 *
 * Architecture:
 *   BLUEPRINT ─┬─► HoloPrint  ► visualization (.mcstructure + manifest)
 *              └─► Build Engine ► execution
 *
 * We never generate a second, divergent blueprint.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Blueprint } from "../shared/types.ts";
import { writeMcStructure } from "./McStructure.ts";
import { recomputeMaterials } from "./Blueprint.ts";

export interface HoloPrintExport {
  directory: string;
  structureFile: string;
  manifestFile: string;
  materialsFile: string;
  instructions: string;
}

export function exportForHoloPrint(bp: Blueprint, outDir: string): HoloPrintExport {
  mkdirSync(outDir, { recursive: true });
  const structureFile = join(outDir, `${bp.id}.mcstructure`);
  writeMcStructure(bp, structureFile);

  const materials = recomputeMaterials(bp);
  const materialsFile = join(outDir, `${bp.id}.materials.json`);
  writeFileSync(materialsFile, JSON.stringify(materials, null, 2));

  const manifest = {
    format_version: 2,
    header: {
      name: `HoloPrint source — ${bp.name}`,
      description: "Generated from the autonomous agent blueprint. Import this .mcstructure at https://holoprint-mc.github.io to produce a hologram resource pack. This file is visualization only.",
      uuid: "00000000-0000-4000-8000-000000000001",
      version: [1, 0, 0],
      min_engine_version: [1, 21, 0],
    },
    modules: [],
    holoprint: {
      structure: `${bp.id}.mcstructure`,
      origin: bp.origin,
      size: bp.size,
      stages: bp.stages.map((s) => s.id),
      note: "Do not treat this pack as the build executor. The Build Engine uses the same blueprint.",
    },
  };
  const manifestFile = join(outDir, "holoprint.manifest.json");
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));

  const instructions = [
    `1. Abra https://holoprint-mc.github.io`,
    `2. Envie ${bp.id}.mcstructure`,
    `3. Gere o .mcpack e aplique no cliente gráfico (visualização).`,
    `4. O executor local continua usando este mesmo blueprint — não duplique.`,
  ].join("\n");

  writeFileSync(join(outDir, "HOLOPRINT.txt"), instructions);
  return { directory: outDir, structureFile, manifestFile, materialsFile, instructions };
}
