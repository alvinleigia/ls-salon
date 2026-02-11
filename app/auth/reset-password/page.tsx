"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/form-field"

export default function ResetPasswordPage() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get("token") ?? ""
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) {
      toast.error("Reset token is missing.")
      return
    }
    if (password.trim().length < 6) {
      toast.error("Password must be at least 6 characters.")
      return
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.")
      return
    }

    setLoading(true)
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    })

    if (!response.ok) {
      const data = (await response.json()) as { error?: string }
      toast.error(data.error ?? "Unable to reset password.")
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>Your password has been reset.</p>
              <Button className="w-full" onClick={() => router.push("/auth/signin")}>
                Go to sign in
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              <FormField id="password" label="New password">
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </FormField>
              <FormField id="confirm" label="Confirm password">
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </FormField>
              <Button className="w-full" type="submit" loading={loading} loadingText="Resetting...">
                Reset password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
