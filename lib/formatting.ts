import type {
  AppSettingsPayload,
  CurrencySymbolPlacement,
  NumberFormatStyle,
  Weekday,
} from "@/types/scheduling"

const DEFAULTS = {
  locale: "en-US",
  currency: "USD",
  currencySymbolPlacement: "BEFORE" as CurrencySymbolPlacement,
  numberFormat: "US_UK" as NumberFormatStyle,
}

const NUMBER_SEPARATORS: Record<
  NumberFormatStyle,
  { thousands: string; decimal: string; grouped: boolean }
> = {
  US_UK: { thousands: ",", decimal: ".", grouped: true },
  EUROPEAN: { thousands: ".", decimal: ",", grouped: true },
  ISO_DECIMAL_POINT: { thousands: " ", decimal: ".", grouped: true },
  ISO_DECIMAL_COMMA: { thousands: " ", decimal: ",", grouped: true },
  COMPACT_DECIMAL_POINT: { thousands: "", decimal: ".", grouped: false },
  COMPACT_DECIMAL_COMMA: { thousands: "", decimal: ",", grouped: false },
}

const addGrouping = (value: string, separator: string) =>
  value.replace(/\B(?=(\d{3})+(?!\d))/g, separator)

export const formatNumberValue = (
  value: number,
  style: NumberFormatStyle = DEFAULTS.numberFormat,
  fractionDigits = 2
) => {
  const abs = Math.abs(value)
  const fixed = abs.toFixed(fractionDigits)
  const [integerPart, decimalPart = ""] = fixed.split(".")
  const separators = NUMBER_SEPARATORS[style]
  const groupedInteger = separators.grouped
    ? addGrouping(integerPart, separators.thousands)
    : integerPart
  const withDecimals = fractionDigits
    ? `${groupedInteger}${separators.decimal}${decimalPart}`
    : groupedInteger
  return value < 0 ? `-${withDecimals}` : withDecimals
}

const resolveCurrencySymbol = (currency: string, locale: string) => {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(1)
    return parts.find((part) => part.type === "currency")?.value ?? currency
  } catch {
    return currency
  }
}

export const formatCurrencyFromCents = (
  cents: number,
  settings?: Pick<
    AppSettingsPayload,
    "currency" | "locale" | "currencySymbolPlacement" | "numberFormat"
  >
) => {
  const value = cents / 100
  const locale = settings?.locale ?? DEFAULTS.locale
  const currency = settings?.currency ?? DEFAULTS.currency
  const placement =
    settings?.currencySymbolPlacement ?? DEFAULTS.currencySymbolPlacement
  const numberFormat = settings?.numberFormat ?? DEFAULTS.numberFormat

  const symbol = resolveCurrencySymbol(currency, locale)
  const number = formatNumberValue(value, numberFormat, 2)
  return placement === "BEFORE" ? `${symbol} ${number}` : `${number} ${symbol}`
}

export const weekdayToSchedulerFirstDay = (weekday?: Weekday) => {
  switch (weekday) {
    case "MONDAY":
      return 1
    case "TUESDAY":
      return 2
    case "WEDNESDAY":
      return 3
    case "THURSDAY":
      return 4
    case "FRIDAY":
      return 5
    case "SATURDAY":
      return 6
    case "SUNDAY":
    default:
      return 0
  }
}
