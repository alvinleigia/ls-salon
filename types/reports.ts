export type CouponUsageReportStatus = "used" | "not_used"

export type CouponUsageReportRow = {
  customerId: string
  customerName: string | null
  customerEmail: string
  customerPhone: string | null
  customerStatus: "ACTIVE" | "SUSPENDED" | "INVITED" | "ARCHIVED"
  couponUsageCount: number
  distinctCouponCount: number
  usedCouponCodes: string[]
  lastCouponUsedAt: string | null
}

export type CouponUsageReportSummary = {
  totalCustomers: number
  usedCustomers: number
  notUsedCustomers: number
  totalRedemptions: number
}

export type AuditLogReportRow = {
  id: string
  event: string
  entityType: string
  entityId: string | null
  actorUserId: string | null
  actorRole: "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER" | null
  actorName: string | null
  actorEmail: string | null
  requestId: string | null
  metadata: unknown
  before: unknown
  after: unknown
  createdAt: string
}
