/**
 * Vanilla whitelist — DEFAULT DENY.
 *
 * The target server has mods. The agent MUST NOT interact with any block,
 * item or structure that is not explicitly recognized as Vanilla.
 *
 * Mechanism: whitelist, never a mod blacklist.
 *
 * Flow before ANY block interaction:
 *   1. identify (namespace + identifier + type + states)
 *   2. is Vanilla? (namespace === "minecraft")
 *   3. is on the whitelist?
 *   4. only then allow
 *
 * Unrecognized → do not break / place / replace / use / collect / modify.
 */

import { parseBlockId, type BlockRef, type BlockSnapshot, type Vec3 } from "./types.ts";

export const VANILLA_NAMESPACE = "minecraft";

/** Air / void / structure_void are readable but never "placed" as a material. */
export const PASSABLE_VANILLA = new Set([
  "minecraft:air",
  "minecraft:cave_air",
  "minecraft:void_air",
  "minecraft:structure_void",
  "minecraft:light_block",
  "minecraft:light_block_0",
  "minecraft:light_block_1",
  "minecraft:light_block_2",
  "minecraft:light_block_3",
  "minecraft:light_block_4",
  "minecraft:light_block_5",
  "minecraft:light_block_6",
  "minecraft:light_block_7",
  "minecraft:light_block_8",
  "minecraft:light_block_9",
  "minecraft:light_block_10",
  "minecraft:light_block_11",
  "minecraft:light_block_12",
  "minecraft:light_block_13",
  "minecraft:light_block_14",
  "minecraft:light_block_15",
]);

export const HAZARD_VANILLA = new Set([
  "minecraft:lava",
  "minecraft:flowing_lava",
  "minecraft:fire",
  "minecraft:soul_fire",
  "minecraft:magma",
  "minecraft:magma_block",
  "minecraft:cactus",
  "minecraft:sweet_berry_bush",
  "minecraft:wither_rose",
  "minecraft:campfire",
  "minecraft:soul_campfire",
  "minecraft:powder_snow",
]);

export const FLUID_VANILLA = new Set([
  "minecraft:water",
  "minecraft:flowing_water",
  "minecraft:lava",
  "minecraft:flowing_lava",
  "minecraft:bubble_column",
]);

/**
 * Explicit Vanilla identifiers the agent is allowed to manipulate.
 * Anything else — including unknown minecraft: ids not listed here — is denied.
 * This is intentional: new Vanilla blocks must be reviewed before automation.
 */
const RAW_WHITELIST = [
  // terrain / structure
  "air", "stone", "granite", "polished_granite", "diorite", "polished_diorite",
  "andesite", "polished_andesite", "deepslate", "cobbled_deepslate",
  "polished_deepslate", "calcite", "tuff", "dripstone_block", "grass_block",
  "dirt", "coarse_dirt", "rooted_dirt", "mud", "clay", "gravel", "sand",
  "red_sand", "sandstone", "chiseled_sandstone", "cut_sandstone", "smooth_sandstone",
  "red_sandstone", "chiseled_red_sandstone", "cut_red_sandstone", "smooth_red_sandstone",
  "bedrock", "cobblestone", "mossy_cobblestone", "stone_bricks", "mossy_stone_bricks",
  "cracked_stone_bricks", "chiseled_stone_bricks", "brick_block", "bricks",
  "mud_bricks", "packed_mud", "smooth_stone", "smooth_basalt", "basalt",
  "polished_basalt", "blackstone", "polished_blackstone", "polished_blackstone_bricks",
  "chiseled_polished_blackstone", "gilded_blackstone", "netherrack", "nether_bricks",
  "red_nether_bricks", "chiseled_nether_bricks", "cracked_nether_bricks",
  "end_stone", "end_bricks", "end_stone_bricks", "purpur_block", "purpur_pillar",
  "prismarine", "prismarine_bricks", "dark_prismarine", "quartz_block",
  "chiseled_quartz_block", "quartz_pillar", "smooth_quartz", "quartz_bricks",
  "obsidian", "crying_obsidian", "glowstone", "sea_lantern", "shroomlight",
  "amethyst_block", "budding_amethyst", "copper_block", "exposed_copper",
  "weathered_copper", "oxidized_copper", "cut_copper", "exposed_cut_copper",
  "weathered_cut_copper", "oxidized_cut_copper", "waxed_copper", "waxed_cut_copper",
  "iron_block", "gold_block", "diamond_block", "emerald_block", "lapis_block",
  "redstone_block", "coal_block", "netherite_block", "raw_iron_block",
  "raw_gold_block", "raw_copper_block", "bone_block", "hay_block", "dried_kelp_block",
  "honeycomb_block", "slime", "slime_block", "honey_block", "snow", "snow_layer",
  "ice", "packed_ice", "blue_ice", "glass", "tinted_glass", "white_stained_glass",
  "orange_stained_glass", "magenta_stained_glass", "light_blue_stained_glass",
  "yellow_stained_glass", "lime_stained_glass", "pink_stained_glass",
  "gray_stained_glass", "light_gray_stained_glass", "cyan_stained_glass",
  "purple_stained_glass", "blue_stained_glass", "brown_stained_glass",
  "green_stained_glass", "red_stained_glass", "black_stained_glass",
  "glass_pane", "white_stained_glass_pane", "orange_stained_glass_pane",
  "magenta_stained_glass_pane", "light_blue_stained_glass_pane",
  "yellow_stained_glass_pane", "lime_stained_glass_pane", "pink_stained_glass_pane",
  "gray_stained_glass_pane", "light_gray_stained_glass_pane", "cyan_stained_glass_pane",
  "purple_stained_glass_pane", "blue_stained_glass_pane", "brown_stained_glass_pane",
  "green_stained_glass_pane", "red_stained_glass_pane", "black_stained_glass_pane",
  "white_wool", "orange_wool", "magenta_wool", "light_blue_wool", "yellow_wool",
  "lime_wool", "pink_wool", "gray_wool", "light_gray_wool", "cyan_wool",
  "purple_wool", "blue_wool", "brown_wool", "green_wool", "red_wool", "black_wool",
  "white_concrete", "orange_concrete", "magenta_concrete", "light_blue_concrete",
  "yellow_concrete", "lime_concrete", "pink_concrete", "gray_concrete",
  "light_gray_concrete", "cyan_concrete", "purple_concrete", "blue_concrete",
  "brown_concrete", "green_concrete", "red_concrete", "black_concrete",
  "white_terracotta", "orange_terracotta", "magenta_terracotta", "light_blue_terracotta",
  "yellow_terracotta", "lime_terracotta", "pink_terracotta", "gray_terracotta",
  "light_gray_terracotta", "cyan_terracotta", "purple_terracotta", "blue_terracotta",
  "brown_terracotta", "green_terracotta", "red_terracotta", "black_terracotta",
  "terracotta", "white_glazed_terracotta", "orange_glazed_terracotta",
  "magenta_glazed_terracotta", "light_blue_glazed_terracotta",
  "yellow_glazed_terracotta", "lime_glazed_terracotta", "pink_glazed_terracotta",
  "gray_glazed_terracotta", "silver_glazed_terracotta", "cyan_glazed_terracotta",
  "purple_glazed_terracotta", "blue_glazed_terracotta", "brown_glazed_terracotta",
  "green_glazed_terracotta", "red_glazed_terracotta", "black_glazed_terracotta",
  // wood family
  "oak_log", "spruce_log", "birch_log", "jungle_log", "acacia_log", "dark_oak_log",
  "mangrove_log", "cherry_log", "pale_oak_log", "crimson_stem", "warped_stem",
  "stripped_oak_log", "stripped_spruce_log", "stripped_birch_log", "stripped_jungle_log",
  "stripped_acacia_log", "stripped_dark_oak_log", "stripped_mangrove_log",
  "stripped_cherry_log", "oak_wood", "spruce_wood", "birch_wood", "jungle_wood",
  "acacia_wood", "dark_oak_wood", "oak_planks", "spruce_planks", "birch_planks",
  "jungle_planks", "acacia_planks", "dark_oak_planks", "mangrove_planks",
  "cherry_planks", "bamboo_planks", "crimson_planks", "warped_planks", "pale_oak_planks",
  "oak_slab", "spruce_slab", "birch_slab", "jungle_slab", "acacia_slab",
  "dark_oak_slab", "mangrove_slab", "cherry_slab", "bamboo_slab", "crimson_slab",
  "warped_slab", "stone_slab", "stone_brick_slab", "cobblestone_slab", "brick_slab",
  "sandstone_slab", "red_sandstone_slab", "nether_brick_slab", "quartz_slab",
  "purpur_slab", "prismarine_slab", "mossy_cobblestone_slab", "smooth_stone_slab",
  "oak_stairs", "spruce_stairs", "birch_stairs", "jungle_stairs", "acacia_stairs",
  "dark_oak_stairs", "mangrove_stairs", "cherry_stairs", "bamboo_stairs",
  "crimson_stairs", "warped_stairs", "stone_stairs", "stone_brick_stairs",
  "cobblestone_stairs", "brick_stairs", "sandstone_stairs", "red_sandstone_stairs",
  "nether_brick_stairs", "quartz_stairs", "purpur_stairs", "prismarine_stairs",
  "oak_fence", "spruce_fence", "birch_fence", "jungle_fence", "acacia_fence",
  "dark_oak_fence", "mangrove_fence", "cherry_fence", "bamboo_fence",
  "crimson_fence", "warped_fence", "nether_brick_fence",
  "oak_fence_gate", "spruce_fence_gate", "birch_fence_gate", "jungle_fence_gate",
  "acacia_fence_gate", "dark_oak_fence_gate", "oak_door", "spruce_door",
  "birch_door", "jungle_door", "acacia_door", "dark_oak_door", "iron_door",
  "oak_trapdoor", "spruce_trapdoor", "birch_trapdoor", "jungle_trapdoor",
  "acacia_trapdoor", "dark_oak_trapdoor", "iron_trapdoor",
  "ladder", "scaffolding", "iron_bars", "chain",
  // functional vanilla
  "torch", "wall_torch", "soul_torch", "soul_wall_torch", "lantern", "soul_lantern",
  "campfire", "soul_campfire", "crafting_table", "furnace", "blast_furnace",
  "smoker", "chest", "trapped_chest", "ender_chest", "barrel", "hopper",
  "dropper", "dispenser", "observer", "piston", "sticky_piston", "lever",
  "stone_button", "oak_button", "stone_pressure_plate", "oak_pressure_plate",
  "heavy_weighted_pressure_plate", "light_weighted_pressure_plate",
  "redstone_wire", "redstone_torch", "redstone_lamp", "repeater",
  "unpowered_repeater", "powered_repeater", "comparator", "unpowered_comparator",
  "powered_comparator", "noteblock", "note_block", "jukebox", "lectern",
  "bookshelf", "chiseled_bookshelf", "enchanting_table", "anvil", "grindstone",
  "stonecutter_block", "stonecutter", "cartography_table", "fletching_table",
  "smithing_table", "loom", "composter", "cauldron", "bell", "beacon",
  "conduit", "lodestone", "respawn_anchor", "end_rod", "brewing_stand",
  "flower_pot", "frame", "glow_frame", "painting", "armor_stand",
  "oak_sign", "spruce_sign", "birch_sign", "standing_sign", "wall_sign",
  "oak_hanging_sign",
  // nature (place/break only when whitelisted)
  "oak_leaves", "spruce_leaves", "birch_leaves", "jungle_leaves", "acacia_leaves",
  "dark_oak_leaves", "azalea_leaves", "flowering_azalea_leaves", "mangrove_leaves",
  "cherry_leaves", "moss_block", "moss_carpet", "azalea", "flowering_azalea",
  "grass", "tall_grass", "fern", "large_fern", "deadbush", "dead_bush",
  "vine", "glow_lichen", "hanging_roots", "spore_blossom", "big_dripleaf",
  "small_dripleaf_block", "lily_pad", "waterlily", "seagrass", "kelp",
  "sugar_cane", "reeds", "cactus", "bamboo", "bamboo_block", "pumpkin",
  "carved_pumpkin", "lit_pumpkin", "melon_block", "melon", "hay_block",
  "wheat", "carrots", "potatoes", "beetroot", "sweet_berry_bush",
  "oak_sapling", "spruce_sapling", "birch_sapling", "jungle_sapling",
  "acacia_sapling", "dark_oak_sapling",
  "dandelion", "poppy", "blue_orchid", "allium", "azure_bluet", "red_tulip",
  "orange_tulip", "white_tulip", "pink_tulip", "oxeye_daisy", "cornflower",
  "lily_of_the_valley", "wither_rose", "sunflower", "lilac", "rose_bush",
  "peony", "pink_petals", "torchflower", "pitcher_plant",
  // deepslate family
  "deepslate_bricks", "cracked_deepslate_bricks", "deepslate_tiles",
  "cracked_deepslate_tiles", "chiseled_deepslate", "reinforced_deepslate",
  "deepslate_brick_stairs", "deepslate_brick_slab", "deepslate_tile_stairs",
  "deepslate_tile_slab", "cobbled_deepslate_stairs", "cobbled_deepslate_slab",
  "polished_deepslate_stairs", "polished_deepslate_slab",
  // copper bulbs / new decorative (1.21+)
  "copper_bulb", "exposed_copper_bulb", "weathered_copper_bulb", "oxidized_copper_bulb",
  "copper_grate", "copper_door", "copper_trapdoor", "tuff_bricks", "chiseled_tuff",
  "chiseled_tuff_bricks", "polished_tuff", "tuff_brick_stairs", "tuff_brick_slab",
  // rails / redstone extras
  "rail", "golden_rail", "detector_rail", "activator_rail", "tripwire_hook",
  "trip_wire", "daylight_detector", "daylight_detector_inverted", "target",
  "lightning_rod", "sculk_sensor", "calibrated_sculk_sensor",
  // walls
  "cobblestone_wall", "mossy_cobblestone_wall", "stone_brick_wall",
  "brick_wall", "nether_brick_wall", "sandstone_wall", "red_sandstone_wall",
  "prismarine_wall", "blackstone_wall", "polished_blackstone_wall",
  "polished_blackstone_brick_wall", "deepslate_brick_wall", "deepslate_tile_wall",
  "cobbled_deepslate_wall", "mud_brick_wall", "andesite_wall", "diorite_wall",
  "granite_wall",
  // carpet
  "white_carpet", "orange_carpet", "magenta_carpet", "light_blue_carpet",
  "yellow_carpet", "lime_carpet", "pink_carpet", "gray_carpet",
  "light_gray_carpet", "cyan_carpet", "purple_carpet", "blue_carpet",
  "brown_carpet", "green_carpet", "red_carpet", "black_carpet",
  // fluids (detect only — never place lava)
  "water", "flowing_water", "lava", "flowing_lava",
  "fire", "soul_fire", "magma", "magma_block",
] as const;

export const VANILLA_BLOCK_WHITELIST = new Set(
  RAW_WHITELIST.map((id) => `${VANILLA_NAMESPACE}:${id}`),
);

/** Tools / items the agent may select and use. */
const RAW_ITEM_WHITELIST = [
  "wooden_pickaxe", "stone_pickaxe", "iron_pickaxe", "golden_pickaxe",
  "diamond_pickaxe", "netherite_pickaxe",
  "wooden_axe", "stone_axe", "iron_axe", "golden_axe", "diamond_axe", "netherite_axe",
  "wooden_shovel", "stone_shovel", "iron_shovel", "golden_shovel",
  "diamond_shovel", "netherite_shovel",
  "wooden_hoe", "stone_hoe", "iron_hoe", "golden_hoe", "diamond_hoe", "netherite_hoe",
  "shears", "flint_and_steel", "bucket", "water_bucket", "clock", "compass",
  "recovery_compass", "torch", "scaffolding", "ladder", "ender_pearl",
  "bread", "cooked_beef", "cooked_porkchop", "golden_carrot", "baked_potato",
  "apple", "golden_apple", "cooked_chicken", "cooked_mutton", "cooked_salmon",
  "shield", "totem_of_undying",
  ...RAW_WHITELIST,
];

export const VANILLA_ITEM_WHITELIST = new Set(
  RAW_ITEM_WHITELIST.map((id) => (id.includes(":") ? id : `${VANILLA_NAMESPACE}:${id}`)),
);

export interface Identification {
  namespace: string;
  identifier: string;
  full: string;
  type: "block" | "item" | "unknown";
  vanilla: boolean;
  whitelisted: boolean;
  allowed: boolean;
  reason: string;
}

export function identify(id: string, type: "block" | "item" | "unknown" = "block"): Identification {
  const ref = parseBlockId(id);
  const full = `${ref.namespace}:${ref.identifier}`;
  const vanilla = ref.namespace === VANILLA_NAMESPACE;
  const list = type === "item" ? VANILLA_ITEM_WHITELIST : VANILLA_BLOCK_WHITELIST;
  const whitelisted = list.has(full);
  if (!vanilla) {
    return {
      namespace: ref.namespace,
      identifier: ref.identifier,
      full,
      type,
      vanilla: false,
      whitelisted: false,
      allowed: false,
      reason: "non_vanilla_namespace",
    };
  }
  if (!whitelisted) {
    return {
      namespace: ref.namespace,
      identifier: ref.identifier,
      full,
      type,
      vanilla: true,
      whitelisted: false,
      allowed: false,
      reason: "vanilla_but_not_whitelisted",
    };
  }
  return {
    namespace: ref.namespace,
    identifier: ref.identifier,
    full,
    type,
    vanilla: true,
    whitelisted: true,
    allowed: true,
    reason: "whitelisted_vanilla",
  };
}

export function isInteractionAllowed(id: string, type: "block" | "item" = "block"): boolean {
  return identify(id, type).allowed;
}

export function classifyHazard(id: string): BlockSnapshot["hazard"] {
  const full = id.includes(":") ? id : `${VANILLA_NAMESPACE}:${id}`;
  if (full === "minecraft:lava" || full === "minecraft:flowing_lava" || full === "minecraft:magma" || full === "minecraft:magma_block") {
    return "lava";
  }
  if (full === "minecraft:fire" || full === "minecraft:soul_fire") return "fire";
  if (full === "minecraft:cactus") return "cactus";
  if (full === "minecraft:water" || full === "minecraft:flowing_water") return "water";
  if (full === "minecraft:air" || full === "minecraft:cave_air" || full === "minecraft:void_air") return "none";
  return identify(full).allowed ? "none" : "unknown";
}

export function isSolid(id: string): boolean {
  const full = id.includes(":") ? id : `${VANILLA_NAMESPACE}:${id}`;
  if (PASSABLE_VANILLA.has(full) || FLUID_VANILLA.has(full)) return false;
  if (full.endsWith("_sign") || full.endsWith("_button") || full.endsWith("_pressure_plate")) return false;
  if (full === "minecraft:torch" || full === "minecraft:redstone_wire" || full === "minecraft:rail") return false;
  return identify(full).allowed;
}

export function snapshotBlock(id: string, position: Vec3, states?: BlockRef["states"]): BlockSnapshot {
  const info = identify(id, "block");
  return {
    namespace: info.namespace,
    identifier: info.identifier,
    states,
    position,
    vanilla: info.vanilla,
    whitelisted: info.whitelisted,
    solid: isSolid(info.full),
    hazard: classifyHazard(info.full),
  };
}

export function assertInteractable(id: string, type: "block" | "item" = "block"): Identification {
  const info = identify(id, type);
  if (!info.allowed) {
    const err = new Error(`Interaction denied: ${info.full} (${info.reason})`);
    (err as Error & { identification: Identification }).identification = info;
    throw err;
  }
  return info;
}
