"use client"

import { FormField } from "@/components/form-field"
import { Input } from "@/components/ui/input"
import type { CategoryFormValues } from "@/types/services"
import { categoryStatusOptions } from "./category-form-model"

type CategoryFormFieldsProps = {
  mode: "create" | "edit"
  values: CategoryFormValues
  errors: Record<string, string>
  onChange: (next: CategoryFormValues) => void
}

export function CategoryFormFields({
  mode,
  values,
  errors,
  onChange,
}: CategoryFormFieldsProps) {
  const fieldId = (name: string) => (mode === "create" ? `category-${name}` : `edit-${name}`)

  return (
    <div className="grid gap-4">
      <FormField id={fieldId("name")} label="Name" error={errors.name}>
        <Input
          id={fieldId("name")}
          value={values.name}
          onChange={(event) => onChange({ ...values, name: event.target.value })}
        />
      </FormField>
      <FormField
        id={fieldId("description")}
        label="Description"
        error={errors.description}
      >
        <Input
          id={fieldId("description")}
          value={values.description}
          onChange={(event) => onChange({ ...values, description: event.target.value })}
        />
      </FormField>
      <FormField id={fieldId("status")} label="Status" error={errors.status}>
        <select
          id={fieldId("status")}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={values.status}
          onChange={(event) =>
            onChange({ ...values, status: event.target.value as CategoryFormValues["status"] })
          }
        >
          {categoryStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status === "ACTIVE" ? "Active" : "Inactive"}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id={fieldId("order")} label="Sort order" error={errors.sortOrder}>
        <Input
          id={fieldId("order")}
          type="number"
          min={0}
          value={values.sortOrder}
          onChange={(event) =>
            onChange({
              ...values,
              sortOrder: Number(event.target.value) || 0,
            })
          }
        />
      </FormField>
    </div>
  )
}
