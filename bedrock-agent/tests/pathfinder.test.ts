import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findPath } from "../src/executor/Pathfinder.ts";
import { snapshotBlock } from "../src/shared/whitelist.ts";
import type { Vec3 } from "../src/shared/types.ts";

function grid(blocked: Set<string>, hazards = new Set<string>()) {
  return (pos: Vec3) => {
    const key = `${pos.x},${pos.y},${pos.z}`;
    if (hazards.has(key)) return snapshotBlock("minecraft:lava", pos);
    if (blocked.has(key)) return snapshotBlock("minecraft:stone", pos);
    if (pos.y === 63) return snapshotBlock("minecraft:grass_block", pos);
    if (pos.y === 64 || pos.y === 65) return snapshotBlock("minecraft:air", pos);
    return snapshotBlock("minecraft:stone", pos);
  };
}

describe("pathfinder", () => {
  it("finds a walkable path on flat ground", () => {
    const res = findPath(grid(new Set()), { from: { x: 0, y: 64, z: 0 }, to: { x: 6, y: 64, z: 0 } });
    assert.equal(res.ok, true);
    assert.ok(res.path.length >= 2);
  });

  it("refuses lava", () => {
    const lava = new Set(["1,64,0", "1,65,0"]);
    const res = findPath(grid(new Set(), lava), { from: { x: 0, y: 64, z: 0 }, to: { x: 1, y: 64, z: 0 } });
    assert.equal(res.ok, false);
  });

  it("routes around a wall", () => {
    const wall = new Set(["2,64,0", "2,65,0", "2,64,1", "2,65,1", "2,64,-1", "2,65,-1"]);
    const res = findPath(grid(wall), { from: { x: 0, y: 64, z: 0 }, to: { x: 4, y: 64, z: 0 } });
    assert.equal(res.ok, true);
    assert.ok(res.path.every((p) => p.x !== 2 || p.z > 1 || p.z < -1));
  });
});
