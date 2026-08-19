import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateBlueprint, interpretIntent } from "../src/cloud/Planner.ts";
import { identify } from "../src/shared/whitelist.ts";

describe("cloud planner", () => {
  it("maps Portuguese intents to templates", () => {
    assert.equal(interpretIntent("construa um castelo").template, "castle");
    assert.equal(interpretIntent("uma torre alta").template, "tower");
    assert.equal(interpretIntent("casa de spruce").template, "house");
    assert.equal(interpretIntent("casa de spruce").material, "minecraft:spruce_planks");
  });

  it("emits only whitelisted blocks", () => {
    const plan = generateBlueprint({ intent: "casa de stone bricks", origin: { x: 0, y: 64, z: 0 } });
    assert.ok(plan.blueprint.blocks.length > 20);
    for (const b of plan.blueprint.blocks) {
      assert.equal(identify(`${b.block.namespace}:${b.block.identifier}`).allowed, true);
    }
    assert.ok(plan.blueprint.stages.length >= 2);
    assert.ok(plan.blueprint.materials.every((m) => m.required > 0));
  });

  it("refuses a mod material", () => {
    assert.throws(() => generateBlueprint({ intent: "parede", material: "create:andesite_casing" }));
  });
});
