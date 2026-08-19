declare module "prismarine-auth" {
  export class Authflow {
    constructor(
      username?: string,
      cache?: string,
      options?: Record<string, unknown>,
      codeCallback?: (res: {
        user_code?: string;
        device_code?: string;
        verification_uri?: string;
        message?: string;
      }) => void,
    );
    getXboxToken(): Promise<{ userXUID?: string; displayName?: string }>;
  }
}

declare module "prismarine-realms" {
  export const RealmAPI: {
    from(flow: unknown, kind: string): {
      getRealms(): Promise<Array<{ id: string | number; name?: string; owner?: string; expired?: boolean }>>;
    };
  };
}
