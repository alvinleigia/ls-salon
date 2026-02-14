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

