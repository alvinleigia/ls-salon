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

## Permissions
- Use helpers from `lib/permissions.ts` in both server and client.
- Server always checks `auth()` + helper.
- UI should only hide/disable; server is source of truth.

## Delete policy (global)
- Default: **restrict delete** if the record is referenced by other records.
- When allowed, perform **soft delete** by setting status to INACTIVE/ARCHIVED.
- Use 409 responses with a clear message when deletion is blocked.

## Validation + types
- Define Zod schemas in `lib/validation.ts`.
- Export inferred types from the same file (no separate DTOs unless needed).
- API: `schema.safeParse(body)` and return `{ error, details }` with `flatten()` on failure.

## Forms
- Use `FormField` from `components/form-field.tsx` for label/input/error.
- Use `useFormErrors` from `hooks/use-form-errors.ts` to map Zod field errors.

## Tables
- Use `components/data-table.tsx` with server-side pagination.
- Pass `totalRows` to `DataTablePagination`.
- Use `columnDef.meta.label` for column labels.

## Email templates
- Put templates in `lib/emails/*`.
- API routes import templates and pass `subject/text/html` into `mailer.sendMail`.

## Settings
- Global settings live under `/settings` (admin/manager).
- Start with locale, currency, time zone, and date format.
- Use settings for formatting (no hard-coded currency/locale).
- Settings API is dynamic (no caching).
- When formatting values (currency/locale), ensure memoized columns include formatter dependencies.

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
- List pageSize max is 100 unless explicitly raised (align UI requests accordingly).
- Seed helpers live in `scripts/` (use `seed-service-categories.js` for defaults).
- Services seed: `scripts/seed-services.js` (requires categories).
