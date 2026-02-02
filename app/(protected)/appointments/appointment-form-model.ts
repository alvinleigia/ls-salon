import type { AppointmentFormValues } from "@/types/appointments"

const toTimeInput = (value: Date) => {
  const hours = String(value.getHours()).padStart(2, "0")
  const minutes = String(value.getMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}

export const defaultAppointmentFormValues = (): AppointmentFormValues => {
  const now = new Date()
  return {
    customerId: "",
    serviceId: "",
    staffId: "",
    date: now.toISOString().slice(0, 10),
    startTime: toTimeInput(now),
    status: "SCHEDULED",
  }
}

export const combineLocalDateTimeToISO = (date: string, time: string) => {
  const local = new Date(`${date}T${time}:00`)
  return local.toISOString()
}

export const buildEndTimePreview = (
  date: string,
  startTime: string,
  durationMinutes?: number
) => {
  if (!date || !startTime || !durationMinutes) return null
  const start = new Date(`${date}T${startTime}:00`)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start)
  end.setMinutes(end.getMinutes() + durationMinutes)
  const hh = String(end.getHours()).padStart(2, "0")
  const mm = String(end.getMinutes()).padStart(2, "0")
  const crossesDay = end.toDateString() !== start.toDateString()
  return `${hh}:${mm}${crossesDay ? " (next day)" : ""}`
}
