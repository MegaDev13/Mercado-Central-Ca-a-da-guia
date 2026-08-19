import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WebSocketServer } from "ws";
import { AgentGateway } from "../src/gateway/AgentGateway.ts";
import { envelope, parseEnvelope } from "../src/shared/messages.ts";
import { Logger } from "../src/shared/logger.ts";
import { loadConfig } from "../src/shared/config.ts";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("agent gateway", () => {
  it("authenticates, acks and ignores duplicates", async () => {
    const port = 18080 + Math.floor(Math.random() * 400);
    const seen: string[] = [];
    const wss = new WebSocketServer({ host: "127.0.0.1", port });
    const duplicates: string[] = [];
    wss.on("connection", (ws) => {
      const delivered = new Set<string>();
      ws.on("message", (raw) => {
        const env = parseEnvelope(String(raw));
        seen.push(env.type);
        if (env.type === "hello") {
          ws.send(JSON.stringify(envelope("hello_ack", {}, env.session, "cloud")));
        }
        if (env.type === "auth") {
          ws.send(JSON.stringify(envelope("auth_ok", { session: "s1" }, env.session, "cloud")));
          const plan = envelope("plan", { missionId: "m", name: "n", intent: "x", blueprint: { id: "b", name: "b", format: "internal", origin: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, rotation: 0, stages: [], blocks: [], materials: [] }, notes: [] }, env.session, "cloud", "plan-1");
          ws.send(JSON.stringify(plan));
          ws.send(JSON.stringify(plan));
        }
        if (delivered.has(env.idempotencyKey)) duplicates.push(env.id);
        delivered.add(env.idempotencyKey);
      });
    });

    const dataDir = mkdtempSync(join(tmpdir(), "gw-"));
    const config = { ...loadConfig(), cloudWsUrl: `ws://127.0.0.1:${port}`, dataDir, agentToken: "dev-token-change-me" };
    const log = new Logger(join(dataDir, "l.jsonl"), false);
    let plans = 0;
    const gw = new AgentGateway(
      config,
      log,
      {
        onPlan: () => {
          plans += 1;
        },
        onCommand: async () => ({}),
        onResume: () => undefined,
        onPause: () => undefined,
        onCancel: () => undefined,
        onOpen: () => undefined,
        onClose: () => undefined,
      },
      () => ({ status: "IDLE", playerOnline: false }),
    );
    gw.start();
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(gw.authenticated, true);
    assert.equal(plans, 1);
    const hellos = seen.filter((t) => t === "hello").length;
    const auths = seen.filter((t) => t === "auth").length;
    assert.ok(hellos <= 2, `hello storm: ${hellos}`);
    assert.ok(auths <= 2, `auth storm: ${auths}`);
    gw.stop();
    await new Promise((r) => wss.close(r));
    void duplicates;
  });
});
