/**
 * World snapshot for the Supervisor. Built from the SAME client the
 * executor uses. The cloud is never in this path.
 *
 * SimulatedClient: real local voxels.
 * ProtocolClient: only blocks the client has observed (placed/broken/
 * update_block). We never invent terrain the protocol did not give us.
 */
import type { LocalExecutor } from "../executor/LocalExecutor.ts";
import { worldPosition } from "../blueprint/Blueprint.ts";
import { evaluateStage } from "../executor/ResourceManager.ts";
import type { IMinecraftClient } from "./BedrockClient.ts";
import type {
  ActionItem,
  EntitySnapshot,
  LookState,
  PositionState,
  TimeSnapshot,
  Vec3,
  VisibleBlock,
} from "../shared/types.ts";

export interface WorldViewFrame {
  connected: boolean;
  position: Vec3;
  look: LookState;
  positionState: PositionState;
  time: TimeSnapshot;
  blocks: VisibleBlock[];
  entities: EntitySnapshot[];
  blueprint: Array<VisibleBlock & { placed: boolean }>;
  path: Vec3[];
  source: "simulated" | "protocol" | "fallback";
}

export function buildWorldView(client: IMinecraftClient, executor: LocalExecutor, radius = 20): WorldViewFrame {
  const pos = client.getPosition();
  const ghosts: Array<VisibleBlock & { placed: boolean }> = [];
  if (executor.blueprint) {
    for (const b of executor.blueprint.blocks) {
      if (b.block.identifier === "air") continue;
      const w = worldPosition(executor.blueprint, b.position);
      if (Math.abs(w.x - pos.x) > radius || Math.abs(w.z - pos.z) > radius) continue;
      ghosts.push({
        x: w.x,
        y: w.y,
        z: w.z,
        id: `${b.block.namespace}:${b.block.identifier}`,
        placed: !!b.placed,
      });
    }
  }
  return {
    connected: client.connected,
    position: pos,
    look: client.getLook(),
    positionState: client.getPositionState(),
    time: client.getTime(),
    blocks: client.getVisibleBlocks(radius, 3500),
    entities: client.getEntities(48),
    blueprint: ghosts,
    path: executor.lastPath,
    source: client.kind,
  };
}

export function materialPanel(executor: LocalExecutor, client: IMinecraftClient) {
  if (!executor.blueprint) return [];
  const stage =
    executor.blueprint.stages.find((s) => s.id === executor.mission.currentStageId) ?? executor.blueprint.stages[0];
  if (!stage) return [];
  return evaluateStage(stage, executor.blueprint, client.getInventory());
}

export interface SupervisorState {
  world: WorldViewFrame;
  actions: ActionItem[];
  currentAction: string | null;
  controlMode: import("../shared/types.ts").ControlMode;
  materials: ReturnType<typeof materialPanel>;
}
