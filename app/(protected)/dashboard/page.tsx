"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  CalendarClockIcon,
  CreditCardIcon,
  ScissorsIcon,
  UsersIcon,
} from "lucide-react"

import { formatCurrencyFromCents } from "@/lib/formatting"
import { useDateFormatter } from "@/hooks/use-date-formatter"
import type { AppSettingsPayload, Weekday } from "@/types/scheduling"
import { DateRangePicker } from "@/components/date-range-picker"
import type { DateRange } from "react-day-picker"

const serviceMix = [
  { name: "Hair", value: 42 },
  { name: "Nails", value: 18 },
  { name: "Skin", value: 21 },
  { name: "Waxing", value: 11 },
  { name: "Packages", value: 8 },
]

const todaySeries = [
  { label: "9 AM", revenue: 4200, bookings: 4 },
  { label: "10 AM", revenue: 6200, bookings: 6 },
  { label: "11 AM", revenue: 5400, bookings: 5 },
  { label: "12 PM", revenue: 7300, bookings: 7 },
  { label: "1 PM", revenue: 6900, bookings: 6 },
  { label: "2 PM", revenue: 7800, bookings: 8 },
  { label: "3 PM", revenue: 6400, bookings: 6 },
  { label: "4 PM", revenue: 7100, bookings: 7 },
]

const weekSeries = [
  { label: "Mon", revenue: 12800, bookings: 22 },
  { label: "Tue", revenue: 15400, bookings: 28 },
  { label: "Wed", revenue: 13900, bookings: 24 },
  { label: "Thu", revenue: 18100, bookings: 32 },
  { label: "Fri", revenue: 22400, bookings: 36 },
  { label: "Sat", revenue: 26800, bookings: 41 },
  { label: "Sun", revenue: 17200, bookings: 27 },
]

const monthSeries = [
  { label: "Week 1", revenue: 61200, bookings: 121 },
  { label: "Week 2", revenue: 70500, bookings: 138 },
  { label: "Week 3", revenue: 64800, bookings: 129 },
  { label: "Week 4", revenue: 78100, bookings: 151 },
]

const staffUtilization = [
  { name: "Priya", rate: 86, hours: 7.4, next: "11:40 AM" },
  { name: "Mia", rate: 79, hours: 6.2, next: "10:50 AM" },
  { name: "Jordan", rate: 74, hours: 5.8, next: "12:10 PM" },
  { name: "Aiden", rate: 69, hours: 5.1, next: "11:05 AM" },
  { name: "Elise", rate: 63, hours: 4.6, next: "10:30 AM" },
]

const recentBookings = [
  { customer: "Riya Kapoor", service: "Brow Wax", staff: "Priya", time: "10:20 AM", totalCents: 49000 },
  { customer: "Daniel S", service: "Classic Facial", staff: "Mia", time: "10:40 AM", totalCents: 185000 },
  { customer: "Aarav Mehta", service: "Gel Manicure", staff: "Elise", time: "11:10 AM", totalCents: 120000 },
  { customer: "Nora B", service: "Blowout", staff: "Jordan", time: "11:30 AM", totalCents: 90000 },
  { customer: "Kiran Shah", service: "Keratin", staff: "Aiden", time: "12:05 PM", totalCents: 440000 },
]

const mixColors = ["#0ea5e9", "#f97316", "#22c55e", "#e11d48", "#a855f7"]

export default function DashboardPage() {
  const [range, setRange] = React.useState<"today" | "week" | "month" | "custom">("week")
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>()
  const [settings, setSettings] = React.useState<
    Pick<
      AppSettingsPayload,
      | "currency"
      | "currencySymbolPlacement"
      | "locale"
      | "numberFormat"
      | "firstDayOfWeek"
    >
  >({})
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

  const customSeries = React.useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return weekSeries
    const start = new Date(dateRange.from)
    const end = new Date(dateRange.to)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return weekSeries
    }
    const totalDays = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
    )
    const points = Math.min(12, totalDays)
    const step = Math.max(1, Math.floor(totalDays / points))
    const series: Array<{ label: string; revenue: number; bookings: number }> = []
    for (let i = 0; i < totalDays; i += step) {
      const current = new Date(start)
      current.setDate(start.getDate() + i)
      series.push({
        label: formatDate(current),
        revenue: 9000 + i * 280,
        bookings: 14 + Math.round(i * 0.6),
      })
    }
    if (series.length < 2) {
      series.push({
        label: formatDate(end),
        revenue: 9800,
        bookings: 16,
      })
    }
    return series
  }, [dateRange, formatDate])

  const rangeMeta = React.useMemo(() => {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const weekdayIndexMap: Record<Weekday, number> = {
      MONDAY: 1,
      TUESDAY: 2,
      WEDNESDAY: 3,
      THURSDAY: 4,
      FRIDAY: 5,
      SATURDAY: 6,
      SUNDAY: 0,
    }
    const firstDayIndex = weekdayIndexMap[settings.firstDayOfWeek ?? "SUNDAY"]
    const dayIndex = startOfDay.getDay()
    const diff = (dayIndex - firstDayIndex + 7) % 7
    const weekStart = new Date(startOfDay)
    weekStart.setDate(startOfDay.getDate() - diff)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    const monthStart = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1)
    const monthEnd = new Date(startOfDay.getFullYear(), startOfDay.getMonth() + 1, 0)

    if (range === "today") {
      return {
        label: "Today",
        rangeText: `${formatDate(startOfDay)} - ${formatDate(startOfDay)}`,
        series: todaySeries,
      }
    }
    if (range === "month") {
      return {
        label: "This month",
        rangeText: `${formatDate(monthStart)} - ${formatDate(monthEnd)}`,
        series: monthSeries,
      }
    }
    if (range === "custom" && dateRange?.from && dateRange?.to) {
      return {
        label: "Custom range",
        rangeText: `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`,
        series: customSeries,
      }
    }
    return {
      label: "This week",
      rangeText: `${formatDate(weekStart)} - ${formatDate(weekEnd)}`,
      series: weekSeries,
    }
  }, [customSeries, dateRange, formatDate, range, settings.firstDayOfWeek])

  const kpis = React.useMemo(() => {
    if (range === "today") {
      return {
        revenueCents: 12645000,
        appointments: "42",
        newClients: "9",
        upsellRate: "28%",
      }
    }
    if (range === "month") {
      return {
        revenueCents: 274600000,
        appointments: "612",
        newClients: "132",
        upsellRate: "31%",
      }
    }
    if (range === "custom" && dateRange?.from && dateRange?.to) {
      const days =
        Math.max(
          1,
          Math.round(
            (dateRange.to.getTime() - dateRange.from.getTime()) / (24 * 60 * 60 * 1000)
          ) + 1
        )
      const dailyRevenue = Math.round(96850000 / 7)
      return {
        revenueCents: dailyRevenue * days,
        appointments: String(Math.round((214 / 7) * days)),
        newClients: String(Math.max(1, Math.round((48 / 7) * days))),
        upsellRate: "29%",
      }
    }
    return {
      revenueCents: 96850000,
      appointments: "214",
      newClients: "48",
      upsellRate: "29%",
    }
  }, [dateRange, range])

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-[#0b0b0b] via-[#151515] to-[#1f1f1f] p-8 text-white">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-12 left-12 h-44 w-44 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">LS Salon Control</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight font-serif">
                {rangeMeta.label} pulse
              </h1>
              <p className="mt-2 text-sm text-white/70">
                Bookings, revenue, and staff load at a glance.
              </p>
              <p className="mt-2 text-xs text-white/50">
                {rangeMeta.rangeText}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Live updates every 10 min
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Revenue",
                value: formatCurrencyFromCents(kpis.revenueCents, settings),
                delta: "+12.4%",
                icon: CreditCardIcon,
              },
              {
                label: "Appointments",
                value: kpis.appointments,
                delta: "+6",
                icon: CalendarClockIcon,
              },
              {
                label: "New clients",
                value: kpis.newClients,
                delta: "+3",
                icon: UsersIcon,
              },
              {
                label: "Upsell rate",
                value: kpis.upsellRate,
                delta: "+4.2%",
                icon: ScissorsIcon,
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur"
              >
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>{card.label}</span>
                  <card.icon className="h-4 w-4 text-white/70" />
                </div>
                <div className="mt-3 text-2xl font-semibold">{card.value}</div>
                <div className="mt-2 text-xs text-emerald-300">{card.delta}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold font-serif">Revenue & bookings</h2>
          <p className="text-sm text-muted-foreground">
            Comparing revenue and volume for the selected window.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border bg-card px-2 py-1">
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
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
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
              if (next?.from && next?.to) {
                setRange("custom")
              }
            }}
            buttonClassName="rounded-full"
          />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Revenue trend</h3>
              <p className="text-xs text-muted-foreground">
                Average ticket size: {formatCurrencyFromCents(301000, settings)}
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-500">
              +18.7% vs last period
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rangeMeta.series}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="label" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "#0f0f0f", border: "1px solid #2a2a2a" }}
                  labelStyle={{ color: "#e5e7eb" }}
                  formatter={(value) => [
                    formatCurrencyFromCents(Number(value) * 100, settings),
                    "Revenue",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#revFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Service mix</h3>
            <p className="text-xs text-muted-foreground">Share of total revenue</p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={serviceMix} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={4}>
                  {serviceMix.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={mixColors[index % mixColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#0f0f0f", border: "1px solid #2a2a2a" }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 rounded-xl border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            Top driver: Hair services (42%) with strong package conversion.
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border bg-card p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Bookings vs walk-ins</h3>
            <p className="text-xs text-muted-foreground">Volume by segment</p>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rangeMeta.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="label" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "#0f0f0f", border: "1px solid #2a2a2a" }}
                />
                <Bar dataKey="bookings" fill="#38bdf8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Staff utilization</h3>
            <p className="text-xs text-muted-foreground">Hours booked today</p>
          </div>
          <div className="space-y-3">
            {staffUtilization.map((staff) => (
              <div
                key={staff.name}
                className="rounded-xl border bg-muted/20 px-4 py-3"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{staff.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Next slot {staff.next}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: `${staff.rate}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{staff.hours} hrs booked</span>
                  <span>{staff.rate}% utilization</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Recent bookings</h3>
            <p className="text-xs text-muted-foreground">Latest confirmed appointments</p>
          </div>
          <button
            type="button"
            className="rounded-full border px-4 py-1 text-xs font-medium"
          >
            View all
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b">
                <th className="py-3 text-left">Customer</th>
                <th className="py-3 text-left">Service</th>
                <th className="py-3 text-left">Staff</th>
                <th className="py-3 text-left">Time</th>
                <th className="py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.map((row) => (
                <tr key={`${row.customer}-${row.time}`} className="border-b last:border-0">
                  <td className="py-3 font-medium">{row.customer}</td>
                  <td className="py-3 text-muted-foreground">{row.service}</td>
                  <td className="py-3 text-muted-foreground">{row.staff}</td>
                  <td className="py-3 text-muted-foreground">{row.time}</td>
                  <td className="py-3 text-right font-semibold">
                    {formatCurrencyFromCents(row.totalCents, settings)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
