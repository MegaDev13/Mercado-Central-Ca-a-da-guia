import type { Blueprint, InventorySnapshot, MaterialNeed, StageSpec } from "../shared/types.ts";
import { countOf } from "./InventoryManager.ts";

export function tallyBlueprint(blueprint: Blueprint): MaterialNeed[] {
  const counts = new Map<string, number>();
  for (const b of blueprint.blocks) {
    if (b.block.identifier === "air" || b.block.identifier === "structure_void") continue;
    const id = `${b.block.namespace}:${b.block.identifier}`;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()].map(([identifier, required]) => ({
    identifier,
    required,
    available: 0,
    deficit: required,
  }));
}

export function evaluateStage(stage: StageSpec, blueprint: Blueprint, inv: InventorySnapshot): MaterialNeed[] {
  const counts = new Map<string, number>();
  for (const b of blueprint.blocks) {
    if (b.stageId !== stage.id) continue;
    if (b.placed) continue;
    if (b.block.identifier === "air" || b.block.identifier === "structure_void") continue;
    const id = `${b.block.namespace}:${b.block.identifier}`;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()].map(([identifier, required]) => {
    const available = countOf(inv, identifier);
    return { identifier, required, available, deficit: Math.max(0, required - available) };
  });
}

export function hasDeficit(needs: MaterialNeed[]): boolean {
  return needs.some((n) => n.deficit > 0);
}

export function formatResourceMessage(needs: MaterialNeed[]): string {
  const missing = needs.filter((n) => n.deficit > 0);
  const lines = missing.map((n) => `  ${displayName(n.identifier)}: ${n.deficit.toLocaleString("pt-BR")}`);
  return [
    "--------------------------------",
    "",
    "CONSTRUÇÃO PAUSADA",
    "",
    "Motivo:",
    "RECURSOS INSUFICIENTES",
    "",
    "Recursos necessários:",
    "",
    ...lines,
    "",
    "Adicione os recursos necessários ao inventário.",
    "",
    "Após adicionar os recursos:",
    "[CONTINUAR]",
    "",
    "--------------------------------",
  ].join("\n");
}

function displayName(id: string): string {
  const raw = id.includes(":") ? id.split(":")[1] : id;
  return raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
