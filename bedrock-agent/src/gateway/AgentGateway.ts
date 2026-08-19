/**
 * Agent Gateway — outbound persistent connection from the local PC to the cloud.
 *
 * Never opens an administrative inbound port to the internet.
 * Features: auth, session id, heartbeat, timeout, auto-reconnect,
 * message queue, ACK, idempotency, version check, duplicate suppression.
 */
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { PROTOCOL_VERSION, AGENT_SEMVER } from "../shared/version.ts";
import { isCompatibleProtocol } from "../shared/version.ts";
import {
  envelope,
  parseEnvelope,
  type Envelope,
  type MessageType,
  type PlanPayload,
  type CommandPayload,
} from "../shared/messages.ts";
import type { Logger } from "../shared/logger.ts";
import type { AgentConfig } from "../shared/config.ts";

export interface GatewayHandlers {
  onPlan: (plan: PlanPayload) => void;
  onCommand: (cmd: CommandPayload, env: Envelope) => Promise<unknown>;
  onResume: () => void;
  onPause: () => void;
  onCancel: () => void;
  onOpen: () => void;
  onClose: () => void;
}

const HEARTBEAT_MS = 5_000;
const TIMEOUT_MS = 20_000;
const RECONNECT_MIN = 1_000;
const RECONNECT_MAX = 30_000;

export class AgentGateway {
  private ws: WebSocket | null = null;
  private session: string = randomUUID();
  private seen = new Map<string, number>();
  private pending = new Map<string, Envelope>();
  private queue: Envelope[] = [];
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private timeoutTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoff = RECONNECT_MIN;
  private lastRx = 0;
  private seq = 0;
  private stopped = false;
  connected = false;
  authenticated = false;

  constructor(
    private readonly config: AgentConfig,
    private readonly log: Logger,
    private readonly handlers: GatewayHandlers,
    private readonly statusFn: () => { status: import("../shared/types.ts").AgentStatus; playerOnline: boolean },
  ) {}

  start(): void {
    this.stopped = false;
    this.open();
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    try {
      this.ws?.terminate();
    } catch {
      /* already closed */
    }
    this.ws = null;
    this.connected = false;
    this.authenticated = false;
  }

  private open(): void {
    if (this.stopped) return;
    this.log.info("connection", "opening outbound websocket to cloud", { url: this.config.cloudWsUrl });
    const ws = new WebSocket(this.config.cloudWsUrl);
    this.ws = ws;
    ws.on("open", () => {
      this.connected = true;
      this.backoff = RECONNECT_MIN;
      this.lastRx = Date.now();
      this.log.info("connection", "websocket open, sending hello");
      this.send(
        envelope(
          "hello",
          {
            agentId: this.config.agentId,
            agentVersion: AGENT_SEMVER,
            capabilities: [
              "protocols",
              "blueprint",
              "mcstructure",
              "holoprint-export",
              "vanilla-whitelist",
              "hostile-exit",
              "night-exit",
            ],
          },
          this.session,
          "agent",
        ),
      );
      this.startTimers();
      this.flush();
    });
    ws.on("message", (data) => {
      this.lastRx = Date.now();
      try {
        this.onMessage(String(data));
      } catch (err) {
        this.log.error("cloud", "failed to handle message", { err: String(err) });
      }
    });
    ws.on("close", () => {
      this.log.warn("connection", "cloud websocket closed");
      this.teardown();
      this.handlers.onClose();
      this.scheduleReconnect();
    });
    ws.on("error", (err) => {
      this.log.error("connection", "cloud websocket error", { err: String(err) });
    });
  }

  private teardown(): void {
    this.connected = false;
    this.authenticated = false;
    this.clearTimers();
    this.ws = null;
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    const wait = this.backoff;
    this.backoff = Math.min(this.backoff * 2, RECONNECT_MAX);
    this.log.info("reconnect", `reconnecting in ${wait}ms`);
    this.reconnectTimer = setTimeout(() => this.open(), wait);
  }

  private startTimers(): void {
    this.clearTimers();
    this.heartbeatTimer = setInterval(() => {
      const s = this.statusFn();
      this.send(envelope("heartbeat", { seq: ++this.seq, status: s.status, playerOnline: s.playerOnline }, this.session, "agent"));
    }, HEARTBEAT_MS);
    this.timeoutTimer = setInterval(() => {
      if (Date.now() - this.lastRx > TIMEOUT_MS) {
        this.log.warn("connection", "cloud heartbeat timeout");
        this.ws?.terminate();
      }
    }, 2_000);
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.timeoutTimer) clearInterval(this.timeoutTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.heartbeatTimer = this.timeoutTimer = this.reconnectTimer = null;
  }

  private onMessage(raw: string): void {
    const env = parseEnvelope(raw);
    if (!isCompatibleProtocol(env.v)) {
      this.log.error("security", "protocol version mismatch", { v: env.v, expected: PROTOCOL_VERSION });
      this.send(envelope("nack", { reason: "protocol_mismatch", v: env.v }, this.session, "agent"));
      return;
    }
    if (this.seen.has(env.idempotencyKey)) {
      this.log.debug("cloud", "duplicate message ignored", { id: env.id, key: env.idempotencyKey });
      this.ack(env);
      return;
    }
    this.seen.set(env.idempotencyKey, Date.now());
    this.pruneSeen();

    switch (env.type) {
      case "hello_ack":
        if (this.authenticated) break;
        this.send(
          envelope("auth", { token: this.config.agentToken, agentId: this.config.agentId }, this.session, "agent"),
        );
        break;
      case "auth_ok":
        if (this.authenticated) break;
        this.authenticated = true;
        this.session = String((env.payload as { session?: string })?.session ?? this.session);
        this.log.info("connection", "authenticated with cloud", { session: this.session });
        this.handlers.onOpen();
        this.flush();
        break;
      case "auth_fail":
        this.log.critical("security", "cloud rejected authentication");
        this.stopped = true;
        this.ws?.close();
        break;
      case "heartbeat":
      case "heartbeat_ack":
        break;
      case "ack":
        this.pending.delete((env.payload as { id?: string })?.id ?? env.ackOf ?? "");
        break;
      case "plan":
      case "blueprint":
        this.ack(env);
        this.handlers.onPlan(env.payload as PlanPayload);
        break;
      case "command":
        this.ack(env);
        void this.handleCommand(env);
        break;
      case "resume":
        this.ack(env);
        this.handlers.onResume();
        break;
      case "pause":
        this.ack(env);
        this.handlers.onPause();
        break;
      case "cancel":
        this.ack(env);
        this.handlers.onCancel();
        break;
      default:
        this.ack(env);
        this.log.debug("cloud", "unhandled type", { type: env.type });
    }
  }

  private async handleCommand(env: Envelope): Promise<void> {
    try {
      const result = await this.handlers.onCommand(env.payload as CommandPayload, env);
      this.send(envelope("ack", { id: env.id, result }, this.session, "agent", `ack:${env.id}`));
    } catch (err) {
      this.send(envelope("nack", { id: env.id, error: String(err) }, this.session, "agent"));
    }
  }

  private ack(env: Envelope): void {
    this.send(envelope("ack", { id: env.id }, this.session, "agent", `ack:${env.id}`));
  }

  send(env: Envelope): void {
    const ephemeral = env.type === "ack" || env.type === "heartbeat" || env.type === "hello" || env.type === "auth" || env.type === "nack";
    if (!ephemeral) this.pending.set(env.id, env);
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.queue.push(env);
      return;
    }
    this.ws.send(JSON.stringify(env));
  }

  emit(type: MessageType, payload: unknown): void {
    this.send(envelope(type, payload, this.session, "agent"));
  }

  private flush(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const waiting = [...this.queue, ...this.pending.values()];
    this.queue = [];
    const unique = new Map<string, Envelope>();
    for (const e of waiting) unique.set(e.id, e);
    for (const e of unique.values()) this.ws.send(JSON.stringify(e));
  }

  private pruneSeen(): void {
    if (this.seen.size < 2000) return;
    const cutoff = Date.now() - 10 * 60_000;
    for (const [k, ts] of this.seen) if (ts < cutoff) this.seen.delete(k);
  }
}
