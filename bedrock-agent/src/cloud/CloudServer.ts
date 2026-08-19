import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { PROTOCOL_VERSION, AGENT_SEMVER } from "../shared/version.ts";
import { isCompatibleProtocol } from "../shared/version.ts";
import { envelope, parseEnvelope, type Envelope, type PlanPayload } from "../shared/messages.ts";
import type { AgentConfig } from "../shared/config.ts";
import type { Logger } from "../shared/logger.ts";
import { generateBlueprint, type PlanRequest } from "./Planner.ts";

interface AgentLink {
  ws: WebSocket;
  session: string;
  agentId: string;
  authenticated: boolean;
  lastSeen: number;
}

export class CloudServer {
  private wss: WebSocketServer | null = null;
  private agents = new Map<WebSocket, AgentLink>();
  lastPlan: PlanPayload | null = null;
  events: Array<{ ts: string; kind: string; data: unknown }> = [];

  constructor(
    private readonly config: AgentConfig,
    private readonly log: Logger,
  ) {}

  start(): void {
    this.wss = new WebSocketServer({ host: this.config.cloudBindHost, port: this.config.cloudBindPort });
    this.wss.on("connection", (ws) => this.onConnection(ws));
    this.log.info("cloud", `planner listening on ${this.config.cloudBindHost}:${this.config.cloudBindPort}`);
  }

  stop(): void {
    for (const [ws] of this.agents) ws.close();
    this.agents.clear();
    this.wss?.close();
    this.wss = null;
  }

  private onConnection(ws: WebSocket): void {
    const link: AgentLink = {
      ws,
      session: randomUUID(),
      agentId: "unknown",
      authenticated: false,
      lastSeen: Date.now(),
    };
    this.agents.set(ws, link);
    this.log.info("cloud", "agent connecting", { session: link.session });

    ws.on("message", (raw) => {
      link.lastSeen = Date.now();
      try {
        this.handle(link, parseEnvelope(String(raw)));
      } catch (err) {
        this.log.error("cloud", "bad envelope from agent", { err: String(err) });
      }
    });
    ws.on("close", () => {
      this.log.warn("cloud", "agent disconnected", { agentId: link.agentId });
      this.agents.delete(ws);
    });
  }

  private handle(link: AgentLink, env: Envelope): void {
    if (!isCompatibleProtocol(env.v)) {
      this.send(link, envelope("nack", { reason: "protocol_mismatch" }, link.session, "cloud"));
      return;
    }
    switch (env.type) {
      case "hello":
        if (link.authenticated) break;
        this.send(
          link,
          envelope("hello_ack", { protocol: PROTOCOL_VERSION, cloud: AGENT_SEMVER }, link.session, "cloud"),
        );
        break;
      case "auth": {
        if (link.authenticated) break;
        const payload = env.payload as { token?: string; agentId?: string };
        if (payload.token !== this.config.agentToken) {
          this.send(link, envelope("auth_fail", { reason: "bad_token" }, link.session, "cloud"));
          link.ws.close();
          return;
        }
        link.authenticated = true;
        link.agentId = payload.agentId ?? link.agentId;
        this.send(link, envelope("auth_ok", { session: link.session }, link.session, "cloud"));
        this.log.info("cloud", "agent authenticated", { agentId: link.agentId });
        break;
      }
      case "heartbeat":
        this.send(link, envelope("heartbeat_ack", { ts: Date.now() }, link.session, "cloud"));
        break;
      case "event":
      case "state":
      case "progress":
      case "error":
      case "resource_request":
        this.events.unshift({ ts: new Date().toISOString(), kind: env.type, data: env.payload });
        this.events = this.events.slice(0, 200);
        this.log.info("cloud", `agent ${env.type}`, { payload: env.payload });
        break;
      case "ack":
      case "nack":
        break;
      default:
        this.log.debug("cloud", "ignored type", { type: env.type });
    }
  }

  planAndDispatch(req: PlanRequest): PlanPayload {
    const plan = generateBlueprint(req);
    const payload: PlanPayload = {
      missionId: plan.missionId,
      name: plan.name,
      intent: plan.intent,
      blueprint: plan.blueprint,
      notes: plan.notes,
    };
    this.lastPlan = payload;
    this.broadcast("plan", payload);
    return payload;
  }

  command(name: string, args: Record<string, unknown> = {}): void {
    this.broadcast("command", { name, args });
  }

  resume(): void {
    this.broadcast("resume", {});
  }
  pause(): void {
    this.broadcast("pause", {});
  }

  private broadcast(type: "plan" | "command" | "resume" | "pause" | "cancel", payload: unknown): void {
    for (const link of this.agents.values()) {
      if (!link.authenticated) continue;
      this.send(link, envelope(type, payload, link.session, "cloud"));
    }
  }

  private send(link: AgentLink, env: Envelope): void {
    if (link.ws.readyState === WebSocket.OPEN) link.ws.send(JSON.stringify(env));
  }

  snapshot(): {
    agents: number;
    lastPlan: { missionId: string; name: string; blocks: number } | null;
    events: Array<{ ts: string; kind: string; data: unknown }>;
  } {
    return {
      agents: [...this.agents.values()].filter((a) => a.authenticated).length,
      lastPlan: this.lastPlan
        ? { missionId: this.lastPlan.missionId, name: this.lastPlan.name, blocks: this.lastPlan.blueprint.blocks.length }
        : null,
      events: this.events,
    };
  }
}
