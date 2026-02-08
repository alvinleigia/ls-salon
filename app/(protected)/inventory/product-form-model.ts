import type { InventoryProductFormValues } from "@/types/inventory"

export const inventoryProductStatusOptions = ["ACTIVE", "INACTIVE"] as const

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
