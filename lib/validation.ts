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
})

export const updateServiceSchema = createServiceSchema.partial()

export type CreateServiceInput = z.infer<typeof createServiceSchema>
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>

export const appSettingsSchema = z.object({
  locale: z.string().trim().min(2).max(20),
  currency: z.string().trim().min(3).max(3),
  timeZone: z.string().trim().min(2).max(64),
  dateFormat: z.string().trim().min(4).max(20),
})

export type AppSettingsInput = z.infer<typeof appSettingsSchema>
