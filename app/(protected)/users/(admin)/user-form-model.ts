import type { Role } from "@/lib/permissions"
import type { Gender, UserFormValues, UserStatus } from "@/types/users"

export const roleOptions: Role[] = ["ADMIN", "MANAGER", "STAFF", "CUSTOMER"]

export const genderOptions: Gender[] = [
  "MALE",
  "FEMALE",
  "NON_BINARY",
  "OTHER",
  "PREFER_NOT_TO_SAY",
]

export const statusOptions: UserStatus[] = [
  "ACTIVE",
  "SUSPENDED",
  "INVITED",
  "ARCHIVED",
]

export const defaultUserFormValues: UserFormValues = {
  name: "",
  email: "",
  phone: "",
  image: "",
  dateOfBirth: "",
  gender: "PREFER_NOT_TO_SAY",
  status: "ACTIVE",
  marketingOptIn: false,
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  role: "CUSTOMER",
  password: "",
}

export const toDateInput = (value?: string | null) => (value ? value.slice(0, 10) : "")
