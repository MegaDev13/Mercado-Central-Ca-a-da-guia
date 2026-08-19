/**
 * Microsoft / Xbox device-code authentication.
 *
 * Stores only prismarine-auth / bedrock-protocol cache files under
 * profilesDir. Never stores passwords or one-time codes on disk after
 * the flow completes. The UI never receives tokens.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { XboxProfilePublic } from "../shared/types.ts";
import type { Logger } from "../shared/logger.ts";

export interface RealmListItem {
  id: string;
  name: string;
  owner?: string;
  expired?: boolean;
}

interface StoredPublic {
  gamertag: string;
  xuid: string;
  authenticatedAt: string;
}

export class XboxAuth {
  status: XboxProfilePublic["status"] = "unauthenticated";
  gamertag: string | null = null;
  xuid: string | null = null;
  verificationUri: string | null = null;
  userCode: string | null = null;
  message: string | null = null;
  lastError: string | null = null;
  private pending: Promise<void> | null = null;

  constructor(
    private readonly profilesDir: string,
    private readonly username: string,
    private readonly log: Logger,
  ) {
    mkdirSync(profilesDir, { recursive: true });
    this.hydrateFromCache();
  }

  snapshot(): XboxProfilePublic {
    return {
      status: this.status,
      gamertag: this.gamertag,
      xuid: this.xuid,
      verificationUri: this.verificationUri,
      userCode: this.userCode,
      message: this.message,
    };
  }

  /** True when a reusable token cache exists. Tokens themselves stay off the UI. */
  hasCachedSession(): boolean {
    return this.status === "authenticated" && existsSync(this.publicPath());
  }

  async startDeviceCode(): Promise<XboxProfilePublic> {
    if (this.pending) return this.snapshot();
    this.status = "pending";
    this.lastError = null;
    this.pending = this.runFlow()
      .catch((err) => {
        this.status = "unauthenticated";
        this.lastError = err instanceof Error ? err.message : String(err);
        this.message = this.lastError;
        this.log.error("security", "xbox auth failed", { err: this.lastError });
      })
      .finally(() => {
        this.pending = null;
      });
    return this.snapshot();
  }

  private async runFlow(): Promise<void> {
    try {
      const auth = await import("prismarine-auth");
      const Titles = (auth as { Titles?: Record<string, string> }).Titles;
      const Authflow = (auth as { Authflow: new (...args: unknown[]) => AuthflowLike }).Authflow;
      const flow = new Authflow(
        this.username,
        this.profilesDir,
        liveFlowOptions(Titles),
        (res: DeviceCode) => {
          this.verificationUri = res.verification_uri ?? "https://www.microsoft.com/link";
          this.userCode = res.user_code ?? null;
          this.message = res.message ?? `Abra ${this.verificationUri} e informe o código ${this.userCode}`;
          this.status = "pending";
          writeLoginNote(this.verificationUri, this.userCode);
          this.log.info("security", "xbox device code issued — code is only shown, never stored as a credential");
        },
      );
      const xbl = await flow.getXboxToken();
      this.gamertag = String(xbl.userXUID ? xbl.displayName ?? this.username : this.username);
      this.xuid = xbl.userXUID ? String(xbl.userXUID) : null;
      if (xbl.displayName) this.gamertag = String(xbl.displayName);
      this.status = "authenticated";
      this.userCode = null;
      this.verificationUri = null;
      this.message = null;
      this.persistPublic();
      this.log.info("security", "xbox session cached", { gamertag: this.gamertag });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Cannot find package") || msg.includes("Cannot find module")) {
        throw new Error(
          "prismarine-auth não está instalado. Rode `npm i prismarine-auth` em bedrock-agent/ ou use o modo simulado.",
        );
      }
      throw err;
    }
  }

  async listRealms(): Promise<RealmListItem[]> {
    if (this.status !== "authenticated") return [];
    try {
      const auth = await import("prismarine-auth");
      const realms = await import("prismarine-realms");
      const Authflow = (auth as { Authflow: new (...args: unknown[]) => AuthflowLike }).Authflow;
      const RealmAPI = (realms as { RealmAPI: { from: (flow: unknown, kind: string) => RealmApiLike } }).RealmAPI;
      const Titles = (auth as { Titles?: Record<string, string> }).Titles;
      const flow = new Authflow(this.username, this.profilesDir, liveFlowOptions(Titles));
      const api = RealmAPI.from(flow, "bedrock");
      const list = await api.getRealms();
      return list.map((r) => ({
        id: String(r.id),
        name: String(r.name ?? r.id),
        owner: r.owner ? String(r.owner) : undefined,
        expired: Boolean(r.expired),
      }));
    } catch (err) {
      this.log.warn("connection", "could not list realms", { err: String(err) });
      return [];
    }
  }

  private publicPath(): string {
    return join(this.profilesDir, "public-profile.json");
  }

  private persistPublic(): void {
    if (!this.gamertag) return;
    const body: StoredPublic = {
      gamertag: this.gamertag,
      xuid: this.xuid ?? "",
      authenticatedAt: new Date().toISOString(),
    };
    writeFileSync(this.publicPath(), JSON.stringify(body, null, 2));
  }

  private hydrateFromCache(): void {
    const pub = this.publicPath();
    if (existsSync(pub)) {
      try {
        const data = JSON.parse(readFileSync(pub, "utf8")) as StoredPublic;
        this.gamertag = data.gamertag;
        this.xuid = data.xuid || null;
        this.status = "authenticated";
        return;
      } catch {
        /* ignore corrupt public profile */
      }
    }
    if (this.looksLikeTokenCache()) {
      this.status = "authenticated";
      this.gamertag = this.username;
    }
  }

  private looksLikeTokenCache(): boolean {
    if (!existsSync(this.profilesDir)) return false;
    return readdirSync(this.profilesDir).some((f) => f.endsWith("-cache.json") || f.endsWith("_live-cache.json"));
  }
}

interface DeviceCode {
  user_code?: string;
  device_code?: string;
  verification_uri?: string;
  message?: string;
}

interface AuthflowLike {
  getXboxToken(): Promise<{ userXUID?: string; displayName?: string }>;
}

/** Official Bedrock device-code title used by bedrock-protocol. */
export const BEDROCK_AUTH_TITLE = "00000000441cc96b";

export function liveFlowOptions(titles?: Record<string, string>): {
  flow: "live";
  authTitle: string;
  deviceType: string;
} {
  return {
    flow: "live",
    authTitle: titles?.MinecraftNintendoSwitch ?? BEDROCK_AUTH_TITLE,
    deviceType: "Nintendo",
  };
}

function writeLoginNote(uri: string | null, code: string | null): void {
  try {
    writeFileSync(
      join(process.cwd(), "XBOX_LOGIN.txt"),
      [
        "========================================",
        "LOGIN MICROSOFT / XBOX — AÇÃO DO USUÁRIO",
        "========================================",
        "",
        "1. Abra no navegador:",
        `   ${uri ?? "https://www.microsoft.com/link"}`,
        "2. Digite o código:",
        `   ${code ?? "(aguardando)"}`,
        "3. Autorize o app.",
        "4. Avise no chat: pronto.",
        "",
        "NÃO envie senha.",
        "NÃO envie o código de volta depois de usar.",
        "",
      ].join("\n"),
    );
  } catch {
    /* UI already shows the code */
  }
}

interface RealmApiLike {
  getRealms(): Promise<Array<{ id: string | number; name?: string; owner?: string; expired?: boolean }>>;
}
