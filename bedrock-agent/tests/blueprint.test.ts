import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateBlueprint } from "../src/cloud/Planner.ts";
import { parseMcStructure, serializeMcStructure } from "../src/blueprint/McStructure.ts";
import { exportForHoloPrint } from "../src/blueprint/HoloPrint.ts";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("blueprint / mcstructure / holoprint", () => {
  it("round-trips a wall through little-endian .mcstructure", async () => {
    const plan = generateBlueprint({ intent: "parede  de stone bricks", origin: { x: 10, y: 64, z: 10 } });
    const buf = serializeMcStructure(plan.blueprint);
    assert.ok(buf.length > 32);
    const again = await parseMcStructure(buf, "roundtrip", { x: 10, y: 64, z: 10 });
    assert.equal(again.size.x, plan.blueprint.size.x);
    assert.equal(again.size.y, plan.blueprint.size.y);
    assert.ok(again.blocks.length > 0);
    assert.ok(again.blocks.every((b) => b.block.namespace === "minecraft"));
  });

  it("exports a single source of truth for HoloPrint visualization", () => {
    const plan = generateBlueprint({ intent: "plataforma" });
    const dir = mkdtempSync(join(tmpdir(), "holo-"));
    const exp = exportForHoloPrint(plan.blueprint, dir);
    assert.equal(existsSync(exp.structureFile), true);
    assert.equal(existsSync(exp.manifestFile), true);
    assert.match(exp.instructions, /holoprint-mc.github.io/);
  });
});
