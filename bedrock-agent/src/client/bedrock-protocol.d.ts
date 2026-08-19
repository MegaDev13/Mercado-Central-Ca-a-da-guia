declare module "bedrock-protocol" {
  export function createClient(opts: Record<string, unknown>): {
    on(event: string, cb: (...args: unknown[]) => void): void;
    close(): void;
    queue(name: string, payload: unknown): void;
    username?: string;
  };
  export function ping(opts: { host: string; port: number }): Promise<{ motd?: string; version?: string }>;
}
