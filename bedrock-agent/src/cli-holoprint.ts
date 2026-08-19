import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { generateBlueprint } from "./cloud/Planner.ts";
import { exportForHoloPrint } from "./blueprint/HoloPrint.ts";
import { writeMcStructure } from "./blueprint/McStructure.ts";

const intent = process.argv.slice(2).join(" ") || "casa de stone bricks";
const plan = generateBlueprint({ intent });
const out = join(process.cwd(), "data", "holoprint", plan.blueprint.id);
mkdirSync(out, { recursive: true });
writeMcStructure(plan.blueprint, join(out, `${plan.blueprint.id}.mcstructure`));
const exp = exportForHoloPrint(plan.blueprint, out);
console.log(JSON.stringify({ intent, ...exp, blocks: plan.blueprint.blocks.length, materials: plan.blueprint.materials }, null, 2));
