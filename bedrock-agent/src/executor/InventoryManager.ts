/**
 * Deterministic local inventory manager.
 * Never consults the cloud for routine organization or tool selection.
 */
import { identify, isInteractionAllowed } from "../shared/whitelist.ts";
import type { InventorySnapshot, ItemStack } from "../shared/types.ts";

const PICKAXE = ["netherite_pickaxe", "diamond_pickaxe", "iron_pickaxe", "stone_pickaxe", "golden_pickaxe", "wooden_pickaxe"];
const AXE = ["netherite_axe", "diamond_axe", "iron_axe", "stone_axe", "golden_axe", "wooden_axe"];
const SHOVEL = ["netherite_shovel", "diamond_shovel", "iron_shovel", "stone_shovel", "golden_shovel", "wooden_shovel"];
const HOE = ["netherite_hoe", "diamond_hoe", "iron_hoe", "stone_hoe", "golden_hoe", "wooden_hoe"];

const PICK_BLOCKS = new Set([
  "stone", "cobblestone", "stone_bricks", "mossy_stone_bricks", "cracked_stone_bricks",
  "deepslate", "cobbled_deepslate", "andesite", "diorite", "granite", "sandstone",
  "bricks", "brick_block", "nether_bricks", "end_stone", "obsidian", "iron_ore",
  "coal_ore", "gold_ore", "diamond_ore", "copper_ore", "lapis_ore", "redstone_ore",
  "blackstone", "calcite", "tuff", "prismarine", "quartz_block", "smooth_stone",
]);
const AXE_BLOCKS = new Set([
  "oak_log", "spruce_log", "birch_log", "jungle_log", "acacia_log", "dark_oak_log",
  "oak_planks", "spruce_planks", "birch_planks", "jungle_planks", "acacia_planks",
  "dark_oak_planks", "oak_wood", "crafting_table", "chest", "barrel", "bookshelf",
  "oak_stairs", "oak_slab", "oak_fence", "oak_door", "oak_trapdoor",
]);
const SHOVEL_BLOCKS = new Set(["dirt", "grass_block", "sand", "red_sand", "gravel", "clay", "soul_sand", "soul_soil", "mud", "snow", "snow_layer"]);

export function countOf(inv: InventorySnapshot, identifier: string): number {
  const full = identifier.includes(":") ? identifier : `minecraft:${identifier}`;
  return inv.items
    .filter((i) => `${i.namespace}:${i.identifier}` === full)
    .reduce((s, i) => s + i.count, 0);
}

export function findItem(inv: InventorySnapshot, identifier: string): ItemStack | undefined {
  const full = identifier.includes(":") ? identifier : `minecraft:${identifier}`;
  return inv.items.find((i) => `${i.namespace}:${i.identifier}` === full && i.count > 0);
}

export function selectToolFor(inv: InventorySnapshot, blockIdentifier: string): ItemStack | null {
  const id = blockIdentifier.includes(":") ? blockIdentifier.split(":")[1] : blockIdentifier;
  const family = PICK_BLOCKS.has(id) ? PICKAXE : AXE_BLOCKS.has(id) ? AXE : SHOVEL_BLOCKS.has(id) ? SHOVEL : null;
  if (!family) return null;
  for (const tool of family) {
    const found = findItem(inv, tool);
    if (found && isInteractionAllowed(`minecraft:${tool}`, "item")) return found;
  }
  if (family === PICKAXE) {
    for (const tool of HOE) {
      const found = findItem(inv, tool);
      if (found) return found;
    }
  }
  return null;
}

export function organize(inv: InventorySnapshot): ItemStack[] {
  const priority = (item: ItemStack): number => {
    const id = item.identifier;
    if (id.includes("pickaxe") || id.includes("axe") || id.includes("shovel") || id === "shears") return 0;
    if (id === "torch" || id === "bread" || id.includes("cooked") || id === "golden_carrot") return 1;
    if (id.includes("door") || id.includes("glass")) return 3;
    return 2;
  };
  const kept = inv.items.filter((i) => {
    if (i.count <= 0) return false;
    return identify(`${i.namespace}:${i.identifier}`, "item").allowed;
  });
  kept.sort((a, b) => priority(a) - priority(b) || a.identifier.localeCompare(b.identifier));
  return kept.map((item, slot) => ({ ...item, slot }));
}

export function missingMaterials(
  required: Array<{ identifier: string; count: number }>,
  inv: InventorySnapshot,
): Array<{ identifier: string; required: number; available: number; deficit: number }> {
  return required
    .map((r) => {
      const available = countOf(inv, r.identifier);
      return {
        identifier: r.identifier.includes(":") ? r.identifier : `minecraft:${r.identifier}`,
        required: r.count,
        available,
        deficit: Math.max(0, r.count - available),
      };
    })
    .filter((m) => m.deficit > 0);
}
