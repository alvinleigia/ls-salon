# UAT Guide: Admin Dashboard - Tenant Management

Use this guide for functional testing of the platform admin tenant-management area.

This document covers:
- platform admin access
- tenant listing
- tenant creation
- tenant status changes
- tenant admin profile editing
- tenant admin password reset
- full tenant reset danger action

## Scope

This is for the platform admin dashboard only.

Primary screen:
- `http://localhost:3000/settings/tenants`

Tenant login URL pattern after creation:
- `http://<tenant-slug>.localhost:3000`

## Preconditions

Before testing, confirm:
- the app is running with `npm run dev`
- the database is connected
- migrations are already applied
- platform admin bootstrap is complete

Default platform admin login:
- URL: `http://localhost:3000/auth/signin`
- Email: `platform-admin@ls-salon.test`
- Password: `password123`

## General Notes For The Tester

- This area is only for platform admin users.
- The platform tenant itself should not appear as a normal tenant row in the list.
- New tenant creation should create:
  - one tenant record
  - one admin user for that tenant
  - default app settings for that tenant
- If SMTP is not configured, admin reset may return a manual reset link instead of sending an email.
- Use a test-only environment for the danger reset action.

## Recommended Test Data

Use sample values like:

Tenant A:
- Tenant name: `Storefront One`
- Tenant slug: `storefront1`
- Admin name: `Storefront One Admin`
- Admin email: `storefront1.admin@ls-salon.test`
- Temporary password: `password123`

Tenant B:
- Tenant name: `City Salon`
- Tenant slug: `city-salon`
- Admin name: `City Salon Admin`
- Admin email: `city.admin@ls-salon.test`
- Temporary password: `password123`

## Test Case 1: Platform Admin Can Access Tenant Management

Steps:
1. Sign in as platform admin at `http://localhost:3000/auth/signin`.
2. Open `Settings`.
3. Open `Tenants`.

Expected result:
- the page loads successfully
- the page title is `Tenants`
- the `New tenant` button is visible
- the `Danger zone` section is visible

## Test Case 2: Non-Platform Users Should Not Use This Area

Steps:
1. Sign in as a normal tenant admin on a tenant subdomain.
2. Try to open `/settings/tenants`.

Expected result:
- user should not be allowed to manage tenants
- user should be redirected away or blocked from this page

## Test Case 3: Tenant List Loads Correctly

Steps:
1. Open the tenants page.
2. Observe the table rows and columns.

Expected result:
- columns should show:
  - `Name`
  - `Slug`
  - `Status`
  - `Users`
  - `Created`
- platform/internal tenant rows should not be listed as normal customer tenants
- each created tenant should appear once

## Test Case 4: Search Works

Steps:
1. In the search box, type part of a tenant name.
2. Clear it.
3. Type part of a tenant slug.

Expected result:
- rows filter correctly by name
- rows filter correctly by slug
- clearing search restores the full list

## Test Case 5: Status Filter Works

Steps:
1. Change the `Status` dropdown to `Active`.
2. Change it to `Suspended`.
3. Change it to `Archived`.
4. Change it back to `All statuses`.

Expected result:
- only rows matching the selected status are shown
- changing back to `All statuses` shows all matching tenants again

## Test Case 6: Create A New Tenant Successfully

Steps:
1. Click `New tenant`.
2. Enter valid test data.
3. Click `Create tenant`.
4. Wait for the success message.
5. Find the new tenant in the table.

Expected result:
- success toast appears
- dialog closes
- new tenant appears in the list
- `Status` is `ACTIVE`
- `Users` count is `1`
- tenant admin can sign in at `http://<tenant-slug>.localhost:3000/auth/signin`

## Test Case 7: Validate Required Fields During Tenant Creation

Steps:
1. Open `New tenant`.
2. Try submitting with blank fields.
3. Try invalid values:
   - slug with spaces
   - slug with uppercase letters
   - short password under 8 characters
   - invalid email

Expected result:
- validation errors should appear
- tenant should not be created

Validation rules to verify:
- tenant name: minimum 2 characters
- slug: lowercase letters, numbers, hyphen only
- admin name: required
- admin email: valid email
- admin password: minimum 8 characters

## Test Case 8: Prevent Duplicate Tenant Slug

Steps:
1. Try creating a second tenant using an existing slug.

Expected result:
- creation should fail
- user should see an error like `Tenant slug already exists.`

## Test Case 9: Prevent Duplicate Admin Email

Steps:
1. Try creating a second tenant using an existing admin email.

Expected result:
- creation should fail
- user should see an error like `Admin email already exists.`

## Test Case 10: Suspend A Tenant

Steps:
1. Open the action menu for an active tenant.
2. Click `Suspend`.
3. Confirm the status change.

Expected result:
- success toast appears
- tenant row status changes to `SUSPENDED`

## Test Case 11: Reactivate A Tenant

Steps:
1. Open the action menu for a suspended tenant.
2. Click `Reactivate`.
3. Confirm the status change.

Expected result:
- success toast appears
- tenant row status changes to `ACTIVE`

## Test Case 12: Archive A Tenant

Steps:
1. Open the action menu for a tenant.
2. Click `Archive`.
3. Confirm the status change.

Expected result:
- success toast appears
- tenant row status changes to `ARCHIVED`

## Test Case 13: Edit Tenant Admin Details

Steps:
1. Open the tenant action menu.
2. Click `Edit admin details`.
3. Change one or more of:
   - admin name
   - admin email
   - phone
   - status
   - password
4. Click `Save changes`.

Expected result:
- success toast appears
- dialog closes
- data is saved
- if password changed, the tenant admin should be able to sign in with the new password

## Test Case 14: Validate Tenant Admin Edit Rules

Steps:
1. Open `Edit admin details`.
2. Enter invalid values:
   - bad email
   - phone shorter than 7 characters
   - password shorter than 8 characters
3. Save changes.

Expected result:
- field validation errors appear
- invalid changes are rejected

## Test Case 15: Prevent Duplicate Admin Email During Edit

Steps:
1. Edit a tenant admin.
2. Change email to another existing user email.
3. Save changes.

Expected result:
- update should fail
- user should see an error like `Email already in use.`

## Test Case 16: Send Admin Reset

Steps:
1. Open the tenant action menu.
2. Click `Send admin reset`.

Expected result:
- if SMTP is configured:
  - success toast says reset link sent
- if SMTP is not configured:
  - success toast indicates manual reset handling
  - reset link may be copied to clipboard

Extra verification:
1. Open the reset link if available.
2. Set a new password.
3. Sign in on the tenant subdomain with the new password.

Expected result:
- password reset flow works
- tenant admin can log in with the new password

## Test Case 17: Confirm Tenant Login On Subdomain

Steps:
1. After creating a tenant, open `http://<tenant-slug>.localhost:3000/auth/signin`.
2. Sign in using the tenant admin credentials.

Expected result:
- login succeeds
- tenant admin lands inside their own tenant context
- they should not see the platform tenant-management surface

## Test Case 18: Danger Reset - Confirmation Protection

Only run this in a disposable test environment.

Steps:
1. Open `Reset all tenant data`.
2. Do not type `RESET`.
3. Click `Reset data`.

Expected result:
- reset should not proceed
- user should see an error prompting for `RESET`

## Test Case 19: Danger Reset - Execute Bulk Tenant Reset

Only run this after all other tenant tests are complete.

Steps:
1. Create at least one test tenant.
2. Open `Reset all tenant data`.
3. Leave `Keep platform tenant too` checked.
4. Type `RESET`.
5. Click `Reset data`.

Expected result:
- non-preserved tenants are deleted
- success toast shows deleted tenant and user counts
- platform admin login still works
- preserved platform tenant remains available

## Suggested Evidence To Capture

Ask the tester to capture:
- screenshot of tenant list before and after creating a tenant
- screenshot of success toast after creation
- screenshot of suspended and archived status changes
- screenshot of edit admin dialog and saved result
- screenshot of reset flow outcome
- short note for each failed validation case

## Exit Criteria For This Area

Tenant management can be marked as functionally passed when:
- platform admin can access tenant management
- tenant creation works
- duplicate protection works
- status changes work
- tenant admin edit works
- password reset works
- tenant subdomain login works
- danger reset works in test environment only
