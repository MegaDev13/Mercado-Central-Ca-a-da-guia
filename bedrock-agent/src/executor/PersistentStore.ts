import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Blueprint, MissionState } from "../shared/types.ts";

export class PersistentStore {
  constructor(private readonly dataDir: string) {
    mkdirSync(join(dataDir, "missions"), { recursive: true });
    mkdirSync(join(dataDir, "blueprints"), { recursive: true });
  }

  missionPath(id: string): string {
    return join(this.dataDir, "missions", `${id}.json`);
  }
  blueprintPath(id: string): string {
    return join(this.dataDir, "blueprints", `${id}.json`);
  }

  saveMission(state: MissionState): void {
    atomicWrite(this.missionPath(state.missionId), JSON.stringify(state, null, 2));
    atomicWrite(join(this.dataDir, "missions", "current.json"), JSON.stringify({ id: state.missionId }, null, 2));
  }

  loadMission(id: string): MissionState | null {
    const p = this.missionPath(id);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf8")) as MissionState;
  }

  loadCurrentMission(): MissionState | null {
    const cur = join(this.dataDir, "missions", "current.json");
    if (!existsSync(cur)) return null;
    const { id } = JSON.parse(readFileSync(cur, "utf8")) as { id: string };
    return this.loadMission(id);
  }

  saveBlueprint(bp: Blueprint): void {
    atomicWrite(this.blueprintPath(bp.id), JSON.stringify(bp, null, 2));
  }

  loadBlueprint(id: string): Blueprint | null {
    const p = this.blueprintPath(id);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf8")) as Blueprint;
  }
}

function atomicWrite(path: string, contents: string): void {
  const tmp = path + ".tmp";
  writeFileSync(tmp, contents, "utf8");
  renameSync(tmp, path);
}
