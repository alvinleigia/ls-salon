"use client"

import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/form-field"
import { useFormErrors } from "@/hooks/use-form-errors"

export default function InvitePage() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const { errors, setErrorsFromResponse, clearErrors } = useFormErrors()
  const [submitted, setSubmitted] = useState(false)

  const submit = async () => {
    if (!token) {
      toast.error("Invite token is missing.")
      return
    }

    setLoading(true)
    clearErrors()
    const response = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, password }),
    })

    if (!response.ok) {
      const data = (await response.json()) as {
        error?: string
        details?: { fieldErrors?: Record<string, string[]> }
      }
      setErrorsFromResponse(data)
      toast.error(data.error ?? "Unable to accept invite.")
      setLoading(false)
      return
    }

    toast.success("Account created. Please sign in.")
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {submitted ? "You’re all set!" : "Set your password"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {submitted ? (
            <>
              <p className="text-sm text-muted-foreground">
                Thanks for signing up. Your account is ready. Please sign in
                to continue.
              </p>
              <Button
                className="w-full"
                onClick={() => (window.location.href = "/auth/signin")}
              >
                Go to sign in
              </Button>
            </>
          ) : (
            <>
              <FormField id="name" label="Full name" error={errors.name}>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </FormField>
              <FormField id="password" label="Password" error={errors.password}>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </FormField>
              <Button className="w-full" onClick={submit} loading={loading} loadingText="Submitting...">
                Create account
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
