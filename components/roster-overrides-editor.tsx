"use client"

import * as React from "react"
import { toast } from "sonner"
import { RotateCcwIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDateFormatter } from "@/hooks/use-date-formatter"

export type RosterOverridePeriod = {
  id?: string
  kind: "WORK" | "BREAK"
  startTime: string
  endTime: string
  sortOrder?: number
}

export type RosterOverrideDay = {
  id?: string
  date: string
  isOpen: boolean
  periods: RosterOverridePeriod[]
}

type RosterOverridesEditorProps = {
  overrides: RosterOverrideDay[]
  onChange: (next: RosterOverrideDay[]) => void
  defaultDate?: string
  title?: string
  description?: string
  addLabel?: string
  className?: string
}

const DEFAULT_WORK_PERIOD: RosterOverridePeriod = {
  kind: "WORK",
  startTime: "09:00",
  endTime: "18:00",
}

const DEFAULT_BREAK_PERIOD: RosterOverridePeriod = {
  kind: "BREAK",
  startTime: "12:00",
  endTime: "13:00",
}

const summarizePeriods = (periods: RosterOverridePeriod[]) => {
  if (!periods.length) return "-"
  return periods
    .map((period) => `${period.kind} ${period.startTime}-${period.endTime}`)
    .join(", ")
}

type RosterOverridesSplitProps = RosterOverridesEditorProps
  & {
    onDeleteCommit?: (next: RosterOverrideDay[]) => void | Promise<void>
  }

type RosterOverrideFormProps = {
  override: RosterOverrideDay
  onChange: (next: RosterOverrideDay) => void
  onRemove: () => void
}

const RosterOverrideForm = ({
  override,
  onChange,
  onRemove,
}: RosterOverrideFormProps) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Date</Label>
          <Input
            type="date"
            defaultValue={override.date}
            onBlur={(event) => {
              const nextDate = event.currentTarget.value
              if (!nextDate || nextDate === override.date) {
                return
              }
              onChange({ ...override, date: nextDate })
            }}
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={override.isOpen}
              onChange={(event) =>
                onChange({
                  ...override,
                  isOpen: event.target.checked,
                  periods: event.target.checked
                    ? override.periods.length
                      ? override.periods
                      : [{ ...DEFAULT_WORK_PERIOD }]
                    : [],
                })
              }
            />
            Open
          </label>
          <Button variant="outline" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>

      {override.isOpen ? (
        <div className="space-y-3">
          {override.periods.map((period, periodIndex) => (
            <div
              key={`${override.date}-${periodIndex}`}
              className="grid gap-3 sm:grid-cols-[140px_1fr_1fr_auto] sm:items-end"
            >
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={period.kind}
                  onChange={(event) =>
                    onChange({
                      ...override,
                      periods: override.periods.map((p, pIdx) =>
                        pIdx === periodIndex
                          ? {
                              ...p,
                              kind: event.target.value as RosterOverridePeriod["kind"],
                            }
                          : p
                      ),
                    })
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
                    onChange({
                      ...override,
                      periods: override.periods.map((p, pIdx) =>
                        pIdx === periodIndex
                          ? { ...p, startTime: event.target.value }
                          : p
                      ),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">End</Label>
                <Input
                  type="time"
                  value={period.endTime}
                  onChange={(event) =>
                    onChange({
                      ...override,
                      periods: override.periods.map((p, pIdx) =>
                        pIdx === periodIndex
                          ? { ...p, endTime: event.target.value }
                          : p
                      ),
                    })
                  }
                />
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  onChange({
                    ...override,
                    periods: override.periods.filter((_, pIdx) => pIdx !== periodIndex),
                  })
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                onChange({
                  ...override,
                  periods: [...override.periods, { ...DEFAULT_WORK_PERIOD }],
                })
              }
            >
              Add work period
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                onChange({
                  ...override,
                  periods: [...override.periods, { ...DEFAULT_BREAK_PERIOD }],
                })
              }
            >
              Add break
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Closed for this day.</p>
      )}
    </div>
  )
}

export function RosterOverridesSplit({
  overrides,
  onChange,
  onDeleteCommit,
  defaultDate,
  title = "Roster overrides",
  description = "Inherits global hours. Add date overrides for this staff member.",
  addLabel = "Add override",
  className,
}: RosterOverridesSplitProps) {
  const { formatDate } = useDateFormatter()
  const [filterText, setFilterText] = React.useState("")
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<RosterOverrideDay | null>(null)

  const filtered = React.useMemo(() => {
    const needle = filterText.trim()
    if (!needle) return overrides
    return overrides.filter((override) => override.date === needle)
  }, [filterText, overrides])

  React.useEffect(() => {
    if (!filtered.length) {
      setSelectedIndex(null)
      return
    }
    if (selectedIndex === null || selectedIndex >= filtered.length) {
      setSelectedIndex(0)
    }
  }, [filtered, selectedIndex])

  const addOverride = React.useCallback(() => {
    const today = defaultDate ?? new Date().toISOString().slice(0, 10)
    if (overrides.some((override) => override.date === today)) {
      toast.error("An override for that date already exists.")
      return
    }
    const next = [
      ...overrides,
      {
        date: today,
        isOpen: true,
        periods: [{ ...DEFAULT_WORK_PERIOD }],
      },
    ]
    onChange(next)
    setSelectedIndex(next.length - 1)
  }, [defaultDate, onChange, overrides])

  const selectedOverride =
    selectedIndex !== null ? filtered[selectedIndex] ?? null : null

  const handleDelete = React.useCallback(
    (target: RosterOverrideDay) => {
      const next = overrides.filter(
        (item) => !(item.date === target.date && item.id === target.id)
      )
      onChange(next)
      if (onDeleteCommit) {
        void onDeleteCommit(next)
      }
    },
    [onChange, onDeleteCommit, overrides]
  )

  return (
    <div className={`rounded-xl border bg-card p-6 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button variant="outline" onClick={addOverride}>
          {addLabel}
        </Button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Filter date</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={filterText}
                onChange={(event) => setFilterText(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setFilterText("")}
                aria-label="Reset filter"
              >
                <RotateCcwIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="rounded-lg border">
            <div className="grid grid-cols-[1fr_1fr_80px_80px] gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
              <span>Date</span>
              <span>Summary</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {filtered.length ? (
                filtered.map((override, index) => (
                  <div
                    key={`${override.date}-${index}`}
                    className={`grid w-full cursor-pointer grid-cols-[1fr_1fr_80px_80px] items-center gap-2 px-3 py-2 text-left text-sm transition ${
                      index === selectedIndex
                        ? "bg-muted/60 text-foreground"
                        : "hover:bg-muted/40"
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedIndex(index)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        setSelectedIndex(index)
                      }
                    }}
                  >
                    <div>
                      <div className="font-medium">{formatDate(override.date)}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {summarizePeriods(override.periods)}
                    </div>
                    <span className="text-xs">
                      {override.isOpen ? "Open" : "Closed"}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation()
                        setDeleteTarget(override)
                      }}
                      aria-label="Delete override"
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="px-3 py-3 text-sm text-muted-foreground">
                  No overrides yet.
                </div>
              )}
            </div>
          </div>
          {selectedOverride ? (
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget(selectedOverride)
              }}
            >
              Delete selected
            </Button>
          ) : null}
        </div>

        <div className="rounded-lg border p-4">
          {selectedOverride ? (
            <RosterOverrideForm
              override={selectedOverride}
              onChange={(next) =>
                onChange(
                  overrides.map((item) =>
                    item === selectedOverride ? next : item
                  )
                )
              }
              onRemove={() =>
                onChange(
                  overrides.filter(
                    (item) =>
                      !(item.date === selectedOverride.date && item.id === selectedOverride.id)
                  )
                )
              }
            />
          ) : (
            <div className="text-sm text-muted-foreground">
              Select an override to edit.
            </div>
          )}
        </div>
      </div>
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete override?</DialogTitle>
            <DialogDescription>
              This will remove the selected date override.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!deleteTarget) return
                const target = deleteTarget
                setDeleteTarget(null)
                handleDelete(target)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function RosterOverridesEditor({
  overrides,
  onChange,
  defaultDate,
  title = "Roster overrides",
  description = "Inherits global hours. Add date overrides for this staff member.",
  addLabel = "Add override",
  className,
}: RosterOverridesEditorProps) {
  const addOverride = React.useCallback(() => {
    const today = defaultDate ?? new Date().toISOString().slice(0, 10)
    if (overrides.some((override) => override.date === today)) {
      toast.error("An override for that date already exists.")
      return
    }
    onChange([
      ...overrides,
      {
        date: today,
        isOpen: true,
        periods: [{ ...DEFAULT_WORK_PERIOD }],
      },
    ])
  }, [defaultDate, onChange, overrides])

  return (
    <div className={`rounded-xl border bg-card p-6 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button variant="outline" onClick={addOverride}>
          {addLabel}
        </Button>
      </div>

      {overrides.length ? (
        <div className="mt-4 space-y-4">
          {overrides.map((override, overrideIndex) => (
            <div
              key={`${override.date}-${overrideIndex}`}
              className="rounded-lg border p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <Input
                    type="date"
                    defaultValue={override.date}
                    onBlur={(event) => {
                      const nextDate = event.currentTarget.value
                      if (!nextDate || nextDate === override.date) {
                        return
                      }
                      if (
                        overrides.some(
                          (item, index) =>
                            index !== overrideIndex && item.date === nextDate
                        )
                      ) {
                        toast.error("That date already has an override.")
                        event.currentTarget.value = override.date
                        return
                      }
                      onChange(
                        overrides.map((item, idx) =>
                          idx === overrideIndex ? { ...item, date: nextDate } : item
                        )
                      )
                    }}
                  />
                </div>
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
                  <Button
                    variant="outline"
                    onClick={() =>
                      onChange(overrides.filter((_, idx) => idx !== overrideIndex))
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>

              {override.isOpen ? (
                <div className="mt-4 space-y-3">
                  {override.periods.map((period, periodIndex) => (
                    <div
                      key={`${override.date}-${periodIndex}`}
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
                                              kind: event.target.value as RosterOverridePeriod["kind"],
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
                        Remove
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
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No overrides yet.</p>
      )}
    </div>
  )
}
