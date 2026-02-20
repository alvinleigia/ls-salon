import { Prisma, Weekday, type PrismaClient } from "@prisma/client"
import type { LeaveRequestRow, LeaveRequestRuleCheck, LeaveRequestTimelineEvent } from "@/types/leaves"

type DbClient = PrismaClient | Prisma.TransactionClient

type ValidateCreateLeaveRequestRulesInput = {
  tx: DbClient
  staffProfileId: string
  leaveDefinitionId: string
  startDate: string
  endDate: string
}

type ValidateCreateLeaveRequestRulesResult = {
  startDate: Date
  endDate: Date
  daysCount: number
}

type LeaveRequestWithRelations = {
  id: string
  staffProfileId: string
  leaveDefinitionId: string
  startDate: Date
  endDate: Date
  daysCount: number
  reason: string | null
  status: LeaveRequestRow["status"]
  reviewedByUserId: string | null
  reviewedAt: Date | null
  reviewerComment: string | null
  canceledAt: Date | null
  cancelReason: string | null
  createdAt: Date
  updatedAt: Date
  leaveDefinition: {
    id: string
    code: string
    name: string
  }
  staffProfile: {
    id: string
    user: {
      id: string
      name: string | null
      email: string
    }
  }
  reviewedByUser: {
    id: string
    name: string | null
    email: string
  } | null
}

const dayMs = 24 * 60 * 60 * 1000

const parseDateOnly = (value: string) => {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) {
    throw new Error("Invalid date format. Use YYYY-MM-DD.")
  }
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date supplied.")
  }
  return parsed
}

const toIsoDate = (value: Date) => value.toISOString().slice(0, 10)

const addDays = (value: Date, offset: number) =>
  new Date(value.getTime() + offset * dayMs)

const getTodayDateOnlyUtc = () => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

const getInclusiveDays = (startDate: Date, endDate: Date) =>
  Math.floor((endDate.getTime() - startDate.getTime()) / dayMs) + 1

const resolveWeekday = (value: Date): Weekday => {
  const mapping: Weekday[] = [
    Weekday.SUNDAY,
    Weekday.MONDAY,
    Weekday.TUESDAY,
    Weekday.WEDNESDAY,
    Weekday.THURSDAY,
    Weekday.FRIDAY,
    Weekday.SATURDAY,
  ]
  return mapping[value.getUTCDay()] ?? Weekday.SUNDAY
}

const getWeekOfMonth = (value: Date) => {
  const day = value.getUTCDate()
  return Math.floor((day - 1) / 7) + 1
}

const isWeekOffForSchedule = (
  date: Date,
  schedule: {
    weekOffDay1: Weekday
    weekOffDay2: Weekday | null
    weekOff2Weeks: number[]
  } | null
) => {
  if (!schedule) return false
  const weekday = resolveWeekday(date)
  if (weekday === schedule.weekOffDay1) return true
  if (schedule.weekOffDay2 && weekday === schedule.weekOffDay2) {
    const weeks =
      schedule.weekOff2Weeks.length > 0 ? schedule.weekOff2Weeks : [1, 2, 3, 4, 5]
    return weeks.includes(getWeekOfMonth(date))
  }
  return false
}

const getScheduleForDate = async (
  tx: DbClient,
  staffProfileId: string,
  date: Date
) => {
  const assignment = await tx.staffScheduleAssignment.findFirst({
    where: {
      staffProfileId,
      startDate: { lte: date },
      OR: [{ endDate: null }, { endDate: { gte: date } }],
    },
    orderBy: [{ startDate: "desc" }],
    select: {
      schedule: {
        select: {
          weekOffDay1: true,
          weekOffDay2: true,
          weekOff2Weeks: true,
        },
      },
    },
  })
  if (assignment?.schedule) return assignment.schedule

  const fallback = await tx.shiftSchedule.findFirst({
    where: { isDefault: true },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      weekOffDay1: true,
      weekOffDay2: true,
      weekOff2Weeks: true,
    },
  })
  return fallback
}

export const validateCreateLeaveRequestRules = async ({
  tx,
  staffProfileId,
  leaveDefinitionId,
  startDate,
  endDate,
}: ValidateCreateLeaveRequestRulesInput): Promise<ValidateCreateLeaveRequestRulesResult> => {
  const parsedStart = parseDateOnly(startDate)
  const parsedEnd = parseDateOnly(endDate)
  if (parsedStart > parsedEnd) {
    throw new Error("Start date cannot be after end date.")
  }

  const daysCount = getInclusiveDays(parsedStart, parsedEnd)

  const staff = await tx.staffProfile.findUnique({
    where: { id: staffProfileId },
    select: {
      id: true,
      user: {
        select: {
          id: true,
          role: true,
          status: true,
          gender: true,
        },
      },
    },
  })
  if (!staff || staff.user.role !== "STAFF" || staff.user.status !== "ACTIVE") {
    throw new Error("Only active staff can request leave.")
  }

  const eligibleGroup = await tx.leaveGroup.findFirst({
    where: {
      status: "ACTIVE",
      leaves: {
        some: {
          leaveDefinitionId,
        },
      },
      OR: [
        { assignmentMode: "ALL_STAFF" },
        {
          assignmentMode: "SELECTED_STAFF",
          staffAssignments: {
            some: {
              staffProfileId,
            },
          },
        },
      ],
    },
    select: { id: true },
  })
  if (!eligibleGroup) {
    throw new Error("Selected leave type is not assigned to this employee.")
  }

  const leaveDefinition = await tx.leaveDefinition.findUnique({
    where: { id: leaveDefinitionId },
    select: {
      id: true,
      allowedUsers: true,
      minDaysPerRequest: true,
      maxDaysPerRequest: true,
      maxConsecutiveDays: true,
      maxPendingRequests: true,
      allowWithOtherLeaves: true,
      priorEntryAllowed: true,
      noticeDays: true,
      weekOffSingleSideAllowed: true,
      weekOffBothSideAllowed: true,
      holidaySingleSideAllowed: true,
      holidayBothSideAllowed: true,
      status: true,
      nonClubbableWithFrom: {
        select: {
          blockedLeaveId: true,
        },
      },
      nonClubbableWithTo: {
        select: {
          leaveDefinitionId: true,
        },
      },
    },
  })
  if (!leaveDefinition || leaveDefinition.status !== "ACTIVE") {
    throw new Error("Selected leave definition is not active.")
  }

  if (
    leaveDefinition.allowedUsers !== "ALL" &&
    !staff.user.gender
  ) {
    throw new Error("User gender is required for this leave type.")
  }

  if (leaveDefinition.allowedUsers === "MALE" && staff.user.gender !== "MALE") {
    throw new Error("This leave type is only allowed for male staff.")
  }
  if (leaveDefinition.allowedUsers === "FEMALE" && staff.user.gender !== "FEMALE") {
    throw new Error("This leave type is only allowed for female staff.")
  }

  if (daysCount < leaveDefinition.minDaysPerRequest) {
    throw new Error("Requested days are below the minimum allowed per request.")
  }
  if (daysCount > leaveDefinition.maxDaysPerRequest) {
    throw new Error("Requested days exceed the maximum allowed per request.")
  }
  if (daysCount > leaveDefinition.maxConsecutiveDays) {
    throw new Error("Requested days exceed max consecutive days for this leave.")
  }

  const today = getTodayDateOnlyUtc()
  if (!leaveDefinition.priorEntryAllowed && parsedStart < today) {
    throw new Error("Past leave entry is not allowed for this leave type.")
  }
  const minimumAllowedStart = addDays(today, leaveDefinition.noticeDays)
  if (parsedStart < minimumAllowedStart) {
    throw new Error(`At least ${leaveDefinition.noticeDays} day(s) notice is required.`)
  }

  const pendingCount = await tx.leaveRequest.count({
    where: {
      staffProfileId,
      leaveDefinitionId,
      status: "PENDING",
    },
  })
  if (pendingCount >= leaveDefinition.maxPendingRequests) {
    throw new Error("Maximum pending requests reached for this leave type.")
  }

  const overlappingRequests = await tx.leaveRequest.findMany({
    where: {
      staffProfileId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: parsedEnd },
      endDate: { gte: parsedStart },
    },
    select: {
      id: true,
      leaveDefinitionId: true,
    },
  })

  if (!leaveDefinition.allowWithOtherLeaves && overlappingRequests.length > 0) {
    throw new Error("This leave cannot be combined with overlapping leave requests.")
  }

  const nonClubbableIds = new Set<string>([
    ...leaveDefinition.nonClubbableWithFrom.map((item) => item.blockedLeaveId),
    ...leaveDefinition.nonClubbableWithTo.map((item) => item.leaveDefinitionId),
  ])
  if (nonClubbableIds.size > 0) {
    const adjacentOrOverlapping = await tx.leaveRequest.findFirst({
      where: {
        staffProfileId,
        status: { in: ["PENDING", "APPROVED"] },
        leaveDefinitionId: { in: Array.from(nonClubbableIds) },
        startDate: { lte: addDays(parsedEnd, 1) },
        endDate: { gte: addDays(parsedStart, -1) },
      },
      select: { id: true },
    })
    if (adjacentOrOverlapping) {
      throw new Error("This leave cannot be clubbed with the selected adjacent leave type.")
    }
  }

  const edgeDates = [addDays(parsedStart, -1), addDays(parsedEnd, 1)]
  const [beforeDate, afterDate] = edgeDates

  const [beforeSchedule, afterSchedule, holidayOverrides] = await Promise.all([
    getScheduleForDate(tx, staffProfileId, beforeDate),
    getScheduleForDate(tx, staffProfileId, afterDate),
    tx.appSettingOverride.findMany({
      where: {
        date: { in: edgeDates },
        isOpen: false,
      },
      select: { date: true },
    }),
  ])

  const weekOffBefore = isWeekOffForSchedule(beforeDate, beforeSchedule)
  const weekOffAfter = isWeekOffForSchedule(afterDate, afterSchedule)
  if (weekOffBefore && weekOffAfter && !leaveDefinition.weekOffBothSideAllowed) {
    throw new Error("Week off is not allowed on both sides for this leave type.")
  }
  if (
    (weekOffBefore || weekOffAfter) &&
    !(weekOffBefore && weekOffAfter) &&
    !leaveDefinition.weekOffSingleSideAllowed
  ) {
    throw new Error("Week off is not allowed on a single side for this leave type.")
  }

  const holidaySet = new Set(holidayOverrides.map((item) => toIsoDate(item.date)))
  const holidayBefore = holidaySet.has(toIsoDate(beforeDate))
  const holidayAfter = holidaySet.has(toIsoDate(afterDate))
  if (holidayBefore && holidayAfter && !leaveDefinition.holidayBothSideAllowed) {
    throw new Error("Holiday is not allowed on both sides for this leave type.")
  }
  if (
    (holidayBefore || holidayAfter) &&
    !(holidayBefore && holidayAfter) &&
    !leaveDefinition.holidaySingleSideAllowed
  ) {
    throw new Error("Holiday is not allowed on a single side for this leave type.")
  }

  return {
    startDate: parsedStart,
    endDate: parsedEnd,
    daysCount,
  }
}

export const assertReviewTransitionAllowed = (
  currentStatus: "PENDING" | "APPROVED" | "REJECTED" | "CANCELED"
) => {
  if (currentStatus !== "PENDING") {
    throw new Error("Only pending leave requests can be reviewed.")
  }
}

export const assertCancelTransitionAllowed = (
  currentStatus: "PENDING" | "APPROVED" | "REJECTED" | "CANCELED"
) => {
  if (currentStatus !== "PENDING" && currentStatus !== "APPROVED") {
    throw new Error("Only pending or approved leave requests can be canceled.")
  }
}

export const leaveRequestSelect = {
  id: true,
  staffProfileId: true,
  leaveDefinitionId: true,
  startDate: true,
  endDate: true,
  daysCount: true,
  reason: true,
  status: true,
  reviewedByUserId: true,
  reviewedAt: true,
  reviewerComment: true,
  canceledAt: true,
  cancelReason: true,
  createdAt: true,
  updatedAt: true,
  leaveDefinition: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  staffProfile: {
    select: {
      id: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
  reviewedByUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.LeaveRequestSelect

export const serializeLeaveRequest = (item: LeaveRequestWithRelations): LeaveRequestRow => ({
  id: item.id,
  staffProfileId: item.staffProfileId,
  leaveDefinitionId: item.leaveDefinitionId,
  startDate: item.startDate.toISOString(),
  endDate: item.endDate.toISOString(),
  daysCount: item.daysCount,
  reason: item.reason,
  status: item.status,
  reviewedByUserId: item.reviewedByUserId,
  reviewedAt: item.reviewedAt ? item.reviewedAt.toISOString() : null,
  reviewerComment: item.reviewerComment,
  canceledAt: item.canceledAt ? item.canceledAt.toISOString() : null,
  cancelReason: item.cancelReason,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
  leaveDefinition: item.leaveDefinition,
  staff: {
    id: item.staffProfile.id,
    userId: item.staffProfile.user.id,
    name: item.staffProfile.user.name,
    email: item.staffProfile.user.email,
  },
  reviewedBy: item.reviewedByUser
    ? {
        id: item.reviewedByUser.id,
        name: item.reviewedByUser.name,
        email: item.reviewedByUser.email,
      }
    : null,
})

type BuildLeaveRequestRuleChecksInput = {
  tx: DbClient
  staffProfileId: string
  staffGender: "MALE" | "FEMALE" | "NON_BINARY" | "OTHER" | "PREFER_NOT_TO_SAY" | null
  leaveDefinition: {
    allowedUsers: "MALE" | "FEMALE" | "ALL"
    minDaysPerRequest: number
    maxDaysPerRequest: number
    maxConsecutiveDays: number
    priorEntryAllowed: boolean
    noticeDays: number
    weekOffSingleSideAllowed: boolean
    weekOffBothSideAllowed: boolean
    holidaySingleSideAllowed: boolean
    holidayBothSideAllowed: boolean
  }
  startDate: Date
  endDate: Date
  createdAt: Date
}

const passFail = (passed: boolean): string => (passed ? "Pass" : "Fail")

export const buildLeaveRequestRuleChecks = async ({
  tx,
  staffProfileId,
  staffGender,
  leaveDefinition,
  startDate,
  endDate,
  createdAt,
}: BuildLeaveRequestRuleChecksInput): Promise<LeaveRequestRuleCheck[]> => {
  const checks: LeaveRequestRuleCheck[] = []
  const daysCount = getInclusiveDays(startDate, endDate)

  const allowedUsersPassed =
    leaveDefinition.allowedUsers === "ALL" ||
    (leaveDefinition.allowedUsers === "MALE" && staffGender === "MALE") ||
    (leaveDefinition.allowedUsers === "FEMALE" && staffGender === "FEMALE")
  checks.push({
    key: "allowedUsers",
    label: "Allowed users",
    passed: allowedUsersPassed,
    detail: `${passFail(allowedUsersPassed)} (${leaveDefinition.allowedUsers})`,
  })

  const minMaxPassed =
    daysCount >= leaveDefinition.minDaysPerRequest &&
    daysCount <= leaveDefinition.maxDaysPerRequest
  checks.push({
    key: "minMaxDays",
    label: "Min/Max days per request",
    passed: minMaxPassed,
    detail: `${passFail(minMaxPassed)} (${daysCount} day(s), allowed ${leaveDefinition.minDaysPerRequest}-${leaveDefinition.maxDaysPerRequest})`,
  })

  const consecutivePassed = daysCount <= leaveDefinition.maxConsecutiveDays
  checks.push({
    key: "maxConsecutiveDays",
    label: "Max consecutive days",
    passed: consecutivePassed,
    detail: `${passFail(consecutivePassed)} (${daysCount}/${leaveDefinition.maxConsecutiveDays})`,
  })

  const createdDateOnly = new Date(
    Date.UTC(createdAt.getUTCFullYear(), createdAt.getUTCMonth(), createdAt.getUTCDate())
  )
  const priorEntryPassed = leaveDefinition.priorEntryAllowed || startDate >= createdDateOnly
  checks.push({
    key: "priorEntryAllowed",
    label: "Prior leave entry",
    passed: priorEntryPassed,
    detail: `${passFail(priorEntryPassed)} (${leaveDefinition.priorEntryAllowed ? "allowed" : "not allowed"})`,
  })

  const minStartByNotice = addDays(createdDateOnly, leaveDefinition.noticeDays)
  const noticePassed = startDate >= minStartByNotice
  checks.push({
    key: "noticeDays",
    label: "Notice days",
    passed: noticePassed,
    detail: `${passFail(noticePassed)} (${leaveDefinition.noticeDays} day(s) required)`,
  })

  const edgeDates = [addDays(startDate, -1), addDays(endDate, 1)]
  const [beforeDate, afterDate] = edgeDates
  const [beforeSchedule, afterSchedule, holidayOverrides] = await Promise.all([
    getScheduleForDate(tx, staffProfileId, beforeDate),
    getScheduleForDate(tx, staffProfileId, afterDate),
    tx.appSettingOverride.findMany({
      where: {
        date: { in: edgeDates },
        isOpen: false,
      },
      select: { date: true },
    }),
  ])

  const weekOffBefore = isWeekOffForSchedule(beforeDate, beforeSchedule)
  const weekOffAfter = isWeekOffForSchedule(afterDate, afterSchedule)
  const weekOffPassed = !(
    (weekOffBefore && weekOffAfter && !leaveDefinition.weekOffBothSideAllowed) ||
    ((weekOffBefore || weekOffAfter) &&
      !(weekOffBefore && weekOffAfter) &&
      !leaveDefinition.weekOffSingleSideAllowed)
  )
  checks.push({
    key: "weekOffRules",
    label: "Week off side rules",
    passed: weekOffPassed,
    detail: `${passFail(weekOffPassed)} (single:${leaveDefinition.weekOffSingleSideAllowed ? "Y" : "N"}, both:${leaveDefinition.weekOffBothSideAllowed ? "Y" : "N"})`,
  })

  const holidaySet = new Set(holidayOverrides.map((item) => toIsoDate(item.date)))
  const holidayBefore = holidaySet.has(toIsoDate(beforeDate))
  const holidayAfter = holidaySet.has(toIsoDate(afterDate))
  const holidayPassed = !(
    (holidayBefore && holidayAfter && !leaveDefinition.holidayBothSideAllowed) ||
    ((holidayBefore || holidayAfter) &&
      !(holidayBefore && holidayAfter) &&
      !leaveDefinition.holidaySingleSideAllowed)
  )
  checks.push({
    key: "holidayRules",
    label: "Holiday side rules",
    passed: holidayPassed,
    detail: `${passFail(holidayPassed)} (single:${leaveDefinition.holidaySingleSideAllowed ? "Y" : "N"}, both:${leaveDefinition.holidayBothSideAllowed ? "Y" : "N"})`,
  })

  return checks
}

type BuildLeaveRequestTimelineInput = {
  createdAt: Date
  staffName: string | null
  staffEmail: string
  reviewedAt: Date | null
  reviewedByName: string | null
  reviewedByEmail: string | null
  reviewerComment: string | null
  canceledAt: Date | null
  cancelReason: string | null
}

export const buildLeaveRequestTimeline = ({
  createdAt,
  staffName,
  staffEmail,
  reviewedAt,
  reviewedByName,
  reviewedByEmail,
  reviewerComment,
  canceledAt,
  cancelReason,
}: BuildLeaveRequestTimelineInput): LeaveRequestTimelineEvent[] => {
  const timeline: LeaveRequestTimelineEvent[] = [
    {
      key: "submitted",
      title: "Submitted",
      at: createdAt.toISOString(),
      byName: staffName,
      byEmail: staffEmail,
      comment: null,
    },
  ]

  if (reviewedAt) {
    timeline.push({
      key: "reviewed",
      title: "Reviewed",
      at: reviewedAt.toISOString(),
      byName: reviewedByName,
      byEmail: reviewedByEmail,
      comment: reviewerComment,
    })
  }

  if (canceledAt) {
    timeline.push({
      key: "canceled",
      title: "Canceled",
      at: canceledAt.toISOString(),
      byName: null,
      byEmail: null,
      comment: cancelReason,
    })
  }

  return timeline
}
