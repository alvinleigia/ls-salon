"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangleIcon,
  CalendarClockIcon,
  CreditCardIcon,
  ScissorsIcon,
  UsersIcon,
} from "lucide-react"
import type { DateRange } from "react-day-picker"

import { DateRangePicker } from "@/components/date-range-picker"
import { useDateFormatter } from "@/hooks/use-date-formatter"
import { formatCurrencyFromCents } from "@/lib/formatting"
import type { AppSettingsPayload } from "@/types/scheduling"

type DashboardSummary = {
  range: {
    label: string
    startDate: string
    endDate: string
  }
  kpis: {
    revenueCents: number
    revenueTodayCents: number
    appointments: number
    appointmentsToday: number
    distinctCustomers: number
    pendingLeaves: number
    activeServices: number
    activeStaff: number
  }
  series: {
    daily: Array<{
      date: string
      label: string
      revenueCents: number
      bookings: number
    }>
  }
  appointmentStatus: Array<{
    status: string
    count: number
  }>
  topServices: Array<{
    serviceId: string
    name: string
    bookings: number
    revenueCents: number
  }>
  staffUtilization: Array<{
    staffProfileId: string
    name: string
    bookings: number
    bookedMinutes: number
    utilizationPercent: number
  }>
  upcomingAppointments: Array<{
    id: string
    startAt: string
    status: string
    customerName: string
    staffName: string
    serviceName: string
    priceCents: number
  }>
  lowStock: Array<{
    id: string
    sku: string
    name: string
    categoryName: string
    onHandQty: number
    reorderPoint: number
    reorderQty: number
  }>
  generatedAt: string
}

const pieColors = ["#22c55e", "#38bdf8", "#f59e0b", "#f97316", "#ef4444", "#a855f7"]

const normalizeStatusLabel = (status: string) =>
  status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

export default function DashboardPage() {
  const [range, setRange] = React.useState<"today" | "week" | "month" | "custom">("week")
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>()
  const [settings, setSettings] = React.useState<
    Pick<
      AppSettingsPayload,
      "currency" | "currencySymbolPlacement" | "locale" | "numberFormat" | "firstDayOfWeek"
    >
  >({})
  const [summary, setSummary] = React.useState<DashboardSummary | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const { formatDate } = useDateFormatter()

  React.useEffect(() => {
    let mounted = true
    fetch("/api/settings", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null
        const data = (await response.json()) as { settings?: AppSettingsPayload }
        return data.settings ?? null
      })
      .then((data) => {
        if (!mounted || !data) return
        setSettings({
          currency: data.currency,
          currencySymbolPlacement: data.currencySymbolPlacement,
          locale: data.locale,
          numberFormat: data.numberFormat,
          firstDayOfWeek: data.firstDayOfWeek,
        })
      })
      .catch(() => undefined)

    return () => {
      mounted = false
    }
  }, [])

  React.useEffect(() => {
    let mounted = true
    const query = new URLSearchParams({ range })
    if (range === "custom" && dateRange?.from && dateRange?.to) {
      query.set("startDate", dateRange.from.toISOString().slice(0, 10))
      query.set("endDate", dateRange.to.toISOString().slice(0, 10))
    }

    setLoading(true)
    setError(null)

    fetch(`/api/dashboard/summary?${query.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error || "Unable to load dashboard")
        }
        return (await response.json()) as DashboardSummary
      })
      .then((data) => {
        if (!mounted) return
        setSummary(data)
      })
      .catch((fetchError) => {
        if (!mounted) return
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load dashboard")
      })
      .finally(() => {
        if (!mounted) return
        setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [range, dateRange])

  const rangeText = React.useMemo(() => {
    if (!summary?.range) return ""
    const from = new Date(`${summary.range.startDate}T00:00:00.000Z`)
    const to = new Date(`${summary.range.endDate}T00:00:00.000Z`)
    return `${formatDate(from)} - ${formatDate(to)}`
  }, [formatDate, summary])

  const revenueSeries = React.useMemo(
    () =>
      (summary?.series.daily ?? []).map((row) => ({
        ...row,
        revenue: Number((row.revenueCents / 100).toFixed(2)),
      })),
    [summary]
  )

  const headerCards = React.useMemo(() => {
    if (!summary) return []
    return [
      {
        label: "Revenue",
        value: formatCurrencyFromCents(summary.kpis.revenueCents, settings),
        hint: `Today ${formatCurrencyFromCents(summary.kpis.revenueTodayCents, settings)}`,
        icon: CreditCardIcon,
      },
      {
        label: "Appointments",
        value: String(summary.kpis.appointments),
        hint: `Today ${summary.kpis.appointmentsToday}`,
        icon: CalendarClockIcon,
      },
      {
        label: "Unique customers",
        value: String(summary.kpis.distinctCustomers),
        hint: `${summary.kpis.activeStaff} active staff`,
        icon: UsersIcon,
      },
      {
        label: "Pending leaves",
        value: String(summary.kpis.pendingLeaves),
        hint: `${summary.kpis.activeServices} active services`,
        icon: ScissorsIcon,
      },
    ]
  }, [settings, summary])

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-[#0b0b0b] via-[#151515] to-[#1f1f1f] p-6 text-white">
        <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-12 left-12 h-40 w-40 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-white/60">Salon Overview</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight font-serif">
                {summary?.range.label || "Dashboard"}
              </h1>
              <p className="mt-1 text-xs text-white/70">{rangeText || "Choose a range to view live metrics"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-2 py-1">
                {[
                  { id: "today", label: "Today" },
                  { id: "week", label: "Week" },
                  { id: "month", label: "Month" },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setRange(option.id as "today" | "week" | "month")
                      setDateRange(undefined)
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      range === option.id ? "bg-white text-black" : "text-white/70 hover:text-white"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <DateRangePicker
                value={dateRange}
                onChange={(next) => {
                  setDateRange(next)
                  if (next?.from && next?.to) setRange("custom")
                }}
                buttonClassName="rounded-full bg-white/5 border-white/20 text-white hover:bg-white/10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-white/70">Loading metrics...</div>
          ) : error ? (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {headerCards.map((card) => (
                <div key={card.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span>{card.label}</span>
                    <card.icon className="h-4 w-4" />
                  </div>
                  <div className="mt-3 text-2xl font-semibold">{card.value}</div>
                  <div className="mt-1 text-xs text-white/60">{card.hint}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-3">
            <h2 className="text-lg font-semibold">Revenue trend</h2>
            <p className="text-xs text-muted-foreground">Revenue and booking volume by day</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries}>
                <defs>
                  <linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="label" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "#0f0f0f", border: "1px solid #2a2a2a" }}
                  formatter={(value, name) => {
                    if (name === "revenue") {
                      return [formatCurrencyFromCents(Math.round(Number(value) * 100), settings), "Revenue"]
                    }
                    return [String(value), "Bookings"]
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} fill="url(#dashboardRevenueFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-3">
            <h2 className="text-lg font-semibold">Appointment status mix</h2>
            <p className="text-xs text-muted-foreground">Status distribution in selected range</p>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={summary?.appointmentStatus ?? []} dataKey="count" nameKey="status" innerRadius={42} outerRadius={72} paddingAngle={3}>
                  {(summary?.appointmentStatus ?? []).map((_, index) => (
                    <Cell key={`status-${index}`} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#0f0f0f", border: "1px solid #2a2a2a" }}
                  formatter={(value, _name, payload) => [String(value), normalizeStatusLabel(String(payload?.payload?.status || "Status"))]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            {(summary?.appointmentStatus ?? []).slice(0, 5).map((row) => (
              <div key={row.status} className="flex items-center justify-between">
                <span>{normalizeStatusLabel(row.status)}</span>
                <span className="font-medium text-foreground">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-3">
            <h2 className="text-lg font-semibold">Daily bookings</h2>
            <p className="text-xs text-muted-foreground">Booking count by day</p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary?.series.daily ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="label" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#0f0f0f", border: "1px solid #2a2a2a" }} />
                <Bar dataKey="bookings" fill="#38bdf8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-3">
            <h2 className="text-lg font-semibold">Staff load today</h2>
            <p className="text-xs text-muted-foreground">Booked time vs 8-hour day</p>
          </div>
          <div className="space-y-3">
            {(summary?.staffUtilization ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground">No staff bookings for today.</div>
            ) : (
              (summary?.staffUtilization ?? []).map((staff) => (
                <div key={staff.staffProfileId} className="rounded-xl border bg-muted/20 px-3 py-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{staff.name}</span>
                    <span className="text-xs text-muted-foreground">{staff.bookings} bookings</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${staff.utilizationPercent}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {Math.round(staff.bookedMinutes / 60)}h {staff.bookedMinutes % 60}m booked ({staff.utilizationPercent}%)
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Upcoming appointments</h2>
              <p className="text-xs text-muted-foreground">Next confirmed/scheduled slots</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b">
                  <th className="py-3 text-left">Time</th>
                  <th className="py-3 text-left">Customer</th>
                  <th className="py-3 text-left">Service</th>
                  <th className="py-3 text-left">Staff</th>
                  <th className="py-3 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {(summary?.upcomingAppointments ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-5 text-center text-muted-foreground">No upcoming appointments.</td>
                  </tr>
                ) : (
                  (summary?.upcomingAppointments ?? []).map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-3 text-muted-foreground">{new Date(row.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="py-3 font-medium">{row.customerName}</td>
                      <td className="py-3 text-muted-foreground">{row.serviceName}</td>
                      <td className="py-3 text-muted-foreground">{row.staffName}</td>
                      <td className="py-3 text-right font-semibold">{formatCurrencyFromCents(row.priceCents, settings)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Low stock alerts</h2>
              <p className="text-xs text-muted-foreground">Products at or below reorder point</p>
            </div>
            <AlertTriangleIcon className="h-4 w-4 text-amber-500" />
          </div>
          <div className="space-y-3">
            {(summary?.lowStock ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground">No low stock items.</div>
            ) : (
              (summary?.lowStock ?? []).map((item) => (
                <div key={item.id} className="rounded-xl border bg-muted/20 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{item.name}</span>
                    <span className="text-xs text-muted-foreground">{item.sku}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.categoryName}</div>
                  <div className="mt-2 text-xs">
                    On hand <span className="font-semibold text-foreground">{item.onHandQty}</span> / Reorder point{" "}
                    <span className="font-semibold text-foreground">{item.reorderPoint}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Top services</h2>
          <p className="text-xs text-muted-foreground">Revenue leaders in selected range</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b">
                <th className="py-3 text-left">Service</th>
                <th className="py-3 text-right">Bookings</th>
                <th className="py-3 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.topServices ?? []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-5 text-center text-muted-foreground">No service sales in selected range.</td>
                </tr>
              ) : (
                (summary?.topServices ?? []).map((row) => (
                  <tr key={row.serviceId} className="border-b last:border-0">
                    <td className="py-3 font-medium">{row.name}</td>
                    <td className="py-3 text-right">{row.bookings}</td>
                    <td className="py-3 text-right font-semibold">{formatCurrencyFromCents(row.revenueCents, settings)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
