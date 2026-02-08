import { WEEKDAY_OPTIONS } from "@/types/scheduling"
import type {
  AppSettingsPayload,
  DateOverrideDay,
  WorkingDay,
  WorkingPeriod,
} from "@/types/scheduling"

export type SettingsForm = Required<
  Pick<
    AppSettingsPayload,
    | "locale"
    | "currency"
    | "timeZone"
    | "dateFormat"
    | "firstDayOfWeek"
    | "currencySymbolPlacement"
    | "numberFormat"
  >
> & {
  workingHours: WorkingDay[]
  overrides: DateOverrideDay[]
}

export const DEFAULT_PERIOD: WorkingPeriod = {
  kind: "WORK",
  startTime: "09:00",
  endTime: "18:00",
}

export const defaultWorkingHours: WorkingDay[] = WEEKDAY_OPTIONS.map((day) => ({
  day: day.value,
  isOpen: true,
  periods: [{ ...DEFAULT_PERIOD }],
}))

export const defaultSettings: SettingsForm = {
  locale: "en-US",
  currency: "USD",
  timeZone: "America/New_York",
  dateFormat: "MM/dd/yyyy",
  firstDayOfWeek: "SUNDAY",
  currencySymbolPlacement: "BEFORE",
  numberFormat: "US_UK",
  workingHours: defaultWorkingHours,
  overrides: [],
}

export const normalizeWorkingHours = (workingHours?: WorkingDay[]) => {
  const map = new Map(workingHours?.map((day) => [day.day, day]) ?? [])
  return WEEKDAY_OPTIONS.map((day) => {
    const existing = map.get(day.value)
    if (!existing) {
      return {
        day: day.value,
        isOpen: true,
        periods: [{ ...DEFAULT_PERIOD }],
      }
    }
    const periods =
      existing.periods?.length > 0
        ? existing.periods
        : existing.isOpen
          ? [{ ...DEFAULT_PERIOD }]
          : []
    return { ...existing, periods }
  })
}

export const normalizeOverrides = (overrides?: DateOverrideDay[]) =>
  overrides?.map((override) => ({
    ...override,
    periods:
      override.periods?.length > 0
        ? override.periods
        : override.isOpen
          ? [{ ...DEFAULT_PERIOD }]
          : [],
  })) ?? []
