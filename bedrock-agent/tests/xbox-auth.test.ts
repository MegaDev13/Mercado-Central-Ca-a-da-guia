import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BEDROCK_AUTH_TITLE, liveFlowOptions } from "../src/auth/XboxAuth.ts";

describe("xbox live flow options", () => {
  it("always sends authTitle required by prismarine-auth live flow", () => {
    const opts = liveFlowOptions();
    assert.equal(opts.flow, "live");
    assert.equal(opts.authTitle, BEDROCK_AUTH_TITLE);
    assert.equal(opts.deviceType, "Nintendo");
  });

  it("prefers Titles.MinecraftNintendoSwitch when the lib exports it", () => {
    const opts = liveFlowOptions({ MinecraftNintendoSwitch: "00000000441cc96b" });
    assert.equal(opts.authTitle, "00000000441cc96b");
  });
});
