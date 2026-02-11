"use client"

import { FormField } from "@/components/form-field"
import { Trash2Icon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ShiftTemplateBreak, ShiftTemplateForm } from "@/types/shifts"
import { templateStatusOptions } from "./template-form-model"

type TemplateFormFieldsProps = {
  mode: "create" | "edit"
  template: ShiftTemplateForm
  errors: Record<string, string>
  minStart: string
  maxEnd: string
  onChange: (next: ShiftTemplateForm) => void
  onAddBreak: () => void
  onUpdateBreak: (
    breakIndex: number,
    updater: (period: ShiftTemplateBreak) => ShiftTemplateBreak
  ) => void
  onRemoveBreak: (breakIndex: number) => void
}

export function TemplateFormFields({
  mode,
  template,
  errors,
  minStart,
  maxEnd,
  onChange,
  onAddBreak,
  onUpdateBreak,
  onRemoveBreak,
}: TemplateFormFieldsProps) {
  const fieldId = (name: string) => (mode === "create" ? name : `edit-${name}`)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={fieldId("template-name")} label="Name" error={errors.name}>
          <Input
            id={fieldId("template-name")}
            value={template.name}
            onChange={(event) => onChange({ ...template, name: event.target.value })}
          />
        </FormField>
        <FormField
          id={fieldId("template-description")}
          label="Description"
          error={errors.description}
        >
          <Input
            id={fieldId("template-description")}
            value={template.description}
            onChange={(event) =>
              onChange({ ...template, description: event.target.value })
            }
          />
        </FormField>
        <FormField id={fieldId("template-color")} label="Color" error={errors.color}>
          <Input
            id={fieldId("template-color")}
            type="color"
            value={template.color}
            onChange={(event) => onChange({ ...template, color: event.target.value })}
          />
        </FormField>
        <FormField id={fieldId("template-status")} label="Status" error={errors.isActive}>
          <select
            id={fieldId("template-status")}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={template.isActive ? "ACTIVE" : "INACTIVE"}
            onChange={(event) =>
              onChange({ ...template, isActive: event.target.value === "ACTIVE" })
            }
          >
            {templateStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status === "ACTIVE" ? "Active" : "Inactive"}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium">Shift timing</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <FormField id={fieldId("shift-start")} label="Start" error={errors.startTime}>
            <Input
              id={fieldId("shift-start")}
              type="time"
              min={minStart}
              max={maxEnd}
              value={template.startTime}
              onChange={(event) =>
                onChange({ ...template, startTime: event.target.value })
              }
            />
          </FormField>
          <FormField id={fieldId("shift-end")} label="End" error={errors.endTime}>
            <Input
              id={fieldId("shift-end")}
              type="time"
              min={minStart}
              max={maxEnd}
              value={template.endTime}
              onChange={(event) =>
                onChange({ ...template, endTime: event.target.value })
              }
            />
          </FormField>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Breaks</h3>
            <p className="text-xs text-muted-foreground">
              Optional breaks within the shift range.
            </p>
          </div>
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={onAddBreak}
          >
            Add break
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {template.breaks.map((period, index) => (
            <div
              key={`${mode}-break-${index}`}
              className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <FormField id={fieldId(`break-start-${index}`)} label="Start">
                <Input
                  id={fieldId(`break-start-${index}`)}
                  type="time"
                  min={template.startTime}
                  max={template.endTime}
                  value={period.startTime}
                  onChange={(event) =>
                    onUpdateBreak(index, (existing) => ({
                      ...existing,
                      startTime: event.target.value,
                    }))
                  }
                />
              </FormField>
              <FormField id={fieldId(`break-end-${index}`)} label="End">
                <Input
                  id={fieldId(`break-end-${index}`)}
                  type="time"
                  min={template.startTime}
                  max={template.endTime}
                  value={period.endTime}
                  onChange={(event) =>
                    onUpdateBreak(index, (existing) => ({
                      ...existing,
                      endTime: event.target.value,
                    }))
                  }
                />
              </FormField>
              <div className="flex items-end">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input hover:bg-muted"
                  aria-label="Remove break"
                  onClick={() => onRemoveBreak(index)}
                >
                  <Trash2Icon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {errors.breaks ? (
          <p className="mt-2 text-xs text-destructive">{errors.breaks}</p>
        ) : null}
      </div>

      {errors.form ? <p className="text-xs text-destructive">{errors.form}</p> : null}
    </div>
  )
}
