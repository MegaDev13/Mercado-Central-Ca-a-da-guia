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
import { isInteractionAllowed } from "../src/shared/whitelist.ts";

function harness() {
  const dataDir = mkdtempSync(join(tmpdir(), "agent-"));
  const config = { ...loadConfig(), dataDir, allowHostile: false, allowNight: false };
  const client = new SimulatedClient({
    spawn: { x: 0, y: 64, z: 0 },
    timeOfDay: 1000,
    inventory: [
      { namespace: "minecraft", identifier: "stone_bricks", count: 64, slot: 0 },
      { namespace: "minecraft", identifier: "stone_bricks", count: 64, slot: 1 },
      { namespace: "minecraft", identifier: "stone_bricks", count: 64, slot: 2 },
      { namespace: "minecraft", identifier: "oak_planks", count: 64, slot: 3 },
      { namespace: "minecraft", identifier: "glass", count: 32, slot: 4 },
      { namespace: "minecraft", identifier: "oak_door", count: 4, slot: 5 },
      { namespace: "minecraft", identifier: "torch", count: 16, slot: 6 },
      { namespace: "minecraft", identifier: "stone_pickaxe", count: 1, slot: 7 },
    ],
  });
  const log = new Logger(join(dataDir, "logs", "t.jsonl"), false);
  const exec = new LocalExecutor(config, client, log);
  return { client, exec, dataDir };
}

describe("integration — local autonomy", () => {
  it("connects, places vanilla blocks from a plan, never asks the cloud per block", async () => {
    const { client, exec } = harness();
    const plan = generateBlueprint({
      intent: "plataforma de stone bricks",
      origin: { x: 2, y: 64, z: 2 },
    });
    exec.acceptPlan(plan.missionId, plan.name, plan.blueprint);
    exec.startBuild();
    for (let i = 0; i < 80; i++) await exec.tick();
    assert.equal(client.connected, true);
    assert.ok(exec.mission.progress > 0);
    const sample = client.getBlock({ x: 2, y: 64, z: 2 });
    assert.equal(isInteractionAllowed(`${sample.namespace}:${sample.identifier}`), true);
  });

  it("disconnects immediately on creeper without waiting for the cloud", async () => {
    const { client, exec } = harness();
    const plan = generateBlueprint({ intent: "plataforma", origin: { x: 2, y: 64, z: 2 } });
    exec.acceptPlan(plan.missionId, plan.name, plan.blueprint);
    exec.cloudConnected = false;
    exec.startBuild();
    for (let i = 0; i < 5; i++) await exec.tick();
    client.injectEntity({
      runtimeId: "c1",
      typeId: "minecraft:creeper",
      position: { x: 1, y: 64, z: 1 },
    });
    await exec.tick();
    await exec.tick();
    assert.equal(client.connected, false);
    assert.equal(exec.mission.lastDisconnectReason, "CREEPER");
    assert.ok(
      exec.mission.status === "HOSTILE_MOB" || exec.mission.status === "SAFE_WAIT",
      exec.mission.status,
    );
  });

  it("disconnects at night and stays offline", async () => {
    const { client, exec } = harness();
    const plan = generateBlueprint({ intent: "plataforma", origin: { x: 2, y: 64, z: 2 } });
    exec.acceptPlan(plan.missionId, plan.name, plan.blueprint);
    exec.startBuild();
    for (let i = 0; i < 4; i++) await exec.tick();
    client.setTime(18000);
    await exec.tick();
    await exec.tick();
    assert.equal(client.connected, false);
    assert.equal(exec.mission.lastDisconnectReason, "NIGHT");
  });

  it("refuses to start a stage that cannot be finished and asks only for the deficit", async () => {
    const { client, exec } = harness();
    client.consumeItem("minecraft:stone_bricks", 192);
    const plan = generateBlueprint({
      intent: "castelo de stone bricks",
      origin: { x: 2, y: 64, z: 2 },
    });
    exec.acceptPlan(plan.missionId, plan.name, plan.blueprint);
    exec.startBuild();
    for (let i = 0; i < 10; i++) await exec.tick();
    assert.equal(exec.mission.status, "RESOURCE_WAIT");
    assert.equal(client.connected, false);
    const msg = exec.userMessages.find((m) => m.level === "action_required");
    assert.ok(msg);
    assert.match(msg.body, /RECURSOS INSUFICIENTES/);
    assert.match(msg.body, /Stone Bricks/);
    assert.doesNotMatch(msg.body, /Glass: 0/);
  });

  it("rejects unauthorized tools", async () => {
    const { exec } = harness();
    await assert.rejects(() => exec.invokeTool("child_process.exec", { cmd: "rm -rf /" }));
    await assert.rejects(() => exec.invokeTool("minecraft.eval", {}));
  });

  it("ignores mod blocks occupying the world", async () => {
    const { client } = harness();
    client.setBlockRaw({ x: 5, y: 64, z: 5 }, "mekanism:steel_casing");
    const snap = client.getBlock({ x: 5, y: 64, z: 5 });
    assert.equal(snap.vanilla, false);
    assert.equal(snap.whitelisted, false);
    const br = await client.breakBlock({ x: 5, y: 64, z: 5 });
    assert.equal(br.ok, false);
    assert.equal(client.getBlock({ x: 5, y: 64, z: 5 }).identifier, "steel_casing");
  });

  it("resumes the same mission after a disconnect instead of restarting", async () => {
    const { client, exec } = harness();
    const plan = generateBlueprint({ intent: "plataforma", origin: { x: 2, y: 64, z: 2 } });
    exec.acceptPlan(plan.missionId, plan.name, plan.blueprint);
    exec.startBuild();
    for (let i = 0; i < 15; i++) await exec.tick();
    const progress = exec.mission.progress;
    const missionId = exec.mission.missionId;
    await exec.performDisconnect("USER_REQUEST", "pause");
    exec.setStatus("RECONNECTING");
    for (let i = 0; i < 8; i++) await exec.tick();
    assert.equal(exec.mission.missionId, missionId);
    assert.ok(exec.mission.progress >= progress);
    assert.equal(client.connected, true);
  });
});
