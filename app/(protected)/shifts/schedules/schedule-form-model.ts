import type { ShiftScheduleForm } from "@/types/shifts"

export const createDefaultScheduleForm = (today: string): ShiftScheduleForm => ({
  name: "",
  staffIds: [],
  isDefault: false,
  startDate: today,
  assignmentStartDate: today,
  assignmentEndDate: "",
  weekOffDay1: "SUNDAY",
  weekOffDay2: "",
  weekOff2Weeks: [],
  blocks: [{ templateId: "", repeatDays: 1 }],
})
