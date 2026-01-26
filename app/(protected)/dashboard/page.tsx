export default function DashboardPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="lg:col-span-2 space-y-6">
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Today&apos;s bookings</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            14 appointments - 3 walk-ins - 2 VIP slots left
          </p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Stylist lineup</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Mia, Jordan, Priya, Aiden, and Elise are on the floor.
          </p>
        </div>
      </section>

      <aside className="space-y-6">
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Top service</h2>
          <p className="mt-2 text-sm text-muted-foreground">Color + blowout</p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Revenue goal</h2>
          <p className="mt-2 text-sm text-muted-foreground">$2,450 / $3,000</p>
        </div>
      </aside>
    </div>
  );
}
