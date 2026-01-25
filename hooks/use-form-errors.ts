import * as React from "react"

type FieldErrors = Record<string, string[] | undefined>

type ErrorResponse = {
  error?: string
  details?: { fieldErrors?: FieldErrors }
}

export function mapFieldErrors(fieldErrors?: FieldErrors) {
  if (!fieldErrors) return {}
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .filter(([, value]) => value?.length)
      .map(([key, value]) => [key, value?.[0] ?? "Invalid value."])
  ) as Record<string, string>
}

export function useFormErrors<T extends string = string>() {
  const [errors, setErrors] = React.useState<Record<T, string>>(
    {} as Record<T, string>
  )

  const setErrorsFromResponse = React.useCallback((data?: ErrorResponse) => {
    const mapped = mapFieldErrors(data?.details?.fieldErrors)
    setErrors(mapped as Record<T, string>)
  }, [])

  const clearErrors = React.useCallback(() => {
    setErrors({} as Record<T, string>)
  }, [])

  return { errors, setErrors, setErrorsFromResponse, clearErrors }
}
