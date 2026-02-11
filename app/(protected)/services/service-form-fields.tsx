"use client"

import { FormField } from "@/components/form-field"
import { SearchableSelect } from "@/components/searchable-select"
import { Input } from "@/components/ui/input"
import type {
  CategoryOption,
  ServiceFormValues,
  ServiceOption,
} from "@/types/services"
import type { TaxRow } from "@/types/scheduling"
import {
  serviceStatusOptions,
  serviceTypeOptions,
} from "./service-form-model"

type ServiceFormFieldsProps = {
  mode: "create" | "edit"
  values: ServiceFormValues
  errors: Record<string, string>
  categories: CategoryOption[]
  serviceOptions: ServiceOption[]
  taxOptions: TaxRow[]
  packageQuery: string
  onPackageQueryChange: (value: string) => void
  onChange: (next: ServiceFormValues) => void
}

export function ServiceFormFields({
  mode,
  values,
  errors,
  categories,
  serviceOptions,
  taxOptions,
  packageQuery,
  onPackageQueryChange,
  onChange,
}: ServiceFormFieldsProps) {
  const update = <K extends keyof ServiceFormValues>(
    key: K,
    value: ServiceFormValues[K]
  ) => {
    onChange({ ...values, [key]: value })
  }

  const filteredOptions = (() => {
    const query = packageQuery.trim().toLowerCase()
    if (!query) return serviceOptions
    return serviceOptions.filter((option) =>
      option.name.toLowerCase().includes(query)
    )
  })()

  const fieldId = (name: string) => `${mode}-${name}`

  return (
    <div className="grid gap-4">
      <FormField id={fieldId("service-name")} label="Name" error={errors.name}>
        <Input
          id={fieldId("service-name")}
          value={values.name}
          onChange={(event) => update("name", event.target.value)}
        />
      </FormField>
      <FormField
        id={fieldId("service-description")}
        label="Description"
        error={errors.description}
      >
        <Input
          id={fieldId("service-description")}
          value={values.description}
          onChange={(event) => update("description", event.target.value)}
        />
      </FormField>
      <FormField
        id={fieldId("service-category")}
        label="Category"
        error={errors.categoryId}
      >
        <SearchableSelect
          id={fieldId("service-category")}
          value={values.categoryId}
          placeholder="Select a category"
          searchPlaceholder="Search category..."
          options={categories.map((category) => ({
            value: category.id,
            label: category.name,
          }))}
          onChange={(nextValue) => update("categoryId", nextValue)}
        />
      </FormField>
      <FormField
        id={fieldId("service-duration")}
        label="Duration (minutes)"
        error={errors.durationMinutes}
      >
        <Input
          id={fieldId("service-duration")}
          type="number"
          min={5}
          value={values.durationMinutes}
          onChange={(event) =>
            update("durationMinutes", Number(event.target.value) || 0)
          }
        />
      </FormField>
      <FormField id={fieldId("service-price")} label="Price" error={errors.priceCents}>
        <Input
          id={fieldId("service-price")}
          inputMode="decimal"
          value={values.price}
          onChange={(event) => update("price", event.target.value)}
        />
      </FormField>
      <FormField id={fieldId("service-status")} label="Status" error={errors.status}>
        <select
          id={fieldId("service-status")}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={values.status}
          onChange={(event) =>
            update("status", event.target.value as ServiceFormValues["status"])
          }
        >
          {serviceStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status === "ACTIVE" ? "Active" : "Inactive"}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id={fieldId("service-type")} label="Type" error={errors.type}>
        <select
          id={fieldId("service-type")}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={values.type}
          onChange={(event) => {
            const type = event.target.value as ServiceFormValues["type"]
            onChange({
              ...values,
              type,
              packageItemIds: type === "PACKAGE" ? values.packageItemIds : [],
            })
          }}
        >
          {serviceTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField id={fieldId("service-taxes")} label="Default taxes" error={errors.taxIds}>
        <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-input bg-background p-3 text-sm">
          {taxOptions.length ? (
            taxOptions.map((tax) => (
              <label key={tax.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.taxIds.includes(tax.id)}
                  onChange={(event) => {
                    const checked = event.target.checked
                    onChange({
                      ...values,
                      taxIds: checked
                        ? [...new Set([...values.taxIds, tax.id])]
                        : values.taxIds.filter((id) => id !== tax.id),
                    })
                  }}
                />
                <span>
                  {tax.name} ({tax.percent}%){tax.isActive ? "" : " - inactive"}
                </span>
              </label>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No taxes available.</p>
          )}
        </div>
      </FormField>
      <FormField id={fieldId("service-tax-mode")} label="Tax mode" error={errors.taxMode}>
        <select
          id={fieldId("service-tax-mode")}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={values.taxMode}
          onChange={(event) =>
            update("taxMode", event.target.value as ServiceFormValues["taxMode"])
          }
        >
          <option value="EXCLUSIVE">Exclusive (tax added on top)</option>
          <option value="INCLUSIVE">Inclusive (price includes tax)</option>
        </select>
      </FormField>

      {values.type === "PACKAGE" ? (
        <FormField
          id={fieldId("service-package-items")}
          label="Package items"
          error={errors.packageItemIds}
        >
          <div className="space-y-3">
            <Input
              placeholder="Search services..."
              value={packageQuery}
              onChange={(event) => onPackageQueryChange(event.target.value)}
            />
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-input bg-background p-3 text-sm">
              {filteredOptions.length ? (
                filteredOptions.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={values.packageItemIds.includes(option.id)}
                      onChange={(event) => {
                        const checked = event.target.checked
                        onChange({
                          ...values,
                          packageItemIds: checked
                            ? [...values.packageItemIds, option.id]
                            : values.packageItemIds.filter((id) => id !== option.id),
                        })
                      }}
                    />
                    <span>{option.name}</span>
                  </label>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  No eligible services found.
                </p>
              )}
            </div>
          </div>
        </FormField>
      ) : null}
    </div>
  )
}
