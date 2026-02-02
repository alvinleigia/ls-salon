import type { ShiftTemplateForm } from "@/types/shifts"

export type TemplateStatus = "ACTIVE" | "INACTIVE"

export const templateStatusOptions: TemplateStatus[] = ["ACTIVE", "INACTIVE"]

export const defaultTemplateForm: ShiftTemplateForm = {
  name: "",
  description: "",
  color: "#2563eb",
  isActive: true,
  startTime: "09:00",
  endTime: "18:00",
  breaks: [],
}
