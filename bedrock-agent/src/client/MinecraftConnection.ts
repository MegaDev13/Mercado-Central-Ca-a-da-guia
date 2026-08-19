/**
 * Single connection façade. The rest of the agent never branches on
 * "server vs realm" — only this object knows the destination.
 *
 * BedrockServerConnection and BedrockRealmConnection are the same
 * ProtocolClient with different createClient options. No second agent.
 */
import type { AgentConfig } from "../shared/config.ts";
import type { ConnectionMode, ConnectionTarget, DisconnectReason } from "../shared/types.ts";
import type { IMinecraftClient } from "./BedrockClient.ts";
import { ProtocolClient, type LiveDestination } from "./ProtocolClient.ts";
import { SimulatedClient } from "./SimulatedClient.ts";

export class MinecraftConnection {
  target: ConnectionTarget;
  readonly client: IMinecraftClient;
  lastKick: string | null = null;
  possibleSessionConflict = false;

  constructor(
    private readonly config: AgentConfig,
    client?: IMinecraftClient,
  ) {
    this.target = {
      mode: config.mcClient === "simulated" ? "simulated" : config.mcRealmId ? "realm" : "server",
      host: config.mcHost,
      port: config.mcPort,
      realmId: config.mcRealmId,
      realmInvite: config.mcRealmInvite,
      offline: config.mcOffline,
    };
    this.client = client ?? this.createClient();
    this.client.on("disconnect", (reason) => {
      this.lastKick = reason;
      this.possibleSessionConflict = /another|session|logged in|already/i.test(reason);
    });
  }

  private createClient(): IMinecraftClient {
    if (this.target.mode === "simulated") {
      return new SimulatedClient({ spawn: { x: 0, y: 64, z: 0 }, timeOfDay: 1000 });
    }
    return new ProtocolClient(this.config, () => this.destination());
  }

  configure(partial: Partial<ConnectionTarget>): void {
    this.target = { ...this.target, ...partial };
  }

  destination(): LiveDestination {
    return {
      mode: this.target.mode,
      host: this.target.host,
      port: this.target.port,
      realmId: this.target.realmId,
      realmInvite: this.target.realmInvite,
      offline: this.target.offline,
      username: this.config.mcUsername,
      version: this.config.mcVersion,
      profilesFolder: this.config.profilesDir,
    };
  }

  async connect(): Promise<void> {
    this.lastKick = null;
    this.possibleSessionConflict = false;
    await this.client.connect();
  }

  async disconnect(reason: DisconnectReason): Promise<void> {
    await this.client.disconnect(reason);
  }

  async reconnect(reason: DisconnectReason = "USER_REQUEST"): Promise<void> {
    if (this.client.connected) await this.client.disconnect(reason);
    await this.client.connect();
  }

  getStatus(): { mode: ConnectionMode; connected: boolean; kick: string | null; sessionConflict: boolean } {
    return {
      mode: this.target.mode,
      connected: this.client.connected,
      kick: this.lastKick,
      sessionConflict: this.possibleSessionConflict,
    };
  }
}
