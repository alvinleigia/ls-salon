import type { InventoryProductFormValues } from "@/types/inventory"
import { INVENTORY_UNIT_OPTIONS } from "@/lib/constants/inventory"

export const inventoryProductStatusOptions = ["ACTIVE", "INACTIVE"] as const
export const inventoryProductUnitOptions = INVENTORY_UNIT_OPTIONS

export const defaultInventoryProductFormValues: InventoryProductFormValues = {
  sku: "",
  name: "",
  description: "",
  unit: "unit",
  categoryId: "",
  status: "ACTIVE",
  costPrice: "0.00",
  mrp: "0.00",
  reorderPoint: 0,
  reorderQty: 0,
  onHandQty: 0,
  isPhysical: true,
  taxIds: [],
  supplierLinks: [],
}
