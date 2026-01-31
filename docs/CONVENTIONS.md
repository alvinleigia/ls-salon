# Base Conventions

This is the baseline for new modules (API + UI) in this codebase.

## List API contract
- Params: `page` (1-based), `pageSize`, `sort`, `order`, `q`
- Response: `{ items, page, pageSize, total, totalPages }`
- Shared type: `types/api.ts` -> `ListResponse<T>`
- Notes:
  - Use `q` for simple text search.
  - `sort` matches a known column key; `order` is `asc` or `desc`.
  - Keep server-side pagination (do not load all rows).
  - List endpoints may optionally accept `status` filters when applicable.

## Permissions
- Use helpers from `lib/permissions.ts` in both server and client.
- Server always checks `auth()` + helper.
- UI should only hide/disable; server is source of truth.

## Delete policy (global)
- Default: **restrict delete** if the record is referenced by other records.
- When allowed, perform **soft delete** by setting status to INACTIVE/ARCHIVED.
- Use 409 responses with a clear message when deletion is blocked.
- If there are no associations, hard delete is allowed; otherwise soft delete.
- Use confirmation dialogs for destructive actions (no toast confirms or `window.confirm`).

## Validation + types
- Define Zod schemas in `lib/validation.ts`.
- Export inferred types from the same file (no separate DTOs unless needed).
- API: `schema.safeParse(body)` and return `{ error, details }` with `flatten()` on failure.

## Forms
- Use `FormField` from `components/form-field.tsx` for label/input/error.
- Use `useFormErrors` from `hooks/use-form-errors.ts` to map Zod field errors.
- Use the standard edit flow (list/detail pattern) used in Users: list view + dedicated edit page.
- Avoid bespoke split-edit panels for core admin flows unless explicitly required.
- Keep actions consistent with Users: primary save in page header; destructive actions require confirmation.

## Tables
- Use `components/data-table.tsx` with server-side pagination.
- Pass `totalRows` to `DataTablePagination`.
- Use `columnDef.meta.label` for column labels.
- Memoize column action handlers with `useCallback` and include them in `useMemo` deps.
- Suppress `react-hooks/incompatible-library` on `useReactTable` (TanStack) with an inline eslint disable.
- Prefer the standard DataTable + DataTableToolbar + DataTablePagination pattern for admin lists.

## Email templates
- Put templates in `lib/emails/*`.
- API routes import templates and pass `subject/text/html` into `mailer.sendMail`.

## Settings
- Global settings live under `/settings` (admin/manager).
- Start with locale, currency, time zone, and date format.
- Store working hours in settings with day-based periods (WORK/BREAK) and allow multiple breaks.
- Support special date overrides in settings (date-specific periods override weekly hours).
- Validate working hours/overrides: start < end and no overlapping periods.
- **Date storage:** persist all dates in ISO `YYYY-MM-DD` format for API + DB.
- **Date display:** format dates for UI using `settings.dateFormat` (use `lib/date.ts` helpers).
- Use settings for formatting (no hard-coded currency/locale).
- Settings API is dynamic (no caching).
- When formatting values (currency/locale), ensure memoized columns include formatter dependencies.
- Large dialogs should have `max-h-[80vh] overflow-y-auto`.
- For long forms, keep the footer outside the scroll area (scroll only the form body).
- Apply the fixed-footer dialog pattern across all form dialogs.
- Package item pickers should include a local search input.
- Shift templates are managed outside Settings (see Shifts module).

## Module checklist
- Prisma model + migration (if new data).
- Zod schema + inferred type in `lib/validation.ts`.
- API routes under `app/api/<module>`.
- UI page under `app/(protected)/<module>` with DataTable + dialogs.
- Permissions enforced in API + layout guards.
- Update navigation in `components/app-sidebar.tsx` (use submenus for grouped routes like Users + Invitees).
- Keep Users page actions minimal (no Invitees button inside the Users view).
- Add icons to main nav items (lucide) for quick scan.
- Sidebar sub-menu buttons should be full width for consistent hover styling.
- Sidebar sub-menu container uses left padding only (no right padding).
- Use extra vertical spacing between menu items for breathing room.
- Menu buttons use extra horizontal/vertical padding for touch targets.
- Invitees list supports status filter (pending/accepted/expired) via `status` query param, defaulting to pending.
- Service categories module lives under `/services/categories` with admin/manager access.
- Services module lives under `/services` with admin/manager access and uses standard list params/response.
- Packages are services with `type=PACKAGE` and must include package items (services).
- Staff eligibility: default allow all services; if any eligible services are stored, treat as an allow-list.
- Manage staff eligibility in the staff profile page (not in the general user create/edit form).
- Staff profile includes documents list (type/number/link/validity), and certifications list (with issue + expiry dates).
- Staff scheduling uses shift schedules (start date + shift blocks) assigned to staff.
- Shift schedules use week off day 1 and optional week off day 2 with week-of-month selection.
- Repeat day counts skip week off dates; staff has one schedule at a time.
- A single global default shift schedule can be marked and applies to staff without explicit schedules.
- Staff shift schedules override global hours; when unassigned, staff inherits global hours.
- Shifts module lives under `/shifts` with admin/manager access and uses standard list params/response.
- Shift schedules live under `/shifts/schedules` with admin/manager access.
- Shift templates store a single shift start/end with optional breaks and are reusable across staff assignments.
- Shift template deletion is blocked when assigned to staff (409 response).
- Roster UI lives under `/shifts/roster` and uses Syncfusion Scheduler (month view).
- Scheduler hides non-business hours with `showNonBusiness: false` and business hour bounds.
- List pageSize max is 100 unless explicitly raised (align UI requests accordingly).
- Seed helpers live in `scripts/` (use `seed-service-categories.js` for defaults).
- Services seed: `scripts/seed-services.js` (requires categories).
