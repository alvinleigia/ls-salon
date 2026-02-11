"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/form-field"
import { useFormErrors } from "@/hooks/use-form-errors"

export default function SignUpPage() {
  const router = useRouter()
  const { status } = useSession()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [image, setImage] = useState("")
  const [loading, setLoading] = useState(false)
  const { errors, setErrorsFromResponse, clearErrors } = useFormErrors()

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard")
    }
  }, [router, status])

  if (status === "authenticated") {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
        </CardHeader>

        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              setLoading(true)
              clearErrors()

              const response = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password, phone, image }),
              })

              if (!response.ok) {
                const data = (await response.json()) as {
                  error?: string
                  details?: { fieldErrors?: Record<string, string[]> }
                }
                setErrorsFromResponse(data)
                toast.error(data.error ?? "Unable to create account.")
                setLoading(false)
                return
              }

              toast.success("Account created. Please sign in.")
              router.push("/auth/signin")
            }}
          >
            <FormField id="name" label="Name" error={errors.name}>
              <Input
                id="name"
                type="text"
                placeholder="Alvin Araujo"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FormField>

            <FormField id="email" label="Email" error={errors.email}>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>

            <FormField id="password" label="Password" error={errors.password}>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>

            <FormField id="phone" label="Mobile number" error={errors.phone}>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 555 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </FormField>

            <FormField id="image" label="Profile image URL" error={errors.image}>
              <Input
                id="image"
                type="url"
                placeholder="https://..."
                value={image}
                onChange={(e) => setImage(e.target.value)}
              />
            </FormField>

            <Button className="w-full" type="submit" loading={loading} loadingText="Creating...">
              Create account
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button
              type="button"
              className="text-primary underline-offset-4 hover:underline"
              onClick={() => router.push("/auth/signin")}
            >
              Sign in
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
