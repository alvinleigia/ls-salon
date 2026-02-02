import type { Weekday } from "@/types/scheduling"
export type { AppointmentConflict } from "@/types/appointments"

export type StaffOption = {
  id: string
  name: string | null
  email: string
  image?: string | null
}

export type ShiftTemplateBreak = {
  id?: string
  startTime: string
  endTime: string
  sortOrder?: number
}

export type ShiftTemplateOption = {
  id: string
  name: string
}

export type ShiftTemplateRow = {
  id: string
  name: string
  description: string | null
  color: string | null
  isActive: boolean
  startTime: string
  endTime: string
  breaks: ShiftTemplateBreak[]
  createdAt: string
  updatedAt: string
}

export type ShiftTemplateForm = {
  name: string
  description: string
  color: string
  isActive: boolean
  startTime: string
  endTime: string
  breaks: ShiftTemplateBreak[]
}

export type ShiftScheduleBlock = {
  id?: string
  templateId: string
  repeatDays: number
  sortOrder?: number
  template?: ShiftTemplateOption | null
}

export type ScheduleAssignment = {
  id: string
  startDate: string
  endDate?: string | null
  staffProfile?: { user?: StaffOption | null } | null
}

export type ShiftSchedule = {
  id: string
  name: string | null
  isDefault?: boolean
  startDate: string
  weekOffDay1: Weekday
  weekOffDay2: Weekday | null
  weekOff2Weeks: number[]
  blocks: ShiftScheduleBlock[]
  assignments?: ScheduleAssignment[]
  createdAt: string
  updatedAt: string
}

export type ShiftScheduleForm = {
  name: string
  staffIds: string[]
  isDefault: boolean
  startDate: string
  assignmentStartDate: string
  assignmentEndDate: string
  weekOffDay1: Weekday
  weekOffDay2: Weekday | ""
  weekOff2Weeks: number[]
  blocks: { templateId: string; repeatDays: number }[]
}

export type StaffScheduleAssignment = {
  id: string
  staffId: string | null
  staffProfileId: string
  scheduleId: string
  startDate: string
  endDate?: string | null
  schedule: ShiftSchedule
}

export type ShiftOverride = {
  id: string
  staffId: string | null
  staffProfileId: string
  date: string
  templateId: string | null
}

export type AvailabilityEvent = {
  Id: string
  Subject: string
  StartTime: Date
  EndTime: Date
  IsAllDay: boolean
  staffId: string
  templateStart?: string
  templateEnd?: string
  templateBreaks?: string[]
  isUnavailable?: boolean
  CategoryColor?: string
}
