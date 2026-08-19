import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Severity } from "./types.ts";

export type LogCategory =
  | "connection"
  | "disconnect"
  | "mission"
  | "block"
  | "entity"
  | "hostile"
  | "time"
  | "stage"
  | "resource"
  | "progress"
  | "error"
  | "reconnect"
  | "cloud"
  | "security"
  | "protocol";

export interface LogRecord {
  ts: string;
  level: Severity | "DEBUG";
  category: LogCategory;
  message: string;
  data?: Record<string, unknown>;
}

export class Logger {
  constructor(
    private readonly filePath: string,
    private readonly alsoConsole = true,
  ) {
    mkdirSync(dirname(filePath), { recursive: true });
  }

  write(level: LogRecord["level"], category: LogCategory, message: string, data?: Record<string, unknown>): void {
    const rec: LogRecord = {
      ts: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };
    const line = JSON.stringify(rec);
    try {
      appendFileSync(this.filePath, line + "\n", "utf8");
    } catch {
      /* persistence must never crash the agent */
    }
    if (this.alsoConsole) {
      const tag = `[${rec.ts}] [${level}] [${category}] ${message}`;
      if (level === "CRITICAL_ERROR") console.error(tag, data ?? "");
      else if (level === "WARNING" || level === "RECOVERABLE_ERROR") console.warn(tag, data ?? "");
      else console.log(tag, data ?? "");
    }
  }

  info(category: LogCategory, message: string, data?: Record<string, unknown>): void {
    this.write("INFO", category, message, data);
  }
  warn(category: LogCategory, message: string, data?: Record<string, unknown>): void {
    this.write("WARNING", category, message, data);
  }
  error(category: LogCategory, message: string, data?: Record<string, unknown>): void {
    this.write("RECOVERABLE_ERROR", category, message, data);
  }
  critical(category: LogCategory, message: string, data?: Record<string, unknown>): void {
    this.write("CRITICAL_ERROR", category, message, data);
  }
  debug(category: LogCategory, message: string, data?: Record<string, unknown>): void {
    this.write("DEBUG", category, message, data);
  }
}

export function defaultLogPath(dataDir: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return join(dataDir, "logs", `agent-${day}.jsonl`);
}
