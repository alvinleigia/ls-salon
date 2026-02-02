"use client"

import { FormField } from "@/components/form-field"
import { Input } from "@/components/ui/input"
import type {
  AppointmentStatus,
  AppointmentCustomerOption,
  AppointmentFormValues,
  AppointmentServiceOption,
  AppointmentStaffOption,
} from "@/types/appointments"

type AppointmentFormFieldsProps = {
  values: AppointmentFormValues
  errors: Record<string, string>
  customers: AppointmentCustomerOption[]
  services: AppointmentServiceOption[]
  staff: AppointmentStaffOption[]
  showStatus?: boolean
  disableParticipantFields?: boolean
  onChange: (next: AppointmentFormValues) => void
}

export function AppointmentFormFields({
  values,
  errors,
  customers,
  services,
  staff,
  showStatus = false,
  disableParticipantFields = false,
  onChange,
}: AppointmentFormFieldsProps) {
  const update = <K extends keyof AppointmentFormValues>(
    key: K,
    value: AppointmentFormValues[K]
  ) => {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="grid gap-4">
      <FormField id="appointment-customer" label="Customer" error={errors.customerId}>
        <select
          id="appointment-customer"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={values.customerId}
          disabled={disableParticipantFields}
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

      <FormField id="appointment-service" label="Service" error={errors.serviceId}>
        <select
          id="appointment-service"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={values.serviceId}
          disabled={disableParticipantFields}
          onChange={(event) => update("serviceId", event.target.value)}
        >
          <option value="">Select service</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} ({service.durationMinutes}m)
            </option>
          ))}
        </select>
      </FormField>

      <FormField id="appointment-staff" label="Staff attendant" error={errors.staffId}>
        <select
          id="appointment-staff"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={values.staffId}
          disabled={disableParticipantFields}
          onChange={(event) => update("staffId", event.target.value)}
        >
          <option value="">Select staff</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name?.trim() || member.email}
            </option>
          ))}
        </select>
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="appointment-date" label="Date" error={errors.date}>
          <Input
            id="appointment-date"
            type="date"
            value={values.date}
            onChange={(event) => update("date", event.target.value)}
          />
        </FormField>
        <FormField id="appointment-time" label="Start time" error={errors.startTime}>
          <Input
            id="appointment-time"
            type="time"
            value={values.startTime}
            onChange={(event) => update("startTime", event.target.value)}
          />
        </FormField>
      </div>

      {showStatus ? (
        <FormField id="appointment-status" label="Status" error={errors.status}>
          <select
            id="appointment-status"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={values.status}
            onChange={(event) => update("status", event.target.value as AppointmentStatus)}
          >
            <option value="SCHEDULED">SCHEDULED</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELED">CANCELED</option>
            <option value="NO_SHOW">NO_SHOW</option>
          </select>
        </FormField>
      ) : null}
    </div>
  )
}
