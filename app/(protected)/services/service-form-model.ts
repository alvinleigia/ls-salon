import type { ServiceFormValues, ServiceStatus, ServiceType } from "@/types/services"

export const serviceStatusOptions: ServiceStatus[] = ["ACTIVE", "INACTIVE"]

export const serviceTypeOptions: { value: ServiceType; label: string }[] = [
  { value: "STANDARD", label: "Standard" },
  { value: "PACKAGE", label: "Package" },
]

export const defaultServiceFormValues: ServiceFormValues = {
  name: "",
  description: "",
  categoryId: "",
  durationMinutes: 60,
  price: "0.00",
  status: "ACTIVE",
  type: "STANDARD",
  packageItemIds: [],
}
