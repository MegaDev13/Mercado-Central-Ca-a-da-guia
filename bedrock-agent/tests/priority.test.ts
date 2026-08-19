import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PRIORITY } from "../src/shared/types.ts";

describe("protocol priority hierarchy", () => {
  it("keeps the documented order", () => {
    assert.ok(PRIORITY.CRITICAL_FAILURE < PRIORITY.HOSTILE_MOB);
    assert.ok(PRIORITY.HOSTILE_MOB < PRIORITY.NIGHT);
    assert.ok(PRIORITY.NIGHT < PRIORITY.ENVIRONMENTAL_HAZARD);
    assert.ok(PRIORITY.ENVIRONMENTAL_HAZARD < PRIORITY.RESOURCE_SHORTAGE);
    assert.ok(PRIORITY.RESOURCE_SHORTAGE < PRIORITY.EXECUTION_ERROR);
    assert.ok(PRIORITY.EXECUTION_ERROR < PRIORITY.BUILDING);
  });
});
