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
const chartTooltipContentStyle = {
  backgroundColor: "hsl(var(--popover))",
  opacity: 1,
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.5rem",
  boxShadow: "0 10px 25px rgba(0, 0, 0, 0.28)",
  color: "hsl(var(--popover-foreground))",
  padding: "8px 10px",
}
const chartTooltipLabelStyle = {
  color: "hsl(var(--muted-foreground))",
  fontSize: "12px",
}
const chartTooltipItemStyle = {
  color: "hsl(var(--popover-foreground))",
  fontSize: "12px",
  fontWeight: 500,
}

const normalizeStatusLabel = (status: string) =>
  status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

const parseDateOnlyLocal = (value: string) => {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

const toDateOnlyLocal = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export default function DashboardPage() {
  const [range, setRange] = React.useState<"today" | "week" | "month" | "custom">("week")
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>()
  const [settings, setSettings] = React.useState<
    Pick<
      AppSettingsPayload,
      "currency" | "currencySymbolPlacement" | "locale" | "numberFormat" | "firstDayOfWeek" | "timeZone"
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
          timeZone: data.timeZone,
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
      query.set("startDate", toDateOnlyLocal(dateRange.from))
      query.set("endDate", toDateOnlyLocal(dateRange.to))
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
    const from = parseDateOnlyLocal(summary.range.startDate)
    const to = parseDateOnlyLocal(summary.range.endDate)
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

  const formatUpcomingDate = React.useCallback(
    (value: string) => formatDate(value),
    [formatDate]
  )

  const formatUpcomingTime = React.useCallback(
    (value: string) =>
      new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: settings.timeZone,
      }),
    [settings.timeZone]
  )

  React.useEffect(() => {
    if (!summary) return

    const dailyBookingsTotal = summary.series.daily.reduce((sum, row) => sum + row.bookings, 0)
    const statusTotal = summary.appointmentStatus.reduce((sum, row) => sum + row.count, 0)
    const staffBookingsTotal = summary.staffUtilization.reduce((sum, row) => sum + row.bookings, 0)
    const topServicesBookingsTotal = summary.topServices.reduce((sum, row) => sum + row.bookings, 0)
    const topServicesRevenueTotal = summary.topServices.reduce((sum, row) => sum + row.revenueCents, 0)

    console.groupCollapsed(
      `[Dashboard Debug] range=${range} uiRange=${summary.range.startDate}..${summary.range.endDate}`
    )

    console.log("Filter Query", {
      selectedRange: range,
      customFrom: dateRange?.from ? toDateOnlyLocal(dateRange.from) : null,
      customTo: dateRange?.to ? toDateOnlyLocal(dateRange.to) : null,
    })

    console.log("Widget: KPI Cards", summary.kpis)

    console.log("Widget: Daily Bookings", {
      points: summary.series.daily,
      totalBookingsFromSeries: dailyBookingsTotal,
    })

    console.log("Widget: Appointment Status Mix", {
      rows: summary.appointmentStatus,
      totalFromStatusMix: statusTotal,
    })

    console.log("Widget: Staff Load", {
      rows: summary.staffUtilization,
      totalStaffBookings: staffBookingsTotal,
      totalStaffBookedMinutes: summary.staffUtilization.reduce(
        (sum, row) => sum + row.bookedMinutes,
        0
      ),
    })

    console.log("Widget: Upcoming Appointments", {
      count: summary.upcomingAppointments.length,
      rows: summary.upcomingAppointments,
    })

    console.log("Widget: Top Services", {
      rows: summary.topServices,
      totalBookingsFromTopServices: topServicesBookingsTotal,
      totalRevenueFromTopServicesCents: topServicesRevenueTotal,
    })

    console.log("Widget: Low Stock", {
      count: summary.lowStock.length,
      rows: summary.lowStock,
    })

    console.log("Consistency Checks", {
      kpiAppointmentsEqualsDailyBookings:
        summary.kpis.appointments === dailyBookingsTotal,
      kpiAppointmentsEqualsStatusMix:
        summary.kpis.appointments === statusTotal,
      staffBookingsCanExceedAppointments:
        "Expected true when one appointment can involve one staff booking row; compare only after confirming filters",
    })

    console.log("Raw Summary Payload", summary)
    console.groupEnd()
  }, [dateRange?.from, dateRange?.to, range, summary])

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 text-slate-900 dark:from-[#0b0b0b] dark:via-[#151515] dark:to-[#1f1f1f] dark:text-white">
        <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-500/20" />
        <div className="absolute -bottom-12 left-12 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl dark:bg-sky-500/20" />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-600 dark:text-white/60">Salon Overview</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight font-serif">
                {summary?.range.label || "Dashboard"}
              </h1>
              <p className="mt-1 text-xs text-slate-600 dark:text-white/70">{rangeText || "Choose a range to view live metrics"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white/70 px-2 py-1 dark:border-white/15 dark:bg-white/5">
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
                      range === option.id
                        ? "bg-slate-900 text-white dark:bg-white dark:text-black"
                        : "text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white"
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
                buttonClassName="rounded-full border-slate-300 bg-white/70 text-slate-900 hover:bg-white dark:bg-white/5 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-slate-600 dark:text-white/70">Loading metrics...</div>
          ) : error ? (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-100">{error}</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {headerCards.map((card) => (
                <div key={card.label} className="rounded-xl border border-slate-300 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-white/70">
                    <span>{card.label}</span>
                    <card.icon className="h-4 w-4" />
                  </div>
                  <div className="mt-3 text-2xl font-semibold">{card.value}</div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-white/60">{card.hint}</div>
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
                  contentStyle={chartTooltipContentStyle}
                  labelStyle={chartTooltipLabelStyle}
                  itemStyle={chartTooltipItemStyle}
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
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null
                    const row = payload[0] as { value?: number; payload?: { status?: string } }
                    const label = normalizeStatusLabel(String(row.payload?.status || "Status"))
                    return (
                      <div className="rounded-md border bg-popover px-2 py-1 text-popover-foreground shadow-lg">
                        <div className="text-xs font-medium">
                          {label}: {row.value ?? 0}
                        </div>
                      </div>
                    )
                  }}
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
        <div className="rounded-2xl border bg-card p-5 h-full flex flex-col">
          <div className="mb-3">
            <h2 className="text-lg font-semibold">Daily bookings</h2>
            <p className="text-xs text-muted-foreground">Booking count by day</p>
          </div>
          <div className="min-h-[260px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={summary?.series.daily ?? []}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                barCategoryGap="18%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="label" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={chartTooltipContentStyle}
                  labelStyle={chartTooltipLabelStyle}
                  itemStyle={chartTooltipItemStyle}
                />
                <Bar dataKey="bookings" fill="#38bdf8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-3">
            <h2 className="text-lg font-semibold">Staff load</h2>
            <p className="text-xs text-muted-foreground">
              Booked time in selected range (8h/day baseline)
            </p>
          </div>
          <div className="space-y-3">
            {(summary?.staffUtilization ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground">No staff bookings in selected range.</div>
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
                  <th className="py-3 text-left">Date</th>
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
                    <td colSpan={6} className="py-5 text-center text-muted-foreground">No upcoming appointments.</td>
                  </tr>
                ) : (
                  (summary?.upcomingAppointments ?? []).map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-3 text-muted-foreground">{formatUpcomingDate(row.startAt)}</td>
                      <td className="py-3 text-muted-foreground">{formatUpcomingTime(row.startAt)}</td>
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
