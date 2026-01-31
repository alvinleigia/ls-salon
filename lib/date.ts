export const DEFAULT_DATE_FORMAT = "MM/dd/yyyy"

const pad2 = (value: number) => String(value).padStart(2, "0")

export const toISODateLocal = (value: Date) => {
  if (Number.isNaN(value.getTime())) return ""
  const year = value.getFullYear()
  const month = pad2(value.getMonth() + 1)
  const day = pad2(value.getDate())
  return `${year}-${month}-${day}`
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
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }
  return value
}

export const formatDateForDisplay = (
  value?: string | Date | null,
  format = DEFAULT_DATE_FORMAT
) => {
  if (!value) return "-"
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "-"
  }
  const tokens: Record<string, string> = {
    yyyy: String(date.getFullYear()),
    MM: pad2(date.getMonth() + 1),
    dd: pad2(date.getDate()),
  }
  return format.replace(/yyyy|MM|dd/g, (token) => tokens[token] ?? token)
}
