"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useFormErrors } from "@/hooks/use-form-errors"
import type {
  AppointmentCustomerOption,
  CouponRow,
  AppointmentOrderRow,
  AppointmentOrderFormValues,
  AppointmentProductOption,
  AppointmentServiceOption,
  AppointmentStaffOption,
  TaxMode,
} from "@/types/appointments"
import type { AppSettingsPayload, TaxRow } from "@/types/scheduling"
import { formatCurrencyFromCents, formatTimeFromDate } from "@/lib/formatting"
import { AppointmentOrderFormFields } from "./appointment-order-form-fields"
import {
  calculateCouponDiscountFromCodes,
  defaultAppointmentOrderFormValues,
} from "./appointment-order-form-model"
import { combineLocalDateTimeToISO } from "./appointment-form-model"

type AppointmentOrderEditorProps = {
  mode: "create" | "edit"
  appointmentId?: string
}

type StartSuggestion = {
  suggestedStartAt: string
  reason: string
  requestKey: string
}

type LineScheduleSnapshot = Record<string, { startAt: string; endAt: string }>

const sumPercent = (percents: number[]) => percents.reduce((sum, value) => sum + Math.max(0, value), 0)

const extractTaxFromInclusiveGross = (grossCents: number, percents: number[]) => {
  const totalPercent = sumPercent(percents)
  if (grossCents <= 0 || totalPercent <= 0) return 0
  const netCents = Math.round((grossCents * 100) / (100 + totalPercent))
  return Math.max(0, grossCents - netCents)
}

const calculateExclusiveTaxFromNet = (netCents: number, percents: number[]) =>
  percents.reduce(
    (sum, percent) => sum + Math.max(0, Math.round((Math.max(0, netCents) * Math.max(0, percent)) / 100)),
    0
  )

const allocateCouponByWeight = (amounts: number[], couponCents: number) => {
  const total = amounts.reduce((sum, value) => sum + Math.max(0, value), 0)
  if (total <= 0 || couponCents <= 0) return amounts.map(() => 0)

  const rawAllocations = amounts.map((value) => ({
    base: Math.floor((couponCents * Math.max(0, value)) / total),
    remainder: (couponCents * Math.max(0, value)) % total,
  }))
  let assigned = rawAllocations.reduce((sum, item) => sum + item.base, 0)
  let remaining = couponCents - assigned
  const ranked = rawAllocations
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => b.remainder - a.remainder)
  for (let i = 0; i < ranked.length && remaining > 0; i += 1) {
    rawAllocations[ranked[i].index].base += 1
    remaining -= 1
    assigned += 1
  }
  return rawAllocations.map((item) => item.base)
}

const calculateDiscountCents = (
  discountType: "NONE" | "PERCENT" | "AMOUNT",
  discountValue: number,
  baseCents: number
) => {
  const normalizedBase = Math.max(0, baseCents)
  if (discountType === "NONE" || discountValue <= 0 || normalizedBase <= 0) return 0
  if (discountType === "AMOUNT") {
    return Math.min(normalizedBase, Math.round(discountValue * 100))
  }
  return Math.min(normalizedBase, Math.round((normalizedBase * discountValue) / 100))
}

const toDateInput = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const toTimeInput = (value: Date) => {
  const hours = String(value.getHours()).padStart(2, "0")
  const minutes = String(value.getMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}

const formatCouponScopeLabel = (coupon: CouponRow) => {
  if (coupon.appliesTo === "SERVICE_LINES") return "Services"
  if (coupon.appliesTo === "PRODUCT_LINES") return "Products"
  return "Order"
}

export function AppointmentOrderEditor({ mode, appointmentId }: AppointmentOrderEditorProps) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(mode === "edit")
  const [saving, setSaving] = React.useState(false)
  const [emailing, setEmailing] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(appointmentId ?? null)
  const [values, setValues] = React.useState<AppointmentOrderFormValues>(
    defaultAppointmentOrderFormValues()
  )
  const [customers, setCustomers] = React.useState<AppointmentCustomerOption[]>([])
  const [staff, setStaff] = React.useState<AppointmentStaffOption[]>([])
  const [services, setServices] = React.useState<AppointmentServiceOption[]>([])
  const [products, setProducts] = React.useState<AppointmentProductOption[]>([])
  const [coupons, setCoupons] = React.useState<CouponRow[]>([])
  const [taxes, setTaxes] = React.useState<TaxRow[]>([])
  const [startSuggestion, setStartSuggestion] = React.useState<StartSuggestion | null>(null)
  const [savedLineSchedule, setSavedLineSchedule] = React.useState<LineScheduleSnapshot>({})
  const [savedLineScheduleKey, setSavedLineScheduleKey] = React.useState<string | null>(null)
  const [settings, setSettings] = React.useState<AppSettingsPayload>({
    locale: "en-US",
    currency: "USD",
    currencySymbolPlacement: "BEFORE",
    numberFormat: "US_UK",
    timeFormat: "H24",
  })
  const { errors } = useFormErrors()

  const buildRequestKey = React.useCallback(
    (nextValues: AppointmentOrderFormValues) =>
      JSON.stringify({
        customerId: nextValues.customerId,
        appointmentDate: nextValues.appointmentDate,
        appointmentStartTime: nextValues.appointmentStartTime,
        lines: nextValues.lines.map((line) => ({
          serviceId: line.serviceId,
          staffId: line.staffId,
          quantity: line.quantity,
          durationMinutes: line.durationMinutes,
        })),
      }),
    []
  )

  const pricingPreview = React.useMemo(() => {
    const toLineBase = (
      quantity: number,
      unitPriceCents: number,
      discountType: "NONE" | "PERCENT" | "AMOUNT",
      discountValue: number
    ) => {
      const subtotalCents = Math.max(0, quantity) * Math.max(0, unitPriceCents)
      const discountCents =
        discountType === "NONE"
          ? 0
          : discountType === "AMOUNT"
            ? Math.round(Math.max(0, discountValue) * 100)
            : Math.round((subtotalCents * Math.max(0, discountValue)) / 100)
      return {
        subtotalCents,
        discountCents: Math.min(subtotalCents, Math.max(0, discountCents)),
      }
    }

    const serviceBase = values.lines.map((line) => {
      const base = toLineBase(
        line.quantity,
        line.unitPriceCents,
        line.discountType,
        line.discountValue
      )
      return {
        line,
        ...base,
        afterDiscountCents: Math.max(0, base.subtotalCents - base.discountCents),
      }
    })

    const productBase = (values.productLines ?? []).map((line) => {
      const base = toLineBase(
        line.quantity,
        line.unitPriceCents,
        line.discountType,
        line.discountValue
      )
      return {
        line,
        ...base,
        afterDiscountCents: Math.max(0, base.subtotalCents - base.discountCents),
      }
    })

    const serviceNetBeforeCoupon = serviceBase.map((entry) => {
      const percents = entry.line.taxIds
        .map((taxId) => taxes.find((tax) => tax.id === taxId)?.percent ?? 0)
      if (entry.line.taxMode === "INCLUSIVE") {
        return Math.max(
          0,
          entry.afterDiscountCents -
            extractTaxFromInclusiveGross(entry.afterDiscountCents, percents)
        )
      }
      return entry.afterDiscountCents
    })

    const productNetBeforeCoupon = productBase.map((entry) => {
      const percents = entry.line.taxIds
        .map((taxId) => taxes.find((tax) => tax.id === taxId)?.percent ?? 0)
      if (entry.line.taxMode === "INCLUSIVE") {
        return Math.max(
          0,
          entry.afterDiscountCents -
            extractTaxFromInclusiveGross(entry.afterDiscountCents, percents)
        )
      }
      return entry.afterDiscountCents
    })

    const allNetBeforeCoupon = [...serviceNetBeforeCoupon, ...productNetBeforeCoupon]
    const netSubtotalAfterDiscount = allNetBeforeCoupon.reduce((sum, value) => sum + value, 0)
    const couponDiscountCents = calculateCouponDiscountFromCodes(
      netSubtotalAfterDiscount,
      values.coupons,
      coupons.map((coupon) => ({
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      }))
    )
    const couponAllocations = allocateCouponByWeight(allNetBeforeCoupon, couponDiscountCents)
    const serviceCouponAllocations = couponAllocations.slice(0, serviceBase.length)
    const productCouponAllocations = couponAllocations.slice(serviceBase.length)
    const lineTaxCents = serviceBase.map((entry, index) => {
      const percents = entry.line.taxIds
        .map((taxId) => taxes.find((tax) => tax.id === taxId)?.percent ?? 0)
      const netAfterCoupon = Math.max(
        0,
        serviceNetBeforeCoupon[index] - serviceCouponAllocations[index]
      )
      return calculateExclusiveTaxFromNet(netAfterCoupon, percents)
    })
    const productLineTaxCents = productBase.map((entry, index) => {
      const percents = entry.line.taxIds
        .map((taxId) => taxes.find((tax) => tax.id === taxId)?.percent ?? 0)
      const netAfterCoupon = Math.max(
        0,
        productNetBeforeCoupon[index] - productCouponAllocations[index]
      )
      return calculateExclusiveTaxFromNet(netAfterCoupon, percents)
    })
    const taxCents =
      lineTaxCents.reduce((sum, value) => sum + value, 0) +
      productLineTaxCents.reduce((sum, value) => sum + value, 0)

    const subtotalCents = allNetBeforeCoupon.reduce((sum, value) => sum + value, 0)
    const lineDiscountCents =
      serviceBase.reduce((sum, entry) => sum + entry.discountCents, 0) +
      productBase.reduce((sum, entry) => sum + entry.discountCents, 0)
    const serviceTotalCents = serviceNetBeforeCoupon
      .map((netBeforeCoupon, index) =>
        Math.max(0, netBeforeCoupon - serviceCouponAllocations[index]) + lineTaxCents[index]
      )
      .reduce((sum, value) => sum + value, 0)
    const productTotalCents = productNetBeforeCoupon
      .map((netBeforeCoupon, index) =>
        Math.max(0, netBeforeCoupon - productCouponAllocations[index]) + productLineTaxCents[index]
      )
      .reduce((sum, value) => sum + value, 0)
    const totalCents = serviceTotalCents + productTotalCents
    return {
      totals: {
        subtotalCents,
        lineDiscountCents,
        couponDiscountCents,
        taxCents,
        totalCents,
      },
      lineTaxById: Object.fromEntries(
        values.lines.map((line, index) => [line.id, lineTaxCents[index] ?? 0])
      ) as Record<string, number>,
    }
  }, [coupons, taxes, values.coupons, values.lines, values.productLines])
  const totals = pricingPreview.totals

  const couponHints = React.useMemo(() => {
    if (!values.coupons.length) return []
    const serviceById = new Map(services.map((service) => [service.id, service]))
    const productById = new Map(products.map((product) => [product.id, product]))

    const toLineBase = (
      quantity: number,
      unitPriceCents: number,
      discountType: "NONE" | "PERCENT" | "AMOUNT",
      discountValue: number
    ) => {
      const subtotalCents = Math.max(0, quantity) * Math.max(0, unitPriceCents)
      const discountCents = calculateDiscountCents(discountType, Math.max(0, discountValue), subtotalCents)
      return {
        subtotalCents,
        discountCents,
        afterDiscountCents: Math.max(0, subtotalCents - discountCents),
      }
    }

    const serviceBase = values.lines.map((line) => {
      const base = toLineBase(line.quantity, line.unitPriceCents, line.discountType, line.discountValue)
      const percents = line.taxIds
        .map((taxId) => taxes.find((tax) => tax.id === taxId)?.percent ?? 0)
      return {
        line,
        ...base,
        netBeforeCoupon:
          line.taxMode === "INCLUSIVE"
            ? Math.max(0, base.afterDiscountCents - extractTaxFromInclusiveGross(base.afterDiscountCents, percents))
            : base.afterDiscountCents,
      }
    })

    const productBase = (values.productLines ?? []).map((line) => {
      const base = toLineBase(line.quantity, line.unitPriceCents, line.discountType, line.discountValue)
      const percents = line.taxIds
        .map((taxId) => taxes.find((tax) => tax.id === taxId)?.percent ?? 0)
      return {
        line,
        ...base,
        netBeforeCoupon:
          line.taxMode === "INCLUSIVE"
            ? Math.max(0, base.afterDiscountCents - extractTaxFromInclusiveGross(base.afterDiscountCents, percents))
            : base.afterDiscountCents,
      }
    })

    const couponByCode = new Map(coupons.map((coupon) => [coupon.code.toUpperCase(), coupon]))
    const scopeLines = [
      ...serviceBase.map((entry) => ({
        type: "SERVICE" as const,
        serviceId: entry.line.serviceId,
        categoryId: serviceById.get(entry.line.serviceId)?.categoryId,
      })),
      ...productBase.map((entry) => ({
        type: "PRODUCT" as const,
        productId: entry.line.productId,
        categoryId: productById.get(entry.line.productId)?.categoryId,
      })),
    ]
    const runningAmounts = [
      ...serviceBase.map((entry) => entry.netBeforeCoupon),
      ...productBase.map((entry) => entry.netBeforeCoupon),
    ]

    let hasAppliedAnyCoupon = false
    let hasAppliedExclusiveCoupon = false

    return values.coupons.map((applied) => {
      const coupon = couponByCode.get(applied.code.toUpperCase())
      if (!coupon) {
        return {
          code: applied.code,
          eligible: false,
          reason: "Coupon is not active or not found.",
        }
      }

      if (hasAppliedExclusiveCoupon) {
        return {
          code: applied.code,
          eligible: false,
          reason: "Another exclusive coupon is already applied.",
        }
      }

      if (coupon.stackingMode === "EXCLUSIVE" && hasAppliedAnyCoupon) {
        return {
          code: applied.code,
          eligible: false,
          reason: "Exclusive coupon cannot be combined with other coupons.",
        }
      }

      const eligibleIndices = runningAmounts
        .map((amount, index) => ({ amount, index }))
        .filter(({ amount, index }) => {
          if (amount <= 0) return false
          const line = scopeLines[index]
          if (coupon.appliesTo === "SERVICE_LINES" && line.type !== "SERVICE") return false
          if (coupon.appliesTo === "PRODUCT_LINES" && line.type !== "PRODUCT") return false

          if (line.type === "SERVICE") {
            if (coupon.allowedServiceIds.length && !coupon.allowedServiceIds.includes(line.serviceId)) {
              return false
            }
            if (coupon.allowedCategoryIds.length) {
              if (!line.categoryId || !coupon.allowedCategoryIds.includes(line.categoryId)) {
                return false
              }
            }
            return true
          }

          if (coupon.allowedProductIds.length && !coupon.allowedProductIds.includes(line.productId)) {
            return false
          }
          if (coupon.allowedCategoryIds.length) {
            if (!line.categoryId || !coupon.allowedCategoryIds.includes(line.categoryId)) {
              return false
            }
          }
          return true
        })
        .map(({ index }) => index)

      if (!eligibleIndices.length) {
        return {
          code: applied.code,
          eligible: false,
          reason: "No eligible services/products for this coupon.",
        }
      }

      const eligibleSubtotal = eligibleIndices.reduce((sum, index) => sum + runningAmounts[index], 0)
      if (eligibleSubtotal < coupon.minSubtotalCents) {
        return {
          code: applied.code,
          eligible: false,
          reason: `Minimum eligible subtotal is ${formatCurrencyFromCents(coupon.minSubtotalCents, settings)}.`,
        }
      }

      const discountCents = calculateDiscountCents(
        coupon.discountType,
        coupon.discountValue,
        eligibleSubtotal
      )
      if (discountCents <= 0) {
        return {
          code: applied.code,
          eligible: false,
          reason: "Coupon discount is zero for current cart values.",
        }
      }

      const allocations = allocateCouponByWeight(
        eligibleIndices.map((index) => runningAmounts[index]),
        discountCents
      )
      eligibleIndices.forEach((lineIndex, allocationIndex) => {
        runningAmounts[lineIndex] = Math.max(
          0,
          runningAmounts[lineIndex] - (allocations[allocationIndex] ?? 0)
        )
      })

      hasAppliedAnyCoupon = true
      if (coupon.stackingMode === "EXCLUSIVE") {
        hasAppliedExclusiveCoupon = true
      }

      return {
        code: applied.code,
        eligible: true,
        discountCents,
      }
    })
  }, [coupons, products, services, settings, taxes, values.coupons, values.lines, values.productLines])

  const requestKey = React.useMemo(
    () => buildRequestKey(values),
    [buildRequestKey, values]
  )

  const schedulePreview = React.useMemo(() => {
    if (!values.appointmentDate || !values.appointmentStartTime) return []
    const start = new Date(
      combineLocalDateTimeToISO(values.appointmentDate, values.appointmentStartTime)
    )
    if (Number.isNaN(start.getTime())) return []

    const formatTime = (value: Date) => formatTimeFromDate(value, settings)

    const useSavedSchedule = savedLineScheduleKey === requestKey
    let cursor = new Date(start)
    let previousEnd: Date | null = null
    return values.lines.map((line, index) => {
      const service = services.find((item) => item.id === line.serviceId)
      const staffMember = staff.find((member) => member.id === line.staffId)
      const durationMinutes = (service?.durationMinutes ?? line.durationMinutes ?? 0) * Math.max(1, line.quantity)
      const savedWindow = useSavedSchedule ? savedLineSchedule[line.id] : undefined
      const startsAt = savedWindow ? new Date(savedWindow.startAt) : new Date(cursor)
      const endsAt = savedWindow ? new Date(savedWindow.endAt) : new Date(cursor)
      if (!savedWindow) {
        endsAt.setMinutes(endsAt.getMinutes() + Math.max(0, durationMinutes))
      }
      const waitMinutes = previousEnd
        ? Math.max(0, Math.round((startsAt.getTime() - previousEnd.getTime()) / 60000))
        : 0
      cursor = endsAt
      previousEnd = endsAt
      return {
        id: line.id,
        index,
        serviceLabel: service?.name || "Service",
        staffLabel: staffMember?.name?.trim() || staffMember?.email || "Unassigned staff",
        startsAtLabel: formatTime(startsAt),
        endsAtLabel: formatTime(endsAt),
        waitMinutes,
        durationMinutes: Math.max(0, durationMinutes),
      }
    })
  }, [
    requestKey,
    savedLineSchedule,
    savedLineScheduleKey,
    settings,
    services,
    staff,
    values.appointmentDate,
    values.appointmentStartTime,
    values.lines,
  ])

  const scheduleMetaByLineId = React.useMemo(
    () =>
      Object.fromEntries(
        schedulePreview.map((slot) => [
          slot.id,
          {
            startsAtLabel: slot.startsAtLabel,
            endsAtLabel: slot.endsAtLabel,
            waitMinutes: slot.waitMinutes,
          },
        ])
      ),
    [schedulePreview]
  )

  const applyOrderToForm = React.useCallback(
    (order: AppointmentOrderRow) => {
      const start = new Date(order.appointmentStartAt)
      const nextValues: AppointmentOrderFormValues = {
        customerId: order.customerId,
        appointmentDate: order.appointmentDate,
        appointmentStartTime: `${String(start.getHours()).padStart(2, "0")}:${String(
          start.getMinutes()
        ).padStart(2, "0")}`,
        couponInput: "",
        coupons: order.coupons.map((coupon) => ({ code: coupon.code })),
        customerNote: order.customerNote ?? "",
        internalNote: order.internalNote ?? "",
        status: order.status,
        lines: order.lines.map((line) => ({
          id: line.id,
          serviceId: line.serviceId,
          staffId: line.staffProfile?.user?.id ?? "",
          quantity: line.quantity,
          durationMinutes: line.durationMinutes,
          unitPriceCents: line.unitPriceCents,
          discountType: line.discountType,
          discountValue: line.discountValue,
          taxIds: line.taxIds ?? [],
          taxMode: line.taxMode ?? "EXCLUSIVE",
          lineTaxCents: line.lineTaxCents ?? 0,
          note: line.note ?? "",
        })),
        productLines: (order.productLines ?? []).map((line) => ({
          id: line.id,
          productId: line.productId,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          discountType: line.discountType,
          discountValue: line.discountValue,
          taxIds: line.taxIds ?? [],
          taxMode: line.taxMode ?? "EXCLUSIVE",
          lineTaxCents: line.lineTaxCents ?? 0,
          note: line.note ?? "",
        })),
      }
      setValues(nextValues)
      setSavedLineSchedule(
        Object.fromEntries(
          order.lines.map((line) => [line.id, { startAt: line.startAt, endAt: line.endAt }])
        )
      )
      setSavedLineScheduleKey(buildRequestKey(nextValues))
      setEditingId(order.id)
    },
    [buildRequestKey]
  )

  React.useEffect(() => {
    const loadLookups = async () => {
      const [customerRes, staffRes, serviceRes, productRes, couponRes, taxesRes, settingsRes] = await Promise.all([
        fetch("/api/users?role=CUSTOMER&status=ACTIVE&page=1&pageSize=100", {
          cache: "no-store",
        }),
        fetch("/api/users?role=STAFF&status=ACTIVE&page=1&pageSize=100", {
          cache: "no-store",
        }),
        fetch("/api/services?status=ACTIVE&page=1&pageSize=100&sort=name&order=asc", {
          cache: "no-store",
        }),
        fetch("/api/inventory/products?status=ACTIVE&page=1&pageSize=100&sort=name&order=asc", {
          cache: "no-store",
        }),
        fetch("/api/appointments/coupons?page=1&pageSize=100&active=true", {
          cache: "no-store",
        }),
        fetch("/api/settings/taxes?page=1&pageSize=100&active=true", { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
      ])

      if (customerRes.ok) {
        const data = (await customerRes.json()) as {
          items?: Array<{ id: string; name: string | null; email: string }>
        }
        setCustomers(data.items ?? [])
      }

      if (staffRes.ok) {
        const data = (await staffRes.json()) as {
          items?: Array<{ id: string; name: string | null; email: string }>
        }
        setStaff(data.items ?? [])
      }

      if (serviceRes.ok) {
        const data = (await serviceRes.json()) as {
          items?: Array<{
            id: string
            name: string
            category?: { id: string }
            durationMinutes: number
            priceCents?: number
            taxMode?: TaxMode
            taxIds?: string[]
          }>
        }
        setServices((data.items ?? []).map((service) => ({
          id: service.id,
          name: service.name,
          categoryId: service.category?.id,
          durationMinutes: service.durationMinutes,
          priceCents: service.priceCents,
          taxMode: service.taxMode,
          taxIds: service.taxIds,
        })))
      }

      if (productRes.ok) {
        const data = (await productRes.json()) as {
          items?: Array<{
            id: string
            sku: string
            name: string
            category?: { id: string }
            mrpCents: number
            taxIds?: string[]
          }>
        }
        setProducts((data.items ?? []).map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          categoryId: product.category?.id,
          mrpCents: product.mrpCents,
          taxIds: product.taxIds,
        })))
      }

      if (couponRes.ok) {
        const data = (await couponRes.json()) as { items?: CouponRow[] }
        setCoupons(data.items ?? [])
      }

      if (taxesRes.ok) {
        const data = (await taxesRes.json()) as { items?: TaxRow[] }
        setTaxes(data.items ?? [])
      }

      if (settingsRes.ok) {
        const data = (await settingsRes.json()) as { settings?: AppSettingsPayload }
        if (data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }))
        }
      }
    }

    void loadLookups()
  }, [])

  React.useEffect(() => {
    if (mode !== "edit" || !appointmentId) return

    const load = async () => {
      setLoading(true)
      setEditingId(appointmentId)

      const orderResponse = await fetch(`/api/appointments/orders/${appointmentId}`, {
        cache: "no-store",
      })
      if (orderResponse.ok) {
        const data = (await orderResponse.json()) as { order?: AppointmentOrderRow }
        const order = data.order
        if (order) {
          applyOrderToForm(order)
          setLoading(false)
          return
        }
      }

      toast.error("Booking order not found.")
      setLoading(false)
    }
    void load()
  }, [appointmentId, applyOrderToForm, mode])

  const handleSave = async (target: "draft" | "confirm") => {
    if (!values.lines.length) {
      toast.error("Add at least one service item.")
      return
    }
    if (!values.customerId || !values.appointmentDate || !values.appointmentStartTime) {
      toast.error("Customer, date and start time are required.")
      return
    }

    setSaving(true)
    setStartSuggestion(null)

    const response = await fetch(
      editingId ? `/api/appointments/orders/${editingId}` : "/api/appointments/orders",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: values.customerId,
          appointmentDate: values.appointmentDate,
          appointmentStartTime: values.appointmentStartTime,
          appointmentStartAt: combineLocalDateTimeToISO(
            values.appointmentDate,
            values.appointmentStartTime
          ),
          status: target === "confirm" ? "CONFIRMED" : "DRAFT",
          customerNote: values.customerNote,
          internalNote: values.internalNote,
          coupons: values.coupons.map((coupon) => coupon.code),
          lines: values.lines.map((line) => ({
            serviceId: line.serviceId,
            staffId: line.staffId,
            quantity: line.quantity,
            durationMinutes: line.durationMinutes,
            unitPriceCents:
              line.unitPriceCents > 0
                ? line.unitPriceCents
                : services.find((service) => service.id === line.serviceId)?.priceCents ?? 0,
            discountType: line.discountType,
            discountValue: line.discountValue,
            taxMode: line.taxMode,
            taxIds: line.taxIds,
            note: line.note,
          })),
          productLines: (values.productLines ?? []).map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
            discountType: line.discountType,
            discountValue: line.discountValue,
            taxMode: line.taxMode,
            taxIds: line.taxIds,
            note: line.note,
          })),
        }),
      }
    )

    setSaving(false)

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string
        suggestedStartAt?: string
        canApplySuggestion?: boolean
      }
      if (
        target === "confirm" &&
        data.suggestedStartAt &&
        data.canApplySuggestion !== false
      ) {
        setStartSuggestion({
          suggestedStartAt: data.suggestedStartAt,
          reason: data.error ?? "Selected time is unavailable.",
          requestKey,
        })
      }
      toast.error(data.error ?? "Unable to save booking.")
      return
    }

    const data = (await response.json()) as { order?: AppointmentOrderRow }
    const nextId = data.order?.id ?? editingId
    if (data.order) {
      applyOrderToForm(data.order)
    }
    toast.success(target === "draft" ? "Draft saved." : "Booking confirmed.")
    if (nextId) {
      router.replace(`/appointments/${nextId}/edit`)
    }
  }

  const handlePrintInvoice = React.useCallback(() => {
    if (!editingId) {
      toast.error("Save the booking before printing the invoice.")
      return
    }
    window.open(`/api/appointments/orders/${editingId}/invoice`, "_blank", "noopener")
  }, [editingId])

  const handleEmailInvoice = React.useCallback(async () => {
    if (!editingId) {
      toast.error("Save the booking before emailing the invoice.")
      return
    }
    setEmailing(true)
    const response = await fetch(`/api/appointments/orders/${editingId}/invoice-email`, {
      method: "POST",
    })
    setEmailing(false)
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      toast.error(data.error ?? "Unable to email invoice.")
      return
    }
    toast.success("Invoice emailed.")
  }, [editingId])

  React.useEffect(() => {
    if (savedLineScheduleKey && savedLineScheduleKey !== requestKey) {
      setSavedLineSchedule({})
      setSavedLineScheduleKey(null)
    }
  }, [requestKey, savedLineScheduleKey])

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading appointment...</div>
  }

  const activeSuggestion =
    startSuggestion?.requestKey === requestKey ? startSuggestion : null

  const applySuggestedStart = (suggestion: StartSuggestion) => {
    const suggestedDate = new Date(suggestion.suggestedStartAt)
    if (Number.isNaN(suggestedDate.getTime())) return
    setValues((prev) => ({
      ...prev,
      appointmentDate: toDateInput(suggestedDate),
      appointmentStartTime: toTimeInput(suggestedDate),
    }))
    setStartSuggestion(null)
    toast.success("Applied next available start time.")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {mode === "create" ? "New booking" : "Edit booking"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Invoice-style booking with multiple services, attendants, notes, and coupons.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/appointments")}>
            Back
          </Button>
          <Button variant="outline" onClick={handlePrintInvoice} disabled={!editingId}>
            Print invoice
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleEmailInvoice()}
            loading={emailing}
            loadingText="Emailing..."
            disabled={!editingId}
          >
            Email invoice
          </Button>
          <Button variant="outline" onClick={() => void handleSave("draft")} loading={saving} loadingText="Saving...">
            Save draft
          </Button>
          <Button onClick={() => void handleSave("confirm")} loading={saving} loadingText="Saving...">
            Confirm booking
          </Button>
        </div>
      </div>

      {activeSuggestion ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
          <p className="text-amber-200">{activeSuggestion.reason}</p>
          <p className="mt-1 text-amber-200/90">
            Next available start:{" "}
            {`${toDateInput(new Date(activeSuggestion.suggestedStartAt))} ${formatTimeFromDate(
              new Date(activeSuggestion.suggestedStartAt),
              settings
            )}`}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => applySuggestedStart(activeSuggestion)}
          >
            Apply suggested time
          </Button>
        </div>
      ) : null}

      <AppointmentOrderFormFields
        values={values}
        setValues={setValues}
        errors={errors}
        customers={customers}
        staff={staff}
        services={services}
        products={products}
        timeFormat={settings.timeFormat}
        couponOptions={coupons.map((coupon) => ({
          value: coupon.code,
          label: `${coupon.code} (${formatCouponScopeLabel(coupon)})`,
        }))}
        couponHints={couponHints}
        formatCurrencyCentsValue={(valueInCents) => formatCurrencyFromCents(valueInCents, settings)}
        allowMultipleLines
        lineTaxCentsById={pricingPreview.lineTaxById}
        lineScheduleMeta={scheduleMetaByLineId}
      />

      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-1 text-sm font-semibold">Schedule preview</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Services are scheduled sequentially from the selected start time; wait gaps appear when a later slot is needed.
        </p>
        {schedulePreview.length ? (
          <div className="space-y-2">
            {schedulePreview.map((slot) => (
              <div
                key={slot.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <div className="font-medium">
                  {slot.index + 1}. {slot.serviceLabel}
                </div>
                <div className="text-xs text-muted-foreground">
                  {slot.staffLabel}
                </div>
                <div className="text-xs font-medium">
                  {slot.startsAtLabel} - {slot.endsAtLabel} ({slot.durationMinutes}m)
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Select date and start time to preview slots.
          </p>
        )}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Totals</h2>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="text-muted-foreground">Subtotal</div>
          <div className="text-right">{formatCurrencyFromCents(totals.subtotalCents, settings)}</div>
          <div className="text-muted-foreground">Line discounts</div>
          <div className="text-right">- {formatCurrencyFromCents(totals.lineDiscountCents, settings)}</div>
          <div className="text-muted-foreground">Coupon</div>
          <div className="text-right">- {formatCurrencyFromCents(totals.couponDiscountCents, settings)}</div>
          <div className="text-muted-foreground">Tax</div>
          <div className="text-right">{formatCurrencyFromCents(totals.taxCents, settings)}</div>
          <div className="font-semibold">Grand total</div>
          <div className="text-right font-semibold">{formatCurrencyFromCents(totals.totalCents, settings)}</div>
        </div>
      </div>
    </div>
  )
}
