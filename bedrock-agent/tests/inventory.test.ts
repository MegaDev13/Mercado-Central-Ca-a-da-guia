import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { countOf, missingMaterials, organize, selectToolFor } from "../src/executor/InventoryManager.ts";
import type { InventorySnapshot } from "../src/shared/types.ts";

const inv: InventorySnapshot = {
  selectedSlot: 0,
  items: [
    { namespace: "minecraft", identifier: "stone_bricks", count: 10, slot: 4 },
    { namespace: "minecraft", identifier: "diamond_pickaxe", count: 1, slot: 8 },
    { namespace: "create", identifier: "crushing_wheel", count: 3, slot: 2 },
    { namespace: "minecraft", identifier: "bread", count: 4, slot: 1 },
  ],
  hotbar: [],
};

describe("inventory", () => {
  it("counts only matching identifiers", () => {
    assert.equal(countOf(inv, "minecraft:stone_bricks"), 10);
    assert.equal(countOf(inv, "glass"), 0);
  });

  it("selects the best pickaxe for stone", () => {
    const tool = selectToolFor(inv, "stone_bricks");
    assert.ok(tool);
    assert.equal(tool.identifier, "diamond_pickaxe");
  });

  it("drops mod items when organizing", () => {
    const organized = organize(inv);
    assert.equal(organized.some((i) => i.namespace === "create"), false);
    assert.ok(organized[0].identifier.includes("pickaxe"));
  });

  it("computes exact deficit and ignores already owned stacks", () => {
    const miss = missingMaterials(
      [
        { identifier: "minecraft:stone_bricks", count: 25 },
        { identifier: "minecraft:glass", count: 8 },
      ],
      inv,
    );
    assert.deepEqual(
      miss.map((m) => [m.identifier, m.deficit]),
      [
        ["minecraft:stone_bricks", 15],
        ["minecraft:glass", 8],
      ],
    );
  });
});
