import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isForbiddenCommand, PositionTracker, DESYNC_HARD } from "../src/client/PositionTracker.ts";
import { SimulatedClient } from "../src/client/SimulatedClient.ts";
import { ProtocolClient } from "../src/client/ProtocolClient.ts";
import { loadConfig } from "../src/shared/config.ts";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalExecutor } from "../src/executor/LocalExecutor.ts";
import { Logger } from "../src/shared/logger.ts";

describe("position is client-local, never admin commands", () => {
  it("rejects /tp /gamerule /showcoordinates", () => {
    assert.equal(isForbiddenCommand("/tp 1 64 1"), true);
    assert.equal(isForbiddenCommand("/gamerule showcoordinates true"), true);
    assert.equal(isForbiddenCommand("showcoordinates"), true);
    assert.equal(isForbiddenCommand("/gamemode creative"), true);
    assert.equal(isForbiddenCommand("player_auth_input"), false);
  });

  it("tracks predicted vs server and flags hard desync", () => {
    const t = new PositionTracker({ x: 0, y: 64, z: 0 });
    t.acceptServer({ x: 0, y: 64, z: 0 }, "spawn");
    t.predict({ x: 10, y: 64, z: 0 });
    assert.ok(t.desync() >= DESYNC_HARD);
    assert.equal(t.hardDesync(), true);
    const r = t.resync();
    assert.equal(r.x, 0);
    assert.ok(t.desync() < 0.01);
  });

  it("protocol client refuses to queue slash commands", () => {
    const dir = mkdtempSync(join(tmpdir(), "pos-"));
    const cfg = { ...loadConfig(), dataDir: dir, profilesDir: join(dir, "p") };
    const c = new ProtocolClient(cfg);
    assert.throws(() => c.queueSafe("command_request", { command: "/tp 0 80 0" }), /ADMIN_COMMAND_DENIED/);
    assert.throws(() => c.queueSafe("command", { command: "/gamerule showcoordinates true" }), /ADMIN_COMMAND_DENIED/);
  });

  it("supervisor coordinates come from the client tracker, not HUD", async () => {
    const client = new SimulatedClient({ spawn: { x: 12.4, y: 64, z: -7.1 } });
    await client.connect();
    const p = client.getPosition();
    assert.equal(Math.floor(p.x), 12);
    assert.equal(client.getPositionState().source, "spawn");
  });

  it("POSITION_DESYNC interrupts and resyncs from the last server packet", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ds-"));
    const client = new SimulatedClient({ spawn: { x: 0, y: 64, z: 0 } });
    await client.connect();
    const exec = new LocalExecutor({ ...loadConfig(), dataDir: dir }, client, new Logger(join(dir, "l.jsonl"), false));
    exec.setStatus("BUILDING");
    client.injectServerCorrection({ x: 9, y: 64, z: 0 });
    assert.ok(client.getPositionState().desync >= DESYNC_HARD);
    await exec.tick();
    assert.ok(client.getPositionState().desync < DESYNC_HARD);
    assert.equal(Math.round(client.getPosition().x), 9);
  });
});
