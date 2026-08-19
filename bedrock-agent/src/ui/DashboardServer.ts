import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { DashboardSnapshot } from "../shared/messages.ts";
import type { Logger } from "../shared/logger.ts";
import type { ConnectionTarget, ControlMode } from "../shared/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, "public");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

export interface DashboardApi {
  snapshot(): DashboardSnapshot;
  world(): unknown;
  plan(intent: string): Promise<unknown>;
  start(): void;
  pause(): void;
  resume(): void;
  confirmResources(): void;
  inject(kind: "creeper" | "night" | "day" | "zombie" | "desync"): void;
  disconnectUser(): void;
  emergency(): void;
  xboxStart(): Promise<unknown>;
  xboxStatus(): unknown;
  listRealms(): Promise<unknown>;
  configure(target: Partial<ConnectionTarget>): void;
  connectMinecraft(): Promise<unknown>;
  setControl(mode: ControlMode): void;
  manualMove(delta: { x?: number; y?: number; z?: number }): Promise<unknown>;
}

export class DashboardServer {
  private server = createServer((req, res) => this.handle(req, res));

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly api: DashboardApi,
    private readonly log: Logger,
  ) {}

  start(): void {
    this.server.listen(this.port, this.host, () => {
      this.log.info("connection", `supervisor listening on ${this.host}:${this.port}`);
    });
  }

  stop(): void {
    this.server.close();
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    try {
      if (url.pathname === "/api/state" && req.method === "GET") return json(res, this.api.snapshot());
      if (url.pathname === "/api/world" && req.method === "GET") return json(res, this.api.world());
      if (url.pathname === "/api/xbox" && req.method === "GET") return json(res, this.api.xboxStatus());
      if (url.pathname === "/api/xbox/start" && req.method === "POST") return json(res, await this.api.xboxStart());
      if (url.pathname === "/api/realms" && req.method === "GET") return json(res, await this.api.listRealms());
      if (url.pathname === "/api/plan" && req.method === "POST") {
        const body = await readBody(req);
        return json(res, await this.api.plan(String((body as { intent?: string }).intent ?? "parede de stone bricks")));
      }
      if (url.pathname === "/api/start" && req.method === "POST") {
        this.api.start();
        return json(res, { ok: true });
      }
      if (url.pathname === "/api/pause" && req.method === "POST") {
        this.api.pause();
        return json(res, { ok: true });
      }
      if (url.pathname === "/api/resume" && req.method === "POST") {
        this.api.resume();
        return json(res, { ok: true });
      }
      if (url.pathname === "/api/continue" && req.method === "POST") {
        this.api.confirmResources();
        return json(res, { ok: true });
      }
      if (url.pathname === "/api/inject" && req.method === "POST") {
        const body = await readBody(req);
        this.api.inject((body as { kind?: "creeper" | "night" | "day" | "zombie" | "desync" }).kind ?? "creeper");
        return json(res, { ok: true });
      }
      if (url.pathname === "/api/disconnect" && req.method === "POST") {
        this.api.disconnectUser();
        return json(res, { ok: true });
      }
      if (url.pathname === "/api/emergency" && req.method === "POST") {
        this.api.emergency();
        return json(res, { ok: true });
      }
      if (url.pathname === "/api/connect" && req.method === "POST") {
        const body = (await readBody(req)) as Partial<ConnectionTarget>;
        if (Object.keys(body).length) this.api.configure(body);
        return json(res, await this.api.connectMinecraft());
      }
      if (url.pathname === "/api/configure" && req.method === "POST") {
        this.api.configure((await readBody(req)) as Partial<ConnectionTarget>);
        return json(res, { ok: true });
      }
      if (url.pathname === "/api/control" && req.method === "POST") {
        const body = (await readBody(req)) as { mode?: ControlMode };
        this.api.setControl(body.mode ?? "agent");
        return json(res, { ok: true });
      }
      if (url.pathname === "/api/manual/move" && req.method === "POST") {
        return json(res, await this.api.manualMove((await readBody(req)) as { x?: number; y?: number; z?: number }));
      }
      this.serveStatic(url.pathname, res);
    } catch (err) {
      json(res, { error: String(err) }, 500);
    }
  }

  private serveStatic(pathname: string, res: ServerResponse): void {
    const rel = pathname === "/" ? "/index.html" : pathname;
    const file = join(PUBLIC, rel.replace(/\.\./g, ""));
    if (!existsSync(file)) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const ext = extname(file);
    res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  }
}

function json(res: ServerResponse, body: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}
