import { z } from "zod"

export const roleSchema = z.enum(["ADMIN", "MANAGER", "STAFF", "CUSTOMER"])
export const genderSchema = z.enum([
  "MALE",
  "FEMALE",
  "NON_BINARY",
  "OTHER",
  "PREFER_NOT_TO_SAY",
])
export const statusSchema = z.enum(["ACTIVE", "SUSPENDED", "INVITED", "ARCHIVED"])
export const serviceCategoryStatusSchema = z.enum(["ACTIVE", "INACTIVE"])
export const serviceStatusSchema = z.enum(["ACTIVE", "INACTIVE"])
export const serviceTypeSchema = z.enum(["STANDARD", "PACKAGE"])
export const staffDocumentTypeSchema = z.enum(["ADDRESS", "ID", "OTHER"])
export const weekdaySchema = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
])
export const appSettingPeriodTypeSchema = z.enum(["WORK", "BREAK"])

const optionalDate = z
  .preprocess((value) => {
    if (!value) return undefined
    if (value instanceof Date) return value
    const date = new Date(String(value))
    return Number.isNaN(date.getTime()) ? undefined : date
  }, z.date().optional())

const optionalString = z.string().trim().optional().or(z.literal(""))

export const signUpSchema = z.object({
  name: z.string().trim().min(1).max(100).optional().or(z.literal("")),
  email: z.string().trim().email(),
  password: z.string().trim().min(6).max(100),
  phone: z.string().trim().min(7).max(20).optional().or(z.literal("")),
  image: z.string().trim().url().optional().or(z.literal("")),
  dateOfBirth: optionalDate,
  gender: genderSchema.optional(),
  marketingOptIn: z.boolean().optional(),
  addressLine1: optionalString,
  addressLine2: optionalString,
  city: optionalString,
  state: optionalString,
  postalCode: optionalString,
  country: optionalString,
})

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional().or(z.literal("")),
  email: z.string().trim().email(),
  role: roleSchema.optional(),
  password: z.string().trim().min(6).max(100),
  eligibleServiceIds: z.array(z.string().trim().min(1)).optional(),
  phone: z.string().trim().min(7).max(20).optional().or(z.literal("")),
  image: z.string().trim().url().optional().or(z.literal("")),
  dateOfBirth: optionalDate,
  gender: genderSchema.optional(),
  status: statusSchema.optional(),
  marketingOptIn: z.boolean().optional(),
  addressLine1: optionalString,
  addressLine2: optionalString,
  city: optionalString,
  state: optionalString,
  postalCode: optionalString,
  country: optionalString,
})

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  role: roleSchema.optional(),
  password: z.string().trim().min(6).max(100).optional().or(z.literal("")),
  eligibleServiceIds: z.array(z.string().trim().min(1)).optional(),
  phone: z.string().trim().min(7).max(20).optional().or(z.literal("")),
  image: z.string().trim().url().optional().or(z.literal("")),
  dateOfBirth: optionalDate,
  gender: genderSchema.optional(),
  status: statusSchema.optional(),
  marketingOptIn: z.boolean().optional(),
  addressLine1: optionalString,
  addressLine2: optionalString,
  city: optionalString,
  state: optionalString,
  postalCode: optionalString,
  country: optionalString,
  staffProfile: z
    .object({
      documents: z
        .array(
          z.object({
            id: z.string().optional(),
            type: staffDocumentTypeSchema,
            number: z.string().trim().max(60).optional().or(z.literal("")),
            imageUrl: z.string().trim().url(),
            validFrom: z.string().optional().or(z.literal("")),
            validTo: z.string().optional().or(z.literal("")),
          })
        )
        .optional(),
      certifications: z
        .array(
          z.object({
            id: z.string().optional(),
            title: z.string().trim().min(1).max(120),
            issuer: z.string().trim().max(120).optional().or(z.literal("")),
            issuedAt: z.string().optional().or(z.literal("")),
            expiresAt: z.string().optional().or(z.literal("")),
          })
        )
        .optional(),
    })
    .optional(),
})

export const inviteUserSchema = z.object({
  email: z.string().trim().email(),
  role: roleSchema.optional(),
})

export const acceptInviteSchema = z.object({
  token: z.string().trim().min(10),
  name: z.string().trim().min(1).max(100).optional().or(z.literal("")),
  password: z.string().trim().min(6).max(100),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
})

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20),
  password: z.string().trim().min(6).max(100),
})

export const createServiceCategorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  status: serviceCategoryStatusSchema.optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
})

export const updateServiceCategorySchema = createServiceCategorySchema.partial()

export type CreateServiceCategoryInput = z.infer<
  typeof createServiceCategorySchema
>
export type UpdateServiceCategoryInput = z.infer<
  typeof updateServiceCategorySchema
>

export const createServiceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  categoryId: z.string().trim().min(1),
  durationMinutes: z.coerce.number().int().min(5).max(600),
  priceCents: z.coerce.number().int().min(0).max(1000000),
  status: serviceStatusSchema.optional(),
  type: serviceTypeSchema.optional(),
  packageItemIds: z.array(z.string().trim().min(1)).optional(),
})

export const updateServiceSchema = createServiceSchema.partial()

export type CreateServiceInput = z.infer<typeof createServiceSchema>
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>

const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number)
  return hours * 60 + minutes
}

const hasOverlaps = (periods: { startTime: string; endTime: string }[]) => {
  const sorted = [...periods].sort(
    (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)
  )
  for (let i = 0; i < sorted.length - 1; i += 1) {
    if (toMinutes(sorted[i].endTime) > toMinutes(sorted[i + 1].startTime)) {
      return true
    }
  }
  return false
}

export const appSettingsSchema = z
  .object({
  locale: z.string().trim().min(2).max(20),
  currency: z.string().trim().min(3).max(3),
  timeZone: z.string().trim().min(2).max(64),
  dateFormat: z.string().trim().min(4).max(20),
  workingHours: z
    .array(
      z.object({
        id: z.string().optional(),
        day: weekdaySchema,
        isOpen: z.boolean(),
        periods: z.array(
          z.object({
            id: z.string().optional(),
            kind: appSettingPeriodTypeSchema,
            startTime: z.string().regex(/^\d{2}:\d{2}$/),
            endTime: z.string().regex(/^\d{2}:\d{2}$/),
            sortOrder: z.coerce.number().int().min(0).optional(),
          })
        ),
      })
    )
    .optional(),
  overrides: z
    .array(
      z.object({
        id: z.string().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        isOpen: z.boolean(),
        periods: z.array(
          z.object({
            id: z.string().optional(),
            kind: appSettingPeriodTypeSchema,
            startTime: z.string().regex(/^\d{2}:\d{2}$/),
            endTime: z.string().regex(/^\d{2}:\d{2}$/),
            sortOrder: z.coerce.number().int().min(0).optional(),
          })
        ),
      })
    )
    .optional(),
})
  .superRefine((values, ctx) => {
    if (values.workingHours) {
      values.workingHours.forEach((day, dayIndex) => {
        if (!day.isOpen) return
        if (day.periods.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Add at least one period for open days.",
            path: ["workingHours", dayIndex, "periods"],
          })
          return
        }
        day.periods.forEach((period, periodIndex) => {
          if (toMinutes(period.startTime) >= toMinutes(period.endTime)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Start time must be before end time.",
              path: ["workingHours", dayIndex, "periods", periodIndex, "startTime"],
            })
          }
        })
        if (hasOverlaps(day.periods)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Periods cannot overlap.",
            path: ["workingHours", dayIndex, "periods"],
          })
        }
      })
    }

    if (values.overrides) {
      values.overrides.forEach((override, overrideIndex) => {
        if (!override.isOpen) return
        if (override.periods.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Add at least one period for open days.",
            path: ["overrides", overrideIndex, "periods"],
          })
          return
        }
        override.periods.forEach((period, periodIndex) => {
          if (toMinutes(period.startTime) >= toMinutes(period.endTime)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Start time must be before end time.",
              path: ["overrides", overrideIndex, "periods", periodIndex, "startTime"],
            })
          }
        })
        if (hasOverlaps(override.periods)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Periods cannot overlap.",
            path: ["overrides", overrideIndex, "periods"],
          })
        }
      })
    }
  })

export type AppSettingsInput = z.infer<typeof appSettingsSchema>

export const shiftTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(240).optional().or(z.literal("")),
    color: z.string().trim().max(40).optional().or(z.literal("")),
    isActive: z.boolean().optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    breaks: z.array(
      z.object({
        id: z.string().optional(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        sortOrder: z.coerce.number().int().min(0).optional(),
      })
    ),
  })
  .superRefine((values, ctx) => {
    if (toMinutes(values.startTime) >= toMinutes(values.endTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Shift start time must be before end time.",
        path: ["startTime"],
      })
    }
    const shiftStart = toMinutes(values.startTime)
    const shiftEnd = toMinutes(values.endTime)
    values.breaks.forEach((period, index) => {
      const breakStart = toMinutes(period.startTime)
      const breakEnd = toMinutes(period.endTime)
      if (breakStart >= breakEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Break start time must be before end time.",
          path: ["breaks", index, "startTime"],
        })
        return
      }
      if (breakStart < shiftStart || breakEnd > shiftEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Breaks must be within the shift range.",
          path: ["breaks", index, "startTime"],
        })
      }
    })
    if (hasOverlaps(values.breaks)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Breaks cannot overlap.",
        path: ["breaks"],
      })
    }
  })

export type ShiftTemplateInput = z.infer<typeof shiftTemplateSchema>

export const shiftScheduleSchema = z
  .object({
    name: z.string().trim().max(120).optional().or(z.literal("")),
    staffIds: z.array(z.string().trim().min(1)),
    isDefault: z.boolean().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    weekOffDay1: weekdaySchema,
    weekOffDay2: weekdaySchema.optional().or(z.literal("")),
    weekOff2Weeks: z
      .array(z.coerce.number().int().min(1).max(5))
      .optional()
      .default([]),
    blocks: z.array(
      z.object({
        id: z.string().optional(),
        templateId: z.string().trim().min(1),
        repeatDays: z.coerce.number().int().min(1).max(366),
        sortOrder: z.coerce.number().int().min(0).optional(),
      })
    ),
  })
  .superRefine((values, ctx) => {
    if (!values.isDefault && !values.staffIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one staff member.",
        path: ["staffIds"],
      })
    }
    if (values.isDefault && values.staffIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Default schedule should not target staff members.",
        path: ["staffIds"],
      })
    }
    if (!values.blocks.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add at least one shift block.",
        path: ["blocks"],
      })
    }
    if (values.weekOffDay2) {
      if (!values.weekOff2Weeks.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select weeks for the second week off day.",
          path: ["weekOff2Weeks"],
        })
      }
      if (values.weekOffDay2 === values.weekOffDay1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Week off day 2 must be different from week off day 1.",
          path: ["weekOffDay2"],
        })
      }
    } else if (values.weekOff2Weeks.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Week off day 2 is required when selecting week off 2 weeks.",
        path: ["weekOffDay2"],
      })
    }
  })

export type ShiftScheduleInput = z.infer<typeof shiftScheduleSchema>

export const shiftOverrideSchema = z
  .object({
    staffId: z.string().trim().min(1),
    templateId: z.string().trim().min(1).optional().or(z.literal("")),
    isUnavailable: z.boolean().optional().default(false),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    skipWeekOff: z.boolean().optional().default(true),
    skipHolidays: z.boolean().optional().default(true),
  })
  .superRefine((values, ctx) => {
    if (!values.isUnavailable && !values.templateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a shift template or mark as unavailable.",
        path: ["templateId"],
      })
    }
  })

export type ShiftOverrideInput = z.infer<typeof shiftOverrideSchema>
