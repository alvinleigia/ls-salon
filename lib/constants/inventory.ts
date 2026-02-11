export const INVENTORY_UNIT_OPTIONS = [
  "unit",
  "pcs",
  "ml",
  "l",
  "g",
  "kg",
  "pack",
  "box",
  "bottle",
  "tube",
  "jar",
] as const

export type InventoryUnit = (typeof INVENTORY_UNIT_OPTIONS)[number]
