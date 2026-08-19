import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyEntity, isCreeper, isHostile, classifyTimeOfDay } from "../src/shared/entities.ts";

describe("entity classification", () => {
  it("marks the vanilla hostile set including extras beyond the spec examples", () => {
    for (const id of [
      "minecraft:creeper",
      "minecraft:zombie",
      "minecraft:skeleton",
      "minecraft:spider",
      "minecraft:witch",
      "minecraft:enderman",
      "minecraft:phantom",
      "minecraft:warden",
      "minecraft:breeze",
      "minecraft:bogged",
      "minecraft:pillager",
      "minecraft:hoglin",
    ]) {
      assert.equal(isHostile(id), true, id);
    }
  });

  it("does not treat cows as hostile", () => {
    assert.equal(classifyEntity("minecraft:cow"), "passive");
    assert.equal(isHostile("minecraft:cow"), false);
  });

  it("treats unknown and mod entities as unknown — never assumed safe", () => {
    assert.equal(classifyEntity("alexsmobs:grizzly_bear"), "unknown");
    assert.equal(classifyEntity("minecraft:future_mob_not_listed"), "unknown");
  });

  it("detects creepers specifically", () => {
    assert.equal(isCreeper("creeper"), true);
    assert.equal(isCreeper("minecraft:zombie"), false);
  });
});

describe("day / night", () => {
  it("treats noon as safe and midnight as unsafe", () => {
    assert.equal(classifyTimeOfDay(6000).safeToBuild, true);
    assert.equal(classifyTimeOfDay(6000).phase, "day");
    assert.equal(classifyTimeOfDay(18000).safeToBuild, false);
    assert.equal(classifyTimeOfDay(18000).phase, "night");
    assert.equal(classifyTimeOfDay(12500).safeToBuild, false);
  });
});
