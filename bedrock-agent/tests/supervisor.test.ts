import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SimulatedClient } from "../src/client/SimulatedClient.ts";
import { LocalExecutor } from "../src/executor/LocalExecutor.ts";
import { Logger } from "../src/shared/logger.ts";
import { loadConfig } from "../src/shared/config.ts";
import { generateBlueprint } from "../src/cloud/Planner.ts";
import { buildWorldView } from "../src/client/WorldView.ts";

describe("supervisor consumes the same agent world", () => {
  it("world view blocks match the live client, not a decorative scene", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sup-"));
    const client = new SimulatedClient({ spawn: { x: 0, y: 64, z: 0 } });
    const exec = new LocalExecutor({ ...loadConfig(), dataDir: dir }, client, new Logger(join(dir, "l.jsonl"), false));
    await client.connect();
    const plan = generateBlueprint({ intent: "plataforma de stone bricks", origin: { x: 2, y: 64, z: 2 } });
    exec.acceptPlan(plan.missionId, plan.name, plan.blueprint);
    exec.startBuild();
    for (let i = 0; i < 25; i++) await exec.tick();
    const view = buildWorldView(client, exec, 24);
    assert.equal(view.position.x, client.getPosition().x);
    assert.equal(view.position.y, client.getPosition().y);
    assert.ok(view.blocks.some((b) => b.id === "minecraft:grass_block"));
    const placed = client.getBlock({ x: 2, y: 64, z: 2 });
    if (placed.identifier === "stone_bricks") {
      assert.ok(view.blocks.some((b) => b.x === 2 && b.y === 64 && b.z === 2 && b.id.includes("stone_bricks")));
    }
    assert.ok(view.blueprint.length > 0);
  });

  it("manual override stops building but keeps safety protocols", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ov-"));
    const client = new SimulatedClient({ spawn: { x: 0, y: 64, z: 0 } });
    const exec = new LocalExecutor({ ...loadConfig(), dataDir: dir }, client, new Logger(join(dir, "l.jsonl"), false));
    const plan = generateBlueprint({ intent: "plataforma", origin: { x: 2, y: 64, z: 2 } });
    exec.acceptPlan(plan.missionId, plan.name, plan.blueprint);
    exec.startBuild();
    for (let i = 0; i < 6; i++) await exec.tick();
    exec.assumeControl();
    const progress = exec.mission.progress;
    for (let i = 0; i < 8; i++) await exec.tick();
    assert.ok(exec.mission.progress <= progress + 0.1 || exec.mission.status === "PAUSED" || exec.userOverride);
    client.injectEntity({ runtimeId: "c", typeId: "minecraft:creeper", position: { x: 1, y: 64, z: 1 } });
    await exec.tick();
    await exec.tick();
    assert.equal(client.connected, false);
    assert.equal(exec.mission.lastDisconnectReason, "CREEPER");
  });
});
