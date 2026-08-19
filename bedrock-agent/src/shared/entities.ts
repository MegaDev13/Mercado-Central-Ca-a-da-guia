/**
 * Vanilla entity classification for Minecraft Bedrock.
 *
 * Source of truth: official Bedrock identifiers (minecraft: namespace).
 * The list is intentionally broader than the examples in the spec.
 * Unknown entities are treated as UNKNOWN — never assumed safe.
 *
 * Combat is forbidden. Hostile detection triggers local disconnect.
 */

export type EntityKind = "hostile" | "neutral" | "passive" | "player" | "projectile" | "item" | "vehicle" | "unknown";

const HOSTILE = [
  "creeper",
  "zombie",
  "husk",
  "drowned",
  "zombie_villager",
  "zombie_villager_v2",
  "skeleton",
  "stray",
  "wither_skeleton",
  "bogged",
  "spider",
  "cave_spider",
  "witch",
  "enderman",
  "phantom",
  "slime",
  "magma_cube",
  "blaze",
  "ghast",
  "guardian",
  "elder_guardian",
  "silverfish",
  "endermite",
  "shulker",
  "vindicator",
  "evocation_illager",
  "evoker",
  "vex",
  "pillager",
  "ravager",
  "illusioner",
  "hoglin",
  "zoglin",
  "piglin_brute",
  "warden",
  "breeze",
  "wither",
  "ender_dragon",
  "ender_crystal",
  "ghast",
  "blaze",
  "piglin",
  "zombie_pigman",
  "zombified_piglin",
  "creeper",
] as const;

const NEUTRAL = [
  "wolf",
  "polar_bear",
  "llama",
  "trader_llama",
  "goat",
  "bee",
  "panda",
  "dolphin",
  "iron_golem",
  "snow_golem",
] as const;

const PASSIVE = [
  "cow", "pig", "sheep", "chicken", "rabbit", "horse", "donkey", "mule",
  "cat", "ocelot", "parrot", "fox", "frog", "tadpole", "axolotl", "turtle",
  "squid", "glow_squid", "cod", "salmon", "tropicalfish", "pufferfish",
  "villager", "villager_v2", "wandering_trader", "bat", "strider",
  "allay", "camel", "sniffer", "armadillo", "mooshroom",
] as const;

const PROJECTILE = [
  "arrow", "thrown_trident", "snowball", "egg", "ender_pearl",
  "xp_bottle", "splash_potion", "lingering_potion", "fireball",
  "small_fireball", "dragon_fireball", "wither_skull", "shulker_bullet",
  "llama_spit", "fishing_hook", "wind_charge_projectile",
] as const;

const ITEM_LIKE = ["item", "xp_orb"];
const VEHICLE = ["boat", "chest_boat", "minecart", "chest_minecart", "hopper_minecart", "tnt_minecart"];

function setOf(ids: readonly string[]): Set<string> {
  return new Set(ids.map((id) => `minecraft:${id}`));
}

export const HOSTILE_VANILLA = setOf(HOSTILE);
export const NEUTRAL_VANILLA = setOf(NEUTRAL);
export const PASSIVE_VANILLA = setOf(PASSIVE);
export const PROJECTILE_VANILLA = setOf(PROJECTILE);
export const ITEM_VANILLA = setOf(ITEM_LIKE);
export const VEHICLE_VANILLA = setOf(VEHICLE);

export const CREEPER_IDS = new Set(["minecraft:creeper"]);

export function normalizeEntityId(id: string): string {
  if (!id) return "unknown:unknown";
  return id.includes(":") ? id.toLowerCase() : `minecraft:${id.toLowerCase()}`;
}

export function classifyEntity(id: string): EntityKind {
  const full = normalizeEntityId(id);
  const [ns] = full.split(":");
  if (ns !== "minecraft") return "unknown";
  if (full === "minecraft:player") return "player";
  if (HOSTILE_VANILLA.has(full)) return "hostile";
  if (NEUTRAL_VANILLA.has(full)) return "neutral";
  if (PASSIVE_VANILLA.has(full)) return "passive";
  if (PROJECTILE_VANILLA.has(full)) return "projectile";
  if (ITEM_VANILLA.has(full)) return "item";
  if (VEHICLE_VANILLA.has(full)) return "vehicle";
  return "unknown";
}

export function isHostile(id: string): boolean {
  return classifyEntity(id) === "hostile";
}

export function isCreeper(id: string): boolean {
  return CREEPER_IDS.has(normalizeEntityId(id));
}

/** Daytime ticks considered safe to build. Bedrock: 0 sunrise, 1000 day, 6000 noon, 12000 sunset. */
export function classifyTimeOfDay(timeOfDay: number): {
  phase: "dawn" | "day" | "sunset" | "night";
  safeToBuild: boolean;
} {
  const t = ((timeOfDay % 24000) + 24000) % 24000;
  if (t >= 23000 || t < 0) return { phase: "dawn", safeToBuild: true };
  if (t < 11000) return { phase: "day", safeToBuild: true };
  if (t < 13000) return { phase: "sunset", safeToBuild: false };
  return { phase: "night", safeToBuild: false };
}
