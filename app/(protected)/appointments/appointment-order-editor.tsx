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
  AppointmentRow,
  AppointmentServiceOption,
  AppointmentStaffOption,
} from "@/types/appointments"
import type { TaxRow } from "@/types/scheduling"
import { AppointmentOrderFormFields } from "./appointment-order-form-fields"
import {
  calculateOrderTotals,
  calculateCouponDiscountFromCodes,
  defaultAppointmentOrderFormValues,
  formatCurrencyCents,
} from "./appointment-order-form-model"
import { combineLocalDateTimeToISO } from "./appointment-form-model"

type AppointmentOrderEditorProps = {
  mode: "create" | "edit"
  appointmentId?: string
}

export function AppointmentOrderEditor({ mode, appointmentId }: AppointmentOrderEditorProps) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(mode === "edit")
  const [saving, setSaving] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(appointmentId ?? null)
  const [values, setValues] = React.useState<AppointmentOrderFormValues>(
    defaultAppointmentOrderFormValues()
  )
  const [legacyAppointmentMode, setLegacyAppointmentMode] = React.useState(false)
  const [customers, setCustomers] = React.useState<AppointmentCustomerOption[]>([])
  const [staff, setStaff] = React.useState<AppointmentStaffOption[]>([])
  const [services, setServices] = React.useState<AppointmentServiceOption[]>([])
  const [coupons, setCoupons] = React.useState<CouponRow[]>([])
  const [taxes, setTaxes] = React.useState<TaxRow[]>([])
  const [taxesTouched, setTaxesTouched] = React.useState(false)
  const { errors } = useFormErrors()

  const totals = React.useMemo(() => {
    const base = calculateOrderTotals(values.lines)
    const couponDiscountCents = calculateCouponDiscountFromCodes(
      Math.max(0, base.subtotalCents - base.lineDiscountCents),
      values.coupons,
      coupons.map((coupon) => ({
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      }))
    )
    const selectedTaxes = taxes.filter((tax) => values.taxIds.includes(tax.id))
    const withCoupon = calculateOrderTotals(values.lines, couponDiscountCents)
    const discountedSubtotal = Math.max(
      0,
      withCoupon.subtotalCents - withCoupon.lineDiscountCents - withCoupon.couponDiscountCents
    )
    const taxCents = selectedTaxes.reduce(
      (sum, tax) => sum + Math.round((discountedSubtotal * tax.percent) / 100),
      0
    )
    return {
      ...withCoupon,
      taxCents,
      totalCents: Math.max(0, discountedSubtotal + taxCents),
    }
  }, [coupons, taxes, values.coupons, values.lines, values.taxIds])

  React.useEffect(() => {
    const loadLookups = async () => {
      const [customerRes, staffRes, serviceRes, couponRes, taxesRes] = await Promise.all([
        fetch("/api/users?role=CUSTOMER&status=ACTIVE&page=1&pageSize=100", {
          cache: "no-store",
        }),
        fetch("/api/users?role=STAFF&status=ACTIVE&page=1&pageSize=100", {
          cache: "no-store",
        }),
        fetch("/api/services?status=ACTIVE&page=1&pageSize=100&sort=name&order=asc", {
          cache: "no-store",
        }),
        fetch("/api/appointments/coupons?page=1&pageSize=100", {
          cache: "no-store",
        }),
        fetch("/api/settings/taxes?page=1&pageSize=100&active=true", { cache: "no-store" }),
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
            durationMinutes: number
            priceCents?: number
          }>
        }
        setServices(data.items ?? [])
      }

      if (couponRes.ok) {
        const data = (await couponRes.json()) as { items?: CouponRow[] }
        setCoupons(data.items ?? [])
      }

      if (taxesRes.ok) {
        const data = (await taxesRes.json()) as { items?: TaxRow[] }
        setTaxes(data.items ?? [])
      }
    }

    void loadLookups()
  }, [])

  React.useEffect(() => {
    if (mode !== "edit" || !appointmentId) return

    const load = async () => {
      setLoading(true)
      setEditingId(appointmentId)
      setLegacyAppointmentMode(false)
      setTaxesTouched(true)

      const orderResponse = await fetch(`/api/appointments/orders/${appointmentId}`, {
        cache: "no-store",
      })
      if (orderResponse.ok) {
        const data = (await orderResponse.json()) as { order?: AppointmentOrderRow }
        const order = data.order
        if (order) {
          const start = new Date(order.appointmentStartAt)
          setValues({
            customerId: order.customerId,
            appointmentDate: order.appointmentDate,
            appointmentStartTime: `${String(start.getHours()).padStart(2, "0")}:${String(
              start.getMinutes()
            ).padStart(2, "0")}`,
            couponInput: "",
            coupons: order.coupons.map((coupon) => ({ code: coupon.code })),
            taxIds: order.taxes.map((tax) => tax.taxId).filter((taxId): taxId is string => Boolean(taxId)),
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
              note: line.note ?? "",
            })),
          })
          setEditingId(order.id)
          setLoading(false)
          return
        }
      }

      const response = await fetch(`/api/appointments/${appointmentId}`, { cache: "no-store" })
      if (!response.ok) {
        toast.error("Unable to load booking.")
        setLoading(false)
        return
      }
      const data = (await response.json()) as { appointment?: AppointmentRow }
      const appointment = data.appointment
      if (!appointment) {
        toast.error("Booking not found.")
        setLoading(false)
        return
      }
      const start = new Date(appointment.startAt)
      setLegacyAppointmentMode(true)
      setEditingId(appointment.id)
      setValues({
        customerId: appointment.customerId,
        appointmentDate: start.toISOString().slice(0, 10),
        appointmentStartTime: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
        couponInput: "",
        coupons: [],
        taxIds: [],
        customerNote: "",
        internalNote: "",
        status: "CONFIRMED",
        lines: [
          {
            id: crypto.randomUUID(),
            serviceId: appointment.serviceId,
            staffId: appointment.staffProfile?.user?.id ?? "",
            quantity: 1,
            durationMinutes: appointment.service?.durationMinutes ?? 0,
            unitPriceCents: 0,
            discountType: "NONE",
            discountValue: 0,
            note: "",
          },
        ],
      })
      setLoading(false)
    }
    void load()
  }, [appointmentId, mode])

  React.useEffect(() => {
    if (!services.length) return
    if (taxesTouched) return

    const nextTaxIds = [
      ...new Set(
        values.lines.flatMap((line) => {
          const service = services.find((item) => item.id === line.serviceId)
          return service?.taxIds ?? []
        })
      ),
    ]

    if (nextTaxIds.join("|") === values.taxIds.join("|")) return
    setValues((prev) => ({ ...prev, taxIds: nextTaxIds }))
  }, [services, taxesTouched, values.lines, values.taxIds])

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

    if (legacyAppointmentMode && appointmentId) {
      const firstLine = values.lines[0]
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: values.customerId,
          serviceId: firstLine.serviceId,
          staffId: firstLine.staffId,
          startAt: combineLocalDateTimeToISO(values.appointmentDate, values.appointmentStartTime),
          status: target === "confirm" ? "CONFIRMED" : "SCHEDULED",
        }),
      })
      setSaving(false)
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        toast.error(data.error ?? "Unable to update booking.")
        return
      }
      toast.success("Booking updated.")
      return
    }

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
          taxIds: values.taxIds,
          lines: values.lines.map((line) => ({
            serviceId: line.serviceId,
            staffId: line.staffId,
            quantity: line.quantity,
            durationMinutes: line.durationMinutes,
            unitPriceCents: line.unitPriceCents,
            discountType: line.discountType,
            discountValue: line.discountValue,
            note: line.note,
          })),
        }),
      }
    )

    setSaving(false)

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      toast.error(data.error ?? "Unable to save booking.")
      return
    }

    const data = (await response.json()) as { order?: AppointmentOrderRow }
    const nextId = data.order?.id ?? editingId
    toast.success(target === "draft" ? "Draft saved." : "Booking confirmed.")
    if (nextId) {
      router.replace(`/appointments/${nextId}/edit`)
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading appointment...</div>
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
          <Button variant="outline" onClick={() => void handleSave("draft")} disabled={saving}>
            Save draft
          </Button>
          <Button onClick={() => void handleSave("confirm")} disabled={saving}>
            Confirm booking
          </Button>
        </div>
      </div>

      <AppointmentOrderFormFields
        values={values}
        setValues={setValues}
        errors={errors}
        customers={customers}
        staff={staff}
        services={services}
        couponOptions={coupons.map((coupon) => coupon.code)}
        taxOptions={taxes}
        onTaxTouched={() => setTaxesTouched(true)}
      />

      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Totals</h2>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="text-muted-foreground">Subtotal</div>
          <div className="text-right">{formatCurrencyCents(totals.subtotalCents)}</div>
          <div className="text-muted-foreground">Line discounts</div>
          <div className="text-right">- {formatCurrencyCents(totals.lineDiscountCents)}</div>
          <div className="text-muted-foreground">Coupon</div>
          <div className="text-right">- {formatCurrencyCents(totals.couponDiscountCents)}</div>
          <div className="text-muted-foreground">Tax</div>
          <div className="text-right">{formatCurrencyCents(totals.taxCents)}</div>
          <div className="font-semibold">Grand total</div>
          <div className="text-right font-semibold">{formatCurrencyCents(totals.totalCents)}</div>
        </div>
      </div>
    </div>
  )
}
