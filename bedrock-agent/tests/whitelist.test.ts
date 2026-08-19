import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { identify, isInteractionAllowed, snapshotBlock } from "../src/shared/whitelist.ts";

describe("vanilla whitelist — default deny", () => {
  it("allows explicit vanilla stone bricks", () => {
    const info = identify("minecraft:stone_bricks");
    assert.equal(info.allowed, true);
    assert.equal(info.vanilla, true);
    assert.equal(info.whitelisted, true);
  });

  it("denies mod namespace even if the name looks vanilla", () => {
    const info = identify("create:stone_bricks");
    assert.equal(info.allowed, false);
    assert.equal(info.reason, "non_vanilla_namespace");
  });

  it("denies unknown minecraft identifiers", () => {
    const info = identify("minecraft:totally_new_unreviewed_block_xyz");
    assert.equal(info.vanilla, true);
    assert.equal(info.allowed, false);
    assert.equal(info.reason, "vanilla_but_not_whitelisted");
  });

  it("denies empty / garbage identifiers", () => {
    assert.equal(isInteractionAllowed("modpack:machine_core"), false);
    assert.equal(isInteractionAllowed("something_without_namespace"), false);
  });

  it("marks lava as hazard and not a building material interaction target for pathing", () => {
    const snap = snapshotBlock("minecraft:lava", { x: 0, y: 10, z: 0 });
    assert.equal(snap.hazard, "lava");
    assert.equal(snap.solid, false);
  });
});
