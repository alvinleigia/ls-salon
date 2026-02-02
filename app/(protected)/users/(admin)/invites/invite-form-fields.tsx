"use client"

import { FormField } from "@/components/form-field"
import { Input } from "@/components/ui/input"
import type { Role } from "@/lib/permissions"
import type { InviteFormValues } from "./invite-form-model"
import { inviteRoleOptions } from "./invite-form-model"

type InviteFormFieldsProps = {
  values: InviteFormValues
  errors: Record<string, string>
  onChange: (next: InviteFormValues) => void
}

export function InviteFormFields({ values, errors, onChange }: InviteFormFieldsProps) {
  const update = <K extends keyof InviteFormValues>(key: K, value: InviteFormValues[K]) => {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="grid gap-4">
      <FormField id="invite-email" label="Email" error={errors.email}>
        <Input
          id="invite-email"
          type="email"
          value={values.email}
          onChange={(event) => update("email", event.target.value)}
        />
      </FormField>
      <FormField id="invite-role" label="Role" error={errors.role}>
        <select
          id="invite-role"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={values.role}
          onChange={(event) => update("role", event.target.value as Role)}
        >
          {inviteRoleOptions.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </FormField>
    </div>
  )
}

