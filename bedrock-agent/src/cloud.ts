/**
 * Cloud planner entrypoint.
 * Bind only to the configured host; agents connect outbound.
 */
import { createServer } from "node:http";
import { loadConfig } from "./shared/config.ts";
import { Logger, defaultLogPath } from "./shared/logger.ts";
import { CloudServer } from "./cloud/CloudServer.ts";

const config = loadConfig();
const log = new Logger(defaultLogPath(config.dataDir));
const cloud = new CloudServer(config, log);
cloud.start();

const http = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, ...cloud.snapshot() }));
    return;
  }
  if (url.pathname === "/plan" && req.method === "POST") {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
    const plan = cloud.planAndDispatch({ intent: String(body.intent ?? "parede") });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        missionId: plan.missionId,
        name: plan.name,
        blocks: plan.blueprint.blocks.length,
        stages: plan.blueprint.stages,
        materials: plan.blueprint.materials,
        notes: plan.notes,
      }),
    );
    return;
  }
  if (url.pathname === "/command" && req.method === "POST") {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
    cloud.command(String(body.name ?? "minecraft.get_progress"), body.args ?? {});
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

const httpPort = config.cloudBindPort + 1;
http.listen(httpPort, config.cloudBindHost, () => {
  log.info("cloud", `planner HTTP on ${config.cloudBindHost}:${httpPort}`);
});
