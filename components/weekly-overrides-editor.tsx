"use client"

import * as React from "react"
import { Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type WeeklyOverridePeriod = {
  id?: string
  kind: "WORK" | "BREAK"
  startTime: string
  endTime: string
  sortOrder?: number
}

export type WeeklyOverrideDay = {
  id?: string
  day:
    | "MONDAY"
    | "TUESDAY"
    | "WEDNESDAY"
    | "THURSDAY"
    | "FRIDAY"
    | "SATURDAY"
    | "SUNDAY"
  isOpen: boolean
  periods: WeeklyOverridePeriod[]
}

type WeeklyOverridesEditorProps = {
  overrides: WeeklyOverrideDay[]
  onChange: (next: WeeklyOverrideDay[]) => void
  title?: string
  description?: string
  className?: string
}

const DAYS: { key: WeeklyOverrideDay["day"]; label: string }[] = [
  { key: "MONDAY", label: "Monday" },
  { key: "TUESDAY", label: "Tuesday" },
  { key: "WEDNESDAY", label: "Wednesday" },
  { key: "THURSDAY", label: "Thursday" },
  { key: "FRIDAY", label: "Friday" },
  { key: "SATURDAY", label: "Saturday" },
  { key: "SUNDAY", label: "Sunday" },
]

const DEFAULT_WORK_PERIOD: WeeklyOverridePeriod = {
  kind: "WORK",
  startTime: "09:00",
  endTime: "18:00",
}

const DEFAULT_BREAK_PERIOD: WeeklyOverridePeriod = {
  kind: "BREAK",
  startTime: "12:00",
  endTime: "13:00",
}

export function WeeklyOverridesEditor({
  overrides,
  onChange,
  title = "Weekly overrides",
  description = "Override weekly working days and hours for this staff member.",
  className,
}: WeeklyOverridesEditorProps) {
  return (
    <div className={`rounded-xl border bg-card p-6 ${className ?? ""}`}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="mt-4 space-y-4">
        {DAYS.map((day) => {
          const overrideIndex = overrides.findIndex((item) => item.day === day.key)
          const override = overrideIndex >= 0 ? overrides[overrideIndex] : null
          return (
            <div key={day.key} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-medium">{day.label}</div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(override)}
                      onChange={(event) => {
                        if (event.target.checked) {
                          onChange([
                            ...overrides,
                            {
                              day: day.key,
                              isOpen: true,
                              periods: [{ ...DEFAULT_WORK_PERIOD }],
                            },
                          ])
                          return
                        }
                        onChange(overrides.filter((item) => item.day !== day.key))
                      }}
                    />
                    Override
                  </label>
                </div>
              </div>

              {override ? (
                <div className="mt-4">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={override.isOpen}
                        onChange={(event) =>
                          onChange(
                            overrides.map((item, idx) =>
                              idx === overrideIndex
                                ? {
                                    ...item,
                                    isOpen: event.target.checked,
                                    periods: event.target.checked
                                      ? item.periods.length
                                        ? item.periods
                                        : [{ ...DEFAULT_WORK_PERIOD }]
                                      : [],
                                  }
                                : item
                            )
                          )
                        }
                      />
                      Open
                    </label>
                  </div>

                  {override.isOpen ? (
                    <div className="mt-4 space-y-3">
                      {override.periods.map((period, periodIndex) => (
                        <div
                          key={`${day.key}-${periodIndex}`}
                          className="grid gap-3 sm:grid-cols-[140px_1fr_1fr_auto] sm:items-end"
                        >
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Type</Label>
                            <select
                              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                              value={period.kind}
                              onChange={(event) =>
                                onChange(
                                  overrides.map((item, idx) =>
                                    idx === overrideIndex
                                      ? {
                                          ...item,
                                          periods: item.periods.map((p, pIdx) =>
                                            pIdx === periodIndex
                                              ? {
                                                  ...p,
                                                  kind: event.target.value as WeeklyOverridePeriod["kind"],
                                                }
                                              : p
                                          ),
                                        }
                                      : item
                                  )
                                )
                              }
                            >
                              <option value="WORK">Work</option>
                              <option value="BREAK">Break</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Start</Label>
                            <Input
                              type="time"
                              value={period.startTime}
                              onChange={(event) =>
                                onChange(
                                  overrides.map((item, idx) =>
                                    idx === overrideIndex
                                      ? {
                                          ...item,
                                          periods: item.periods.map((p, pIdx) =>
                                            pIdx === periodIndex
                                              ? { ...p, startTime: event.target.value }
                                              : p
                                          ),
                                        }
                                      : item
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">End</Label>
                            <Input
                              type="time"
                              value={period.endTime}
                              onChange={(event) =>
                                onChange(
                                  overrides.map((item, idx) =>
                                    idx === overrideIndex
                                      ? {
                                          ...item,
                                          periods: item.periods.map((p, pIdx) =>
                                            pIdx === periodIndex
                                              ? { ...p, endTime: event.target.value }
                                              : p
                                          ),
                                        }
                                      : item
                                  )
                                )
                              }
                            />
                          </div>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            aria-label="Remove period"
                            onClick={() =>
                              onChange(
                                overrides.map((item, idx) =>
                                  idx === overrideIndex
                                    ? {
                                        ...item,
                                        periods: item.periods.filter(
                                          (_, pIdx) => pIdx !== periodIndex
                                        ),
                                      }
                                    : item
                                )
                              )
                            }
                          >
                            <Trash2Icon className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() =>
                            onChange(
                              overrides.map((item, idx) =>
                                idx === overrideIndex
                                  ? {
                                      ...item,
                                      periods: [
                                        ...item.periods,
                                        { ...DEFAULT_WORK_PERIOD },
                                      ],
                                    }
                                  : item
                              )
                            )
                          }
                        >
                          Add work period
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            onChange(
                              overrides.map((item, idx) =>
                                idx === overrideIndex
                                  ? {
                                      ...item,
                                      periods: [
                                        ...item.periods,
                                        { ...DEFAULT_BREAK_PERIOD },
                                      ],
                                    }
                                  : item
                              )
                            )
                          }
                        >
                          Add break
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Closed for this day.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Inherits global hours.
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
