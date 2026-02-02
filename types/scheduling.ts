export type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY"

export type PeriodKind = "WORK" | "BREAK"

export type WeekdayOption = {
  value: Weekday
  label: string
}

export const WEEKDAY_OPTIONS: WeekdayOption[] = [
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
  { value: "SUNDAY", label: "Sunday" },
]

export type WorkingPeriod = {
  id?: string
  kind: PeriodKind
  startTime: string
  endTime: string
  sortOrder?: number
}

export type WorkingDay = {
  id?: string
  day: Weekday
  isOpen: boolean
  periods: WorkingPeriod[]
}

export type DateOverrideDay = {
  id?: string
  date: string
  isOpen: boolean
  periods: WorkingPeriod[]
}

export type AppSettingsPayload = {
  locale?: string
  currency?: string
  timeZone?: string
  dateFormat?: string
  workingHours?: WorkingDay[]
  overrides?: DateOverrideDay[]
}

export type TaxRow = {
  id: string
  name: string
  percent: number
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}
