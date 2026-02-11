import type {
  AppointmentOrderCouponForm,
  AppointmentOrderFormValues,
  AppointmentOrderLineForm,
  AppointmentOrderProductLineForm,
  AppointmentOrderTotals,
  DiscountType,
} from "@/types/appointments"

const toTimeInput = (value: Date) => {
  const hours = String(value.getHours()).padStart(2, "0")
  const minutes = String(value.getMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}

export const createEmptyOrderLine = (): AppointmentOrderLineForm => ({
  id: crypto.randomUUID(),
  serviceId: "",
  staffId: "",
  quantity: 1,
  durationMinutes: 0,
  unitPriceCents: 0,
  discountType: "NONE",
  discountValue: 0,
  taxIds: [],
  taxMode: "EXCLUSIVE",
  lineTaxCents: 0,
  note: "",
})

export const createEmptyProductLine = (): AppointmentOrderProductLineForm => ({
  id: crypto.randomUUID(),
  productId: "",
  quantity: 1,
  unitPriceCents: 0,
  discountType: "NONE",
  discountValue: 0,
  taxIds: [],
  taxMode: "EXCLUSIVE",
  lineTaxCents: 0,
  note: "",
})

export const defaultAppointmentOrderFormValues = (): AppointmentOrderFormValues => {
  const now = new Date()
  return {
    customerId: "",
    appointmentDate: now.toISOString().slice(0, 10),
    appointmentStartTime: toTimeInput(now),
    couponInput: "",
    coupons: [],
    status: "DRAFT",
    customerNote: "",
    internalNote: "",
    lines: [createEmptyOrderLine()],
    productLines: [],
  }
}

const toDiscountCents = (
  discountType: DiscountType,
  discountValue: number,
  lineSubtotalCents: number
) => {
  if (discountType === "NONE" || discountValue <= 0) return 0
  if (discountType === "AMOUNT") {
    return Math.min(lineSubtotalCents, Math.round(discountValue * 100))
  }
  const percentDiscount = Math.round((lineSubtotalCents * discountValue) / 100)
  return Math.min(lineSubtotalCents, percentDiscount)
}

export const calculateOrderTotals = (
  lines: AppointmentOrderLineForm[],
  couponDiscountCents = 0,
  taxCents = 0
): AppointmentOrderTotals => {
  const subtotalCents = lines.reduce(
    (sum, line) => sum + Math.max(0, line.quantity) * Math.max(0, line.unitPriceCents),
    0
  )
  const lineDiscountCents = lines.reduce((sum, line) => {
    const lineSubtotal = Math.max(0, line.quantity) * Math.max(0, line.unitPriceCents)
    return sum + toDiscountCents(line.discountType, Math.max(0, line.discountValue), lineSubtotal)
  }, 0)
  const discountedSubtotal = Math.max(0, subtotalCents - lineDiscountCents - couponDiscountCents)
  const totalCents = Math.max(0, discountedSubtotal + taxCents)
  return { subtotalCents, lineDiscountCents, couponDiscountCents, taxCents, totalCents }
}

export const addCouponCode = (
  coupons: AppointmentOrderCouponForm[],
  rawCode: string
) => {
  const code = rawCode.trim().toUpperCase()
  if (!code) return coupons
  const exists = coupons.some((coupon) => coupon.code === code)
  if (exists) return coupons
  return [...coupons, { code }]
}

export const calculateCouponDiscountFromCodes = (
  baseAmountCents: number,
  coupons: AppointmentOrderCouponForm[],
  rules: Array<{ code: string; discountType: DiscountType; discountValue: number }>
) => {
  let runningBase = Math.max(0, baseAmountCents)
  const ruleMap = new Map(rules.map((rule) => [rule.code.trim().toUpperCase(), rule]))
  return coupons.reduce((sum, coupon) => {
    const rule = ruleMap.get(coupon.code)
    if (!rule) return sum
    let discountCents = 0
    if (rule.discountType === "AMOUNT") {
      discountCents = Math.min(runningBase, Math.round(rule.discountValue * 100))
    } else {
      discountCents = Math.min(
        runningBase,
        Math.round((runningBase * rule.discountValue) / 100)
      )
    }
    runningBase = Math.max(0, runningBase - discountCents)
    return sum + discountCents
  }, 0)
}

export const formatCurrencyCents = (value: number) => (value / 100).toFixed(2)
