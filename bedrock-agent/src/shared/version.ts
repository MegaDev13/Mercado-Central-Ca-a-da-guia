export const PROTOCOL_VERSION = 1;
export const AGENT_NAME = "bedrock-autonomous-agent";
export const AGENT_SEMVER = "0.1.0";

/** Versions the local agent will accept from the cloud. */
export function isCompatibleProtocol(version: number): boolean {
  return version === PROTOCOL_VERSION;
}
