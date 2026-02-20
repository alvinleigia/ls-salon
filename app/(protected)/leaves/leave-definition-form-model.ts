import type {
  LeaveDefinitionAllowedUsers,
  LeaveDefinitionFormValues,
  LeaveDefinitionStatus,
  LeaveDefinitionType,
} from "@/types/leaves"

export const leaveDefinitionTypeOptions: LeaveDefinitionType[] = [
  "PAID",
  "LAY_OFF",
  "UNPAID",
  "RESTRICTED",
  "COMPENSATORY",
  "TOUR_ON_DUTY",
]

export const leaveAllowedUsersOptions: LeaveDefinitionAllowedUsers[] = [
  "ALL",
  "MALE",
  "FEMALE",
]

export const leaveDefinitionStatusOptions: LeaveDefinitionStatus[] = [
  "ACTIVE",
  "INACTIVE",
]

export const defaultLeaveDefinitionFormValues: LeaveDefinitionFormValues = {
  code: "",
  name: "",
  leaveType: "PAID",
  allowedUsers: "ALL",
  minDaysPerRequest: 0,
  maxDaysPerRequest: 30,
  allowWithOtherLeaves: true,
  priorEntryAllowed: false,
  noticeDays: 0,
  allowCarryForward: false,
  weekOffSingleSideAllowed: true,
  weekOffBothSideAllowed: true,
  holidaySingleSideAllowed: true,
  holidayBothSideAllowed: true,
  maxConsecutiveDays: 30,
  maxPendingRequests: 3,
  status: "ACTIVE",
  sortOrder: 0,
  nonClubbableWithIds: [],
}
