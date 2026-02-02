export type ServiceStatus = "ACTIVE" | "INACTIVE"
export type ServiceType = "STANDARD" | "PACKAGE"
export type CategoryStatus = "ACTIVE" | "INACTIVE"

export type CategoryOption = {
  id: string
  name: string
  status: CategoryStatus
}

export type CategoryRow = {
  id: string
  name: string
  description: string | null
  status: CategoryStatus
  sortOrder: number
  createdAt: string
}

export type CategoryFormValues = {
  name: string
  description: string
  status: CategoryStatus
  sortOrder: number
}

export type ServiceOption = {
  id: string
  name: string
}

export type ServiceRow = {
  id: string
  name: string
  description: string | null
  durationMinutes: number
  priceCents: number
  status: ServiceStatus
  type: ServiceType
  createdAt: string
  category: { id: string; name: string }
  packageItems?: { itemService: ServiceOption }[]
  taxIds?: string[]
}

export type ServiceFormValues = {
  name: string
  description: string
  categoryId: string
  durationMinutes: number
  price: string
  status: ServiceStatus
  type: ServiceType
  packageItemIds: string[]
  taxIds: string[]
}
