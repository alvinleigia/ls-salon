import type { CategoryFormValues, CategoryStatus } from "@/types/services"

export const categoryStatusOptions: CategoryStatus[] = ["ACTIVE", "INACTIVE"]

export const defaultCategoryFormValues: CategoryFormValues = {
  name: "",
  description: "",
  status: "ACTIVE",
  sortOrder: 0,
}
