"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import type { DateRange, SelectRangeEventHandler } from "react-day-picker"

import { cn } from "@/lib/utils"
import { useDateFormatter } from "@/hooks/use-date-formatter"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type DateRangePickerProps = {
  value?: DateRange
  onChange: (next: DateRange | undefined) => void
  placeholder?: string
  className?: string
  buttonClassName?: string
  align?: "start" | "center" | "end"
  numberOfMonths?: 1 | 2
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick a range",
  className,
  buttonClassName,
  align = "end",
  numberOfMonths = 2,
}: DateRangePickerProps) {
  const { formatDate } = useDateFormatter()
  const toDateInput = (value: Date) => {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, "0")
    const day = String(value.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }
  const toDateValue = (value: string) => {
    if (!value) return undefined
    const parsed = new Date(`${value}T00:00:00`)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }
  const label = value?.from
    ? value.to
      ? `${formatDate(value.from)} - ${formatDate(value.to)}`
      : formatDate(value.from)
    : placeholder
  const handleCalendarSelect: SelectRangeEventHandler = (nextRange, selectedDay) => {
    if (value?.from && value?.to && selectedDay) {
      onChange({ from: selectedDay, to: undefined })
      return
    }
    onChange(nextRange)
  }

  return (
    <div className={cn("w-fit", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("h-9 px-3 text-xs font-medium", buttonClassName)}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <div className="border-b px-3 py-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                From
                <Input
                  type="date"
                  className="mt-1 h-8"
                  value={value?.from ? toDateInput(value.from) : ""}
                  onChange={(event) => {
                    const nextFrom = toDateValue(event.target.value)
                    const currentTo = value?.to
                    if (!nextFrom) {
                      onChange(currentTo ? { from: currentTo, to: currentTo } : undefined)
                      return
                    }
                    if (currentTo && nextFrom > currentTo) {
                      onChange({ from: nextFrom, to: nextFrom })
                      return
                    }
                    onChange({ from: nextFrom, to: currentTo })
                  }}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                To
                <Input
                  type="date"
                  className="mt-1 h-8"
                  value={value?.to ? toDateInput(value.to) : ""}
                  onChange={(event) => {
                    const nextTo = toDateValue(event.target.value)
                    const currentFrom = value?.from
                    if (!nextTo) {
                      onChange(currentFrom ? { from: currentFrom, to: currentFrom } : undefined)
                      return
                    }
                    if (currentFrom && nextTo < currentFrom) {
                      onChange({ from: nextTo, to: nextTo })
                      return
                    }
                    onChange({ from: currentFrom ?? nextTo, to: nextTo })
                  }}
                />
              </label>
            </div>
          </div>
          <Calendar
            mode="range"
            selected={value}
            onSelect={handleCalendarSelect}
            numberOfMonths={numberOfMonths}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
