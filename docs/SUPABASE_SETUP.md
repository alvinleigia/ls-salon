# Supabase Setup

This project works well with Supabase because it is a standard PostgreSQL app.

Important for this codebase:
- keep Prisma
- keep our existing Postgres row-level security (RLS)
- do not use Supabase transaction pooler (`6543`) for normal app traffic
- do not give the main app role `BYPASSRLS`

## Why

The app sets tenant DB context through connection/session settings in `lib/prisma.ts`:
- `app.tenant_id`
- `app.rls_bypass`

Those settings are then used by the policies created in `prisma/migrations/20260623160000_enable_tenant_rls/migration.sql`.

Because of that, the app needs a persistent/session-style PostgreSQL connection, not transaction pooling.

## Recommended connection pattern

Use one of these:

1. `DATABASE_URL`
Session pooler on port `5432`

Use this for the running app. This is the safest default for local Windows development when direct IPv6 access is awkward.

2. `DIRECT_URL`
Direct connection on port `5432` if available

Use this optionally for Prisma CLI and migrations. The repo is configured so Prisma CLI will prefer `DIRECT_URL` when present, otherwise it falls back to `DATABASE_URL`.

Do not use:
- Supavisor transaction mode on port `6543` for this app runtime

## Supabase dashboard steps

1. Create a new Supabase project.
2. Open `Connect` in the project dashboard.
3. Copy:
   - the `Session pooler` connection string ending in `:5432`
   - optionally the `Direct connection` string ending in `:5432`
4. Open `SQL Editor`.
5. Run the SQL below to create the app role.

## SQL to create the app role

Replace `YOUR_STRONG_PASSWORD` first.

```sql
create user prisma_app
with password 'YOUR_STRONG_PASSWORD'
createdb;

grant usage on schema public to prisma_app;
grant create on schema public to prisma_app;

grant all on all tables in schema public to prisma_app;
grant all on all routines in schema public to prisma_app;
grant all on all sequences in schema public to prisma_app;

alter default privileges for role postgres in schema public
grant all on tables to prisma_app;

alter default privileges for role postgres in schema public
grant all on routines to prisma_app;

alter default privileges for role postgres in schema public
grant all on sequences to prisma_app;
```

Notes:
- This intentionally does **not** include `bypassrls`.
- `createdb` is useful for `prisma migrate dev` because Prisma may need a shadow database during development.

## Env values for this repo

Set these in `.env`:

```env
# App runtime: use Supabase session pooler on 5432
DATABASE_URL="postgres://prisma_app.[PROJECT-REF]:YOUR_STRONG_PASSWORD@aws-[REGION].pooler.supabase.com:5432/postgres"

# Optional: use direct connection for Prisma CLI/migrations when available
DIRECT_URL="postgresql://prisma_app:YOUR_STRONG_PASSWORD@db.[PROJECT-REF].supabase.co:5432/postgres"

AUTH_SECRET="replace-with-a-long-random-secret"
APP_ROOT_DOMAIN="localhost"
PLATFORM_ADMIN_TENANT_SLUG="platform"
PLATFORM_ADMIN_TENANT_NAME="Platform Tenant"
PLATFORM_ADMIN_NAME="Platform Admin"
PLATFORM_ADMIN_EMAIL="platform-admin@ls-salon.test"
PLATFORM_ADMIN_PASSWORD="password123"
```

If your Supabase project/network does not support the direct connection path, omit `DIRECT_URL`.

## Local commands after env setup

Run:

```bash
npm run db:migrate
npm run bootstrap:admin
npm run dev
```

## Local hostnames

With `APP_ROOT_DOMAIN=localhost`:
- platform tenant: `http://localhost:3000`
- tenant example: `http://storefront1.localhost:3000`

## Troubleshooting

If migrations fail:
- confirm you are not using port `6543` in `DATABASE_URL`
- confirm the password belongs to `prisma_app`, not the default `postgres` user
- if `DIRECT_URL` is present and failing, remove it temporarily and retry with only `DATABASE_URL`
- make sure the custom role SQL was executed before running Prisma
