"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { TimeFormat } from "@/types/scheduling"

type TimePickerProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  timeFormat?: TimeFormat
  disabled?: boolean
  min?: string
  max?: string
  className?: string
}

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1))
const HOUR_24_OPTIONS = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, "0")
)
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0")
)

const parseTime = (value: string) => {
  const [rawHour, rawMinute] = value.split(":")
  const hour = Number(rawHour)
  const minute = Number(rawMinute)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return { hour12: "12", minute: "00", meridiem: "AM" as const }
  }
  const normalizedHour = Math.min(23, Math.max(0, hour))
  const normalizedMinute = Math.min(59, Math.max(0, minute))
  const meridiem = normalizedHour >= 12 ? "PM" : "AM"
  const hour12Base = normalizedHour % 12
  const hour12 = String(hour12Base === 0 ? 12 : hour12Base)
  return {
    hour12,
    minute: String(normalizedMinute).padStart(2, "0"),
    meridiem: meridiem as "AM" | "PM",
  }
}

const to24h = (hour12: string, minute: string, meridiem: "AM" | "PM") => {
  const h = Number(hour12)
  const m = Number(minute)
  const safeHour = Number.isInteger(h) ? Math.min(12, Math.max(1, h)) : 12
  const safeMinute = Number.isInteger(m) ? Math.min(59, Math.max(0, m)) : 0
  const hour24Base = safeHour % 12
  const hour24 = meridiem === "PM" ? hour24Base + 12 : hour24Base
  return `${String(hour24).padStart(2, "0")}:${String(safeMinute).padStart(2, "0")}`
}

export function TimePicker({
  id,
  value,
  onChange,
  timeFormat = "H12",
  disabled = false,
  min,
  max,
  className,
}: TimePickerProps) {
  const parsed = React.useMemo(() => parseTime(value), [value])
  const [parsedHour] = value.split(":")
  const hour24 = HOUR_24_OPTIONS.includes(parsedHour) ? parsedHour : "00"
  const clamp = React.useCallback(
    (nextValue: string) => {
      if (min && nextValue < min) return min
      if (max && nextValue > max) return max
      return nextValue
    },
    [max, min]
  )

  return (
    <div
      className={cn(
        timeFormat === "H24" ? "grid grid-cols-[1fr_1fr] gap-2" : "grid grid-cols-[1fr_1fr_80px] gap-2",
        className
      )}
    >
      {timeFormat === "H24" ? (
        <select
          id={id}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={hour24}
          disabled={disabled}
          onChange={(event) => onChange(clamp(`${event.target.value}:${parsed.minute}`))}
        >
          {HOUR_24_OPTIONS.map((hour) => (
            <option key={hour} value={hour}>
              {hour}
            </option>
          ))}
        </select>
      ) : (
      <select
        id={id}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={parsed.hour12}
        disabled={disabled}
        onChange={(event) =>
          onChange(clamp(to24h(event.target.value, parsed.minute, parsed.meridiem)))
        }
      >
        {HOUR_OPTIONS.map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>
      )}
      <select
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={parsed.minute}
        disabled={disabled}
        onChange={(event) =>
          onChange(clamp(to24h(parsed.hour12, event.target.value, parsed.meridiem)))
        }
      >
        {MINUTE_OPTIONS.map((minute) => (
          <option key={minute} value={minute}>
            {minute}
          </option>
        ))}
      </select>
      {timeFormat === "H12" ? (
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={parsed.meridiem}
          disabled={disabled}
          onChange={(event) =>
            onChange(
              clamp(to24h(parsed.hour12, parsed.minute, event.target.value as "AM" | "PM"))
            )
          }
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      ) : null}
    </div>
  )
}

