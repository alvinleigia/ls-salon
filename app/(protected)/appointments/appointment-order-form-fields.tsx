"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { FormField } from "@/components/form-field"
import { Input } from "@/components/ui/input"
import type {
  AppointmentCustomerOption,
  AppointmentOrderFormValues,
  AppointmentServiceOption,
  AppointmentStaffOption,
  DiscountType,
} from "@/types/appointments"
import type { TaxRow } from "@/types/scheduling"
import {
  addCouponCode,
  createEmptyOrderLine,
  formatCurrencyCents,
} from "./appointment-order-form-model"

type AppointmentOrderFormFieldsProps = {
  values: AppointmentOrderFormValues
  setValues: React.Dispatch<React.SetStateAction<AppointmentOrderFormValues>>
  errors: Record<string, string>
  customers: AppointmentCustomerOption[]
  staff: AppointmentStaffOption[]
  services: AppointmentServiceOption[]
  couponOptions?: string[]
  taxOptions?: TaxRow[]
  onTaxTouched?: () => void
}

export function AppointmentOrderFormFields({
  values,
  setValues,
  errors,
  customers,
  staff,
  services,
  couponOptions = [],
  taxOptions = [],
  onTaxTouched,
}: AppointmentOrderFormFieldsProps) {
  const update = <K extends keyof AppointmentOrderFormValues>(
    key: K,
    value: AppointmentOrderFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Service items</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setValues((prev) => ({
                ...prev,
                lines: [...prev.lines, createEmptyOrderLine()],
              }))
            }
          >
            Add item
          </Button>
        </div>

        <div className="space-y-3">
          {values.lines.map((line, index) => (
            <div key={line.id} className="rounded-lg border bg-background p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Item {index + 1}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <FormField id={`line-service-${line.id}`} label="Service">
                  <select
                    id={`line-service-${line.id}`}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={line.serviceId}
                    onChange={(event) => {
                      const service = services.find((item) => item.id === event.target.value)
                      setValues((prev) => ({
                        ...prev,
                        lines: prev.lines.map((item) =>
                          item.id === line.id
                            ? {
                                ...item,
                                serviceId: event.target.value,
                                durationMinutes: service?.durationMinutes ?? 0,
                                unitPriceCents: service?.priceCents ?? item.unitPriceCents,
                              }
                            : item
                        ),
                      }))
                    }}
                  >
                    <option value="">Select service</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} ({service.durationMinutes}m)
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField id={`line-staff-${line.id}`} label="Attendant">
                  <select
                    id={`line-staff-${line.id}`}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={line.staffId}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        lines: prev.lines.map((item) =>
                          item.id === line.id ? { ...item, staffId: event.target.value } : item
                        ),
                      }))
                    }
                  >
                    <option value="">Select attendant</option>
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name?.trim() || member.email}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField id={`line-qty-${line.id}`} label="Qty">
                  <Input
                    id={`line-qty-${line.id}`}
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        lines: prev.lines.map((item) =>
                          item.id === line.id
                            ? { ...item, quantity: Math.max(1, Number(event.target.value || 1)) }
                            : item
                        ),
                      }))
                    }
                  />
                </FormField>
                <FormField id={`line-price-${line.id}`} label="Unit price">
                  <Input
                    id={`line-price-${line.id}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={formatCurrencyCents(line.unitPriceCents)}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        lines: prev.lines.map((item) =>
                          item.id === line.id
                            ? {
                                ...item,
                                unitPriceCents: Math.max(
                                  0,
                                  Math.round(Number(event.target.value || 0) * 100)
                                ),
                              }
                            : item
                        ),
                      }))
                    }
                  />
                </FormField>
                <FormField id={`line-discount-type-${line.id}`} label="Discount type">
                  <select
                    id={`line-discount-type-${line.id}`}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={line.discountType}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        lines: prev.lines.map((item) =>
                          item.id === line.id
                            ? { ...item, discountType: event.target.value as DiscountType }
                            : item
                        ),
                      }))
                    }
                  >
                    <option value="NONE">None</option>
                    <option value="PERCENT">Percent</option>
                    <option value="AMOUNT">Amount</option>
                  </select>
                </FormField>
                <FormField id={`line-discount-value-${line.id}`} label="Discount value">
                  <Input
                    id={`line-discount-value-${line.id}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.discountValue}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        lines: prev.lines.map((item) =>
                          item.id === line.id
                            ? { ...item, discountValue: Math.max(0, Number(event.target.value || 0)) }
                            : item
                        ),
                      }))
                    }
                  />
                </FormField>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <FormField id={`line-note-${line.id}`} label="Line note">
                  <Input
                    id={`line-note-${line.id}`}
                    value={line.note}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        lines: prev.lines.map((item) =>
                          item.id === line.id ? { ...item, note: event.target.value } : item
                        ),
                      }))
                    }
                  />
                </FormField>
                <Button
                  variant="outline"
                  onClick={() =>
                    setValues((prev) => ({
                      ...prev,
                      lines: prev.lines.length > 1
                        ? prev.lines.filter((item) => item.id !== line.id)
                        : prev.lines,
                    }))
                  }
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Booking details</h2>
          <div className="space-y-3">
            <FormField id="order-customer" label="Customer" error={errors.customerId}>
              <select
                id="order-customer"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={values.customerId}
                onChange={(event) => update("customerId", event.target.value)}
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {(customer.name?.trim() || customer.email) + ` (${customer.email})`}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="order-date" label="Date">
              <Input
                id="order-date"
                type="date"
                value={values.appointmentDate}
                onChange={(event) => update("appointmentDate", event.target.value)}
              />
            </FormField>
            <FormField id="order-start" label="Start time">
              <Input
                id="order-start"
                type="time"
                value={values.appointmentStartTime}
                onChange={(event) => update("appointmentStartTime", event.target.value)}
              />
            </FormField>
            <FormField id="order-coupon" label="Coupon code">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="order-coupon"
                    value={values.couponInput}
                    onChange={(event) => update("couponInput", event.target.value)}
                    placeholder="Enter code"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const nextCoupons = addCouponCode(values.coupons, values.couponInput)
                      setValues((prev) => ({
                        ...prev,
                        coupons: nextCoupons,
                        couponInput: "",
                      }))
                    }}
                  >
                    Apply
                  </Button>
                </div>
                {values.coupons.length ? (
                  <div className="flex flex-wrap gap-2">
                    {values.coupons.map((coupon) => (
                      <button
                        key={coupon.code}
                        type="button"
                        className="rounded-md border border-input px-2 py-1 text-xs"
                        onClick={() =>
                          setValues((prev) => ({
                            ...prev,
                            coupons: prev.coupons.filter((item) => item.code !== coupon.code),
                          }))
                        }
                      >
                        {coupon.code} x
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No coupons applied.</p>
                )}
                {couponOptions.length ? (
                  <p className="text-xs text-muted-foreground">
                    Available: {couponOptions.join(", ")}
                  </p>
                ) : null}
              </div>
            </FormField>
            <FormField id="order-customer-note" label="Customer note">
              <Input
                id="order-customer-note"
                value={values.customerNote}
                onChange={(event) => update("customerNote", event.target.value)}
              />
            </FormField>
            <FormField id="order-internal-note" label="Internal note">
              <Input
                id="order-internal-note"
                value={values.internalNote}
                onChange={(event) => update("internalNote", event.target.value)}
              />
            </FormField>
            <FormField id="order-taxes" label="Taxes">
              <div className="space-y-2">
                {taxOptions.length ? (
                  taxOptions.map((tax) => (
                    <label key={tax.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={values.taxIds.includes(tax.id)}
                        onChange={(event) => {
                          onTaxTouched?.()
                          setValues((prev) => ({
                            ...prev,
                            taxIds: event.target.checked
                              ? [...new Set([...prev.taxIds, tax.id])]
                              : prev.taxIds.filter((id) => id !== tax.id),
                          }))
                        }}
                      />
                      <span>{`${tax.name} (${tax.percent}%)`}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No active taxes configured. Add taxes from Settings &gt; Taxes.
                  </p>
                )}
              </div>
            </FormField>
          </div>
        </div>
      </div>
    </div>
  )
}
