import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AUTHORIZED_TOOLS, envelope, isAuthorizedTool, parseEnvelope } from "../src/shared/messages.ts";
import { PROTOCOL_VERSION } from "../src/shared/version.ts";

describe("gateway envelope", () => {
  it("is versioned, identified and idempotent", () => {
    const env = envelope("heartbeat", { seq: 1 }, "sess", "agent", "hb-1");
    assert.equal(env.v, PROTOCOL_VERSION);
    assert.equal(env.idempotencyKey, "hb-1");
    const again = parseEnvelope(JSON.stringify(env));
    assert.equal(again.id, env.id);
  });

  it("exposes only the authorized tool surface", () => {
    assert.equal(isAuthorizedTool("minecraft.place_block"), true);
    assert.equal(isAuthorizedTool("child_process.exec"), false);
    assert.equal(isAuthorizedTool("fs.rm"), false);
    assert.ok(AUTHORIZED_TOOLS.includes("minecraft.disconnect"));
  });
});
