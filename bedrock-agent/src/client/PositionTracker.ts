/**
 * Client-local position. The only legal sources are protocol packets
 * and the client's own predicted movement.
 *
 * Forbidden: /tp, /gamemode, /gamerule, showcoordinates, HUD scraping,
 * any admin command, any value invented by the cloud planner.
 */
import type { PositionState, Vec3 } from "../shared/types.ts";
import { distance } from "../shared/types.ts";

export const DESYNC_SOFT = 1.5;
export const DESYNC_HARD = 4;

const FORBIDDEN_COMMANDS = [
  "/tp",
  "/teleport",
  "/gamemode",
  "/gamerule",
  "/showcoordinates",
  "gamerule showcoordinates",
  "showcoordinates",
];

export function isForbiddenCommand(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  return FORBIDDEN_COMMANDS.some((c) => s === c || s.startsWith(c + " ") || s.includes(c));
}

export class PositionTracker {
  predicted: Vec3;
  server: Vec3 | null = null;
  source: PositionState["source"] = "unknown";
  updatedAt = 0;

  constructor(spawn: Vec3 = { x: 0, y: 64, z: 0 }) {
    this.predicted = { ...spawn };
  }

  /** Authoritative update from a movement/spawn packet. Never from chat/HUD. */
  acceptServer(pos: Vec3, source: PositionState["source"] = "protocol"): void {
    this.server = { ...pos };
    this.predicted = { ...pos };
    this.source = source;
    this.updatedAt = Date.now();
  }

  /** Local prediction after the client sent a move. */
  predict(pos: Vec3): void {
    this.predicted = { ...pos };
    if (this.source === "unknown") this.source = "prediction";
    this.updatedAt = Date.now();
  }

  desync(): number {
    if (!this.server) return 0;
    return distance(this.predicted, this.server);
  }

  snapshot(): PositionState {
    const desync = this.desync();
    return {
      predicted: { ...this.predicted },
      server: this.server ? { ...this.server } : null,
      source: this.source,
      desync,
      desyncing: desync >= DESYNC_SOFT,
      updatedAt: this.updatedAt,
    };
  }

  hardDesync(): boolean {
    return this.desync() >= DESYNC_HARD;
  }

  /** Trust the last server packet and drop the bad prediction. */
  resync(): Vec3 {
    if (this.server) this.predicted = { ...this.server };
    this.source = this.server ? "protocol" : this.source;
    this.updatedAt = Date.now();
    return { ...this.predicted };
  }
}
