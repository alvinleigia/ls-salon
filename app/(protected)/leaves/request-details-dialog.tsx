"use client"

import * as React from "react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { LeaveRequestDetail } from "@/types/leaves"

type LeaveRequestDetailsDialogProps = {
  requestId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LeaveRequestDetailsDialog({
  requestId,
  open,
  onOpenChange,
}: LeaveRequestDetailsDialogProps) {
  const [loading, setLoading] = React.useState(false)
  const [detail, setDetail] = React.useState<LeaveRequestDetail | null>(null)

  React.useEffect(() => {
    if (!open || !requestId) return
    let active = true
    setLoading(true)
    void fetch(`/api/leaves/requests/${requestId}?includeRuleChecks=true`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string }
          throw new Error(data.error ?? "Unable to load leave request details.")
        }
        return response.json() as Promise<LeaveRequestDetail>
      })
      .then((data) => {
        if (!active) return
        setDetail(data)
      })
      .catch((error: unknown) => {
        if (!active) return
        toast.error(error instanceof Error ? error.message : "Unable to load leave request details.")
        setDetail(null)
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, requestId])

  const item = detail?.item

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Leave request details</DialogTitle>
          <DialogDescription>
            {item
              ? `${item.leaveDefinition.code} - ${item.leaveDefinition.name}`
              : "View request timeline and rule checks."}
          </DialogDescription>
        </DialogHeader>

        {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}

        {!loading && item ? (
          <div className="space-y-5">
            <div className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Staff: </span>
                {item.staff.name || item.staff.email}
              </p>
              <p>
                <span className="text-muted-foreground">Status: </span>
                {item.status}
              </p>
              <p>
                <span className="text-muted-foreground">Date range: </span>
                {new Date(item.startDate).toLocaleDateString()} -{" "}
                {new Date(item.endDate).toLocaleDateString()}
              </p>
              <p>
                <span className="text-muted-foreground">Days: </span>
                {item.daysCount}
              </p>
              <p className="sm:col-span-2">
                <span className="text-muted-foreground">Reason: </span>
                {item.reason || "-"}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Timeline</h3>
              <div className="space-y-2 rounded-lg border p-3">
                {detail.timeline.map((event) => (
                  <div key={event.key} className="space-y-1 border-b pb-2 last:border-0 last:pb-0">
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.at).toLocaleString()}
                      {event.byName || event.byEmail
                        ? ` • ${event.byName || event.byEmail}`
                        : ""}
                    </p>
                    {event.comment ? <p className="text-sm">{event.comment}</p> : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Rule checks</h3>
              <div className="space-y-2 rounded-lg border p-3">
                {detail.ruleChecks.map((check) => (
                  <div key={check.key} className="grid gap-1 border-b pb-2 last:border-0 last:pb-0 sm:grid-cols-3">
                    <p className="text-sm font-medium sm:col-span-1">{check.label}</p>
                    <p className={`text-sm sm:col-span-2 ${check.passed ? "text-emerald-600" : "text-destructive"}`}>
                      {check.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
