import type { Gender, ProfileFormValues } from "@/types/users"

export const profileGenderOptions: Gender[] = [
  "MALE",
  "FEMALE",
  "NON_BINARY",
  "OTHER",
  "PREFER_NOT_TO_SAY",
]

export const defaultProfileFormValues: ProfileFormValues = {
  name: "",
  email: "",
  phone: "",
  image: "",
  dateOfBirth: "",
  gender: "PREFER_NOT_TO_SAY",
  marketingOptIn: false,
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
}

export const toDateInput = (value?: string | null) => (value ? value.slice(0, 10) : "")
