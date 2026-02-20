import type {
  LeaveGroupAssignmentMode,
  LeaveGroupFormValues,
  LeaveGroupStatus,
} from "@/types/leaves"

export const leaveGroupAssignmentModeOptions: LeaveGroupAssignmentMode[] = [
  "ALL_STAFF",
  "SELECTED_STAFF",
]

export const leaveGroupStatusOptions: LeaveGroupStatus[] = ["ACTIVE", "INACTIVE"]

export const defaultLeaveGroupFormValues: LeaveGroupFormValues = {
  code: "",
  name: "",
  description: "",
  assignmentMode: "ALL_STAFF",
  status: "ACTIVE",
  sortOrder: 0,
  leaveDefinitionIds: [],
  staffIds: [],
}
