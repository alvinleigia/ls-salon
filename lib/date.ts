export const DEFAULT_DATE_FORMAT = "MM/dd/yyyy"

const pad2 = (value: number) => String(value).padStart(2, "0")

export const toISODateLocal = (value: Date) => {
  if (Number.isNaN(value.getTime())) return ""
  const year = value.getFullYear()
  const month = pad2(value.getMonth() + 1)
  const day = pad2(value.getDate())
  return `${year}-${month}-${day}`
}

export const parseISODate = (value?: string | Date | null) => {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number)
    const parsed = new Date(year, (month ?? 1) - 1, day ?? 1)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const toISODate = (value: string | Date) => {
  if (!value) return ""
  if (value instanceof Date) {
    return toISODateLocal(value)
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (match) {
    const [, day, month, year] = match
    return `${year}-${month}-${day}`
  }
  const parsed = parseISODate(value)
  if (parsed) {
    return toISODateLocal(parsed)
  }
  return value
}

export const formatDateForDisplay = (
  value?: string | Date | null,
  format = DEFAULT_DATE_FORMAT
) => {
  if (!value) return "-"
  const date = parseISODate(value)
  if (!date) {
    return typeof value === "string" ? value : "-"
  }
  const tokens: Record<string, string> = {
    yyyy: String(date.getFullYear()),
    MM: pad2(date.getMonth() + 1),
    dd: pad2(date.getDate()),
  }
  return format.replace(/yyyy|MM|dd/g, (token) => tokens[token] ?? token)
}
