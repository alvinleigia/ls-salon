# UAT Guide: Phase 1 Platform Console

Use this guide for end-to-end functional testing of the Phase 1 parent-company and tenant-provisioning flows.

This document covers:
- platform super admin access
- parent-company organization creation
- organization member creation and onboarding
- organization member roles and restrictions
- tenant creation and tenant-to-organization linking
- tenant custom domain management
- tenant lifecycle changes
- tenant admin profile editing and reset
- tenant login and access separation
- platform danger reset protections

## Scope

This guide is for the Phase 1 platform console only.

Primary screens:
- `http://localhost:3000/settings/organizations`
- `http://localhost:3000/settings/tenants`

Platform sign-in URL:
- `http://localhost:3000/auth/signin`

Tenant sign-in URL pattern after creation:
- `http://<tenant-slug>.localhost:3000/auth/signin`

Optional custom-domain verification:
- use the real tenant custom domain only if DNS is already configured for that hostname

## Preconditions

Before testing, confirm:
- the app is running with `npm run dev`
- the database is connected
- migrations are already applied
- platform admin bootstrap is complete
- if you want to verify email delivery, SMTP is configured
- if SMTP is not configured, manual reset links are acceptable and should be tested

Default platform admin login:
- URL: `http://localhost:3000/auth/signin`
- Email: `platform-admin@ls-salon.test`
- Password: `password123`

## General Notes For The Tester

- Run the test cases in the order given below.
- Do not run the danger reset cases until all other tests are complete.
- Platform super admin and organization members sign in on the platform domain.
- Tenant admins sign in on their own tenant URL.
- Organization members should only see the parent-company console.
- Tenant admins should never see the parent-company console.
- If SMTP is not configured, reset and invite flows may return a manual reset link instead of sending an email.
- Custom-domain save/list tests can be done locally, but live custom-domain sign-in only works if DNS is configured for that hostname.

## Recommended Test Data

Use sample values like these.

Organizations:
- Organization A name: `Cheron Group`
- Organization A slug: `cheron-group`
- Organization B name: `Urban Salon Holdings`
- Organization B slug: `urban-salon-holdings`

Organization members:
- Org A owner name: `Cheron Owner`
- Org A owner email: `cheron.owner@ls-salon.test`
- Org A owner password: `password123`
- Org A admin name: `Cheron Admin`
- Org A admin email: `cheron.admin@ls-salon.test`
- Org A viewer name: `Cheron Viewer`
- Org A viewer email: `cheron.viewer@ls-salon.test`
- Org B owner name: `Urban Owner`
- Org B owner email: `urban.owner@ls-salon.test`
- Org B owner password: `password123`

Tenants:
- Tenant A name: `Cheron Downtown`
- Tenant A slug: `cheron-downtown`
- Tenant A admin name: `Cheron Downtown Admin`
- Tenant A admin email: `cheron.downtown.admin@ls-salon.test`
- Tenant A admin password: `password123`
- Tenant A custom domain: `app.cheron-demo.com`
- Tenant B name: `Cheron Uptown`
- Tenant B slug: `cheron-uptown`
- Tenant B admin name: `Cheron Uptown Admin`
- Tenant B admin email: `cheron.uptown.admin@ls-salon.test`
- Tenant B admin password: `password123`

## Recommended Execution Order

Run the guide in this sequence:
1. Platform super admin access checks
2. Organization creation
3. Organization member creation
4. Organization member onboarding and role testing
5. Tenant creation and tenant assignment
6. Tenant management and reset flows
7. Tenant sign-in and access separation checks
8. Danger reset protection checks
9. Optional custom-domain live verification

## Test Case 1: Platform Super Admin Can Access The Phase 1 Console

Steps:
1. Sign in as platform super admin at `http://localhost:3000/auth/signin`.
2. Open the sidebar.
3. Open `Parent Console`.
4. Open `Organizations`.
5. Open `Tenants`.

Expected result:
- sign-in succeeds
- home redirect lands in the platform console flow
- `Organizations` page loads
- `Tenants` page loads
- `New organization` is visible
- `New tenant` is visible
- `Danger zone` is visible on the tenants page

## Test Case 2: Platform Super Admin Should Land In Parent Console On Login

Steps:
1. Sign out if needed.
2. Sign in again as platform super admin.

Expected result:
- user is redirected into the platform console experience
- user should not land inside a normal tenant business dashboard

## Test Case 3: Normal Tenant Admin Must Not Access Platform Console

Steps:
1. Sign in as any normal tenant admin on a tenant URL.
2. Try to open `/settings/organizations`.
3. Try to open `/settings/tenants`.

Expected result:
- tenant admin should not be allowed to use either page
- tenant admin should be redirected away or blocked

## Test Case 4: Organizations List Loads Correctly

Steps:
1. Open `http://localhost:3000/settings/organizations`.
2. Observe the table.

Expected result:
- page title is `Organizations`
- columns should show:
  - `Name`
  - `Slug`
  - `Tenants`
  - `Members`
  - `Created`
- action menu is available on each row

## Test Case 5: Create Organization A Successfully

Steps:
1. Click `New organization`.
2. Enter the Organization A values.
3. Click `Create organization`.
4. Find the new row in the table.

Expected result:
- success toast appears
- dialog closes
- organization appears once in the list
- `Tenants` count is `0`
- `Members` count is `0`

## Test Case 6: Create Organization B Successfully

Steps:
1. Repeat the same flow using the Organization B values.

Expected result:
- second organization appears once in the list

## Test Case 7: Validate Organization Creation Rules

Steps:
1. Open `New organization`.
2. Try submitting empty fields.
3. Try an invalid slug with spaces.
4. Try an invalid slug with uppercase letters.
5. Try a duplicate slug using Organization A or B slug.

Expected result:
- validation errors appear for bad input
- duplicate slug is rejected
- user sees an error like `Organization slug already exists.`

## Test Case 8: Search Organizations

Steps:
1. Search by part of Organization A name.
2. Clear the search.
3. Search by Organization B slug.

Expected result:
- rows filter correctly by name
- rows filter correctly by slug
- clearing search restores the full list

## Test Case 9: Open Organization Members Dialog

Steps:
1. Open the action menu for Organization A.
2. Click `Manage members`.

Expected result:
- members dialog opens
- dialog title includes the organization name
- `Add member` section is visible
- `Current members` section is visible

## Test Case 10: Add An Organization Owner With Password

Steps:
1. In Organization A, add the owner member using the owner test data.
2. Provide the password.
3. Keep role as `Owner`.
4. Click `Add member`.

Expected result:
- success toast appears
- member appears in the members table
- role is `OWNER`
- user status is `ACTIVE`

## Test Case 11: Add An Organization Admin Without Password

Steps:
1. In Organization A, add the admin member.
2. Leave the password blank.
3. Set role to `ADMIN`.
4. Click `Add member`.

Expected result:
- member is created
- if SMTP is configured:
  - success toast indicates invite/reset email was sent
- if SMTP is not configured:
  - success toast indicates reset link/manual handling
- member appears in the table
- role is `ADMIN`
- user status is `INVITED`

## Test Case 12: Add An Organization Viewer Without Password

Steps:
1. In Organization A, add the viewer member.
2. Leave the password blank.
3. Set role to `VIEWER`.
4. Click `Add member`.

Expected result:
- member is created
- member appears in the table
- role is `VIEWER`
- user status is `INVITED`

## Test Case 13: Validate Member Creation Rules

Steps:
1. Try adding a member with blank required fields.
2. Try invalid email.
3. Try phone shorter than 7 characters.
4. Try password shorter than 8 characters.
5. Try duplicate email using an existing user email.

Expected result:
- validation errors appear
- duplicate email is rejected
- user sees an error like `A user with this email already exists.`

## Test Case 14: Confirm Member Counts On Organization Row

Steps:
1. Close the members dialog.
2. Return to the organizations table.
3. Check Organization A row.

Expected result:
- `Members` count reflects the members created above

## Test Case 15: Complete Invite Flow For Organization Admin

Steps:
1. If you received a reset link by email, open it.
2. If SMTP is not configured, use the manual reset link returned by the app.
3. Set a new password.
4. Return to the platform sign-in page.
5. Sign in using the org admin email and the new password.

Expected result:
- reset flow completes successfully
- invited user can sign in after setting the password
- user status should effectively behave as active after password setup
- user lands in the parent-company console

## Test Case 16: Organization Member Should Land In Parent Console

Steps:
1. Sign in as the Organization A owner on `http://localhost:3000/auth/signin`.
2. Sign out.
3. Sign in as the Organization A admin.

Expected result:
- both users sign in on the platform domain
- both land in the parent-company console
- neither user lands in a tenant business dashboard

## Test Case 17: Organization Owner Sees Only Their Own Organization

Steps:
1. Sign in as Organization A owner.
2. Open `Organizations`.

Expected result:
- only Organization A is visible
- Organization B should not be visible

## Test Case 18: Organization Owner Sees Only Their Own Tenants

Steps:
1. Still signed in as Organization A owner, open `Tenants`.
2. Observe the list before any tenants exist.

Expected result:
- only tenants belonging to Organization A should ever be visible
- no unrelated organization tenants should appear

## Test Case 19: Viewer Access Is Read Only

Steps:
1. Complete invite/reset flow for the Organization A viewer.
2. Sign in as the viewer on the platform domain.
3. Open Organization A members dialog.
4. Open the tenants page.

Expected result:
- viewer can access the parent-company console
- viewer can see data for Organization A only
- viewer should not get member-management action controls
- viewer should not get destructive or edit actions for members

## Test Case 20: Super Admin Can Create A Tenant Under Organization A

Steps:
1. Sign back in as platform super admin.
2. Open `Tenants`.
3. Click `New tenant`.
4. Enter Tenant A values.
5. Choose Organization A in the organization dropdown.
6. Leave custom domain blank for now.
7. Click `Create tenant`.

Expected result:
- success toast appears
- tenant appears in the list
- organization column shows Organization A
- status is `ACTIVE`
- users count is `1`

## Test Case 21: Super Admin Can Create Another Tenant Under Organization A

Steps:
1. Repeat the same flow using Tenant B values.
2. Assign it to Organization A.

Expected result:
- second tenant appears
- both tenants are visible under Organization A

## Test Case 22: Tenant List Loads Correctly

Steps:
1. Observe the tenants table.

Expected result:
- columns should include:
  - `Name`
  - `Slug`
  - `Organization`
  - `Status`
  - `Custom domain`
  - `Access URL`
  - `Users`
  - `Created`
- platform/internal tenant rows should not appear as normal customer tenants

## Test Case 23: Search And Filter Tenants

Steps:
1. Search by tenant name.
2. Search by slug.
3. Search by organization name.
4. Search by custom domain after setting one later.
5. Use the status filter for `Active`, `Suspended`, and `Archived`.

Expected result:
- rows filter correctly by name, slug, organization, and custom domain
- status filter works correctly

## Test Case 24: Validate Tenant Creation Rules

Steps:
1. Try creating a tenant with blank required fields.
2. Try invalid slug values.
3. Try invalid admin email.
4. Try short admin password under 8 characters.
5. Try duplicate tenant slug.
6. Try duplicate admin email.

Expected result:
- validation errors appear
- duplicate slug is rejected with an error like `Tenant slug already exists.`
- duplicate admin email is rejected with an error like `Admin email already exists.`

## Test Case 25: Super Admin Can Save A Custom Domain

Steps:
1. Open the action menu for Tenant A.
2. Click `Edit custom domain`.
3. Enter `app.cheron-demo.com`.
4. Save changes.

Expected result:
- success toast appears
- `Custom domain` column updates
- `Access URL` uses the custom domain

## Test Case 26: Validate Custom Domain Rules

Steps:
1. Try setting the same custom domain on another tenant.
2. Try setting a hostname inside the managed tenant root domain.

Expected result:
- duplicate custom domain is rejected
- managed-root conflicts are rejected
- user sees clear error messages such as:
  - `Custom domain already exists.`
  - `Custom domain must be outside the managed tenant root domain.`

## Test Case 27: Super Admin Can Reassign Tenant Organization

Steps:
1. Open Tenant B action menu.
2. Click `Edit organization`.
3. Change the organization to Organization B.
4. Save changes.

Expected result:
- success toast appears
- tenant row now shows Organization B

## Test Case 28: Organization Owner Sees Only Their Own Tenants After Reassignment

Steps:
1. Sign in as Organization A owner.
2. Open `Tenants`.
3. Sign out and sign in as Organization B owner if already created.
4. Open `Tenants`.

Expected result:
- Organization A owner sees only Organization A tenants
- Organization B owner sees only Organization B tenants

## Test Case 29: Organization Member Can Create A Tenant Only Inside Their Own Organization

Steps:
1. Sign in as Organization A owner or admin.
2. Open `Tenants`.
3. Click `New tenant`.
4. Try creating a tenant under Organization A.

Expected result:
- tenant creation succeeds when assigned to the signed-in member's own organization
- created tenant appears in the org-scoped list

## Test Case 30: Organization Member Cannot Create Cross-Organization Tenant

Steps:
1. Still signed in as Organization A owner or admin.
2. Try to create a tenant without choosing an organization.
3. If another organization appears in UI or can be forced through request manipulation, try using it.

Expected result:
- creation without organization should fail for org members
- cross-organization creation should be blocked
- expected messages can include:
  - `Organization is required for parent-company tenant creation.`
  - `Forbidden.`

## Test Case 31: Organization Member Cannot Reassign Tenant Organization

Steps:
1. Signed in as Organization A owner or admin, open a tenant action menu.

Expected result:
- `Edit organization` should not be available to org members

## Test Case 32: Organization Member Cannot Use Danger Reset

Steps:
1. Signed in as Organization A owner or admin, open `Tenants`.

Expected result:
- `Danger zone` should not be visible
- org members should not have access to platform-wide bulk reset

## Test Case 33: Tenant Lifecycle Actions Work

Steps:
1. As platform super admin or the appropriate org-scoped user, suspend a tenant.
2. Reactivate the same tenant.
3. Archive a tenant.

Expected result:
- each status change succeeds
- table row updates correctly
- only matching actions are shown for the current state

## Test Case 34: Edit Tenant Admin Details

Steps:
1. Open a tenant action menu.
2. Click `Edit admin details`.
3. Change one or more of:
   - name
   - email
   - phone
   - status
   - password
4. Save changes.

Expected result:
- success toast appears
- values are saved
- if password changed, tenant admin can sign in with the new password

## Test Case 35: Validate Tenant Admin Edit Rules

Steps:
1. Open `Edit admin details`.
2. Try invalid email.
3. Try short phone.
4. Try short password.
5. Try duplicate email.

Expected result:
- invalid changes are rejected
- validation errors appear
- duplicate email is rejected with an error like `Email already in use.`

## Test Case 36: Send Tenant Admin Reset

Steps:
1. Open a tenant action menu.
2. Click `Send admin reset`.
3. Use the emailed or manual reset link.
4. Set a new password.
5. Sign in on the tenant URL using the new password.

Expected result:
- reset flow works
- tenant admin can sign in using the new password

## Test Case 37: Tenant Admin Sign-In Uses Tenant Context

Steps:
1. Open `http://<tenant-slug>.localhost:3000/auth/signin`.
2. Sign in as that tenant's admin.

Expected result:
- sign-in succeeds
- tenant admin lands in their own tenant context
- tenant admin should not see the parent-company console

## Test Case 38: Organization Member Can Edit And Reset Tenant Admins Within Scope

Steps:
1. Sign in as Organization A owner.
2. Open a tenant belonging to Organization A.
3. Use `Edit admin details`.
4. Use `Send admin reset`.

Expected result:
- org-scoped user can manage tenant admins for their own organization's tenants
- flow works only for in-scope tenants

## Test Case 39: Super Admin Can Edit Organization Member Details

Steps:
1. Sign in as platform super admin.
2. Open Organization A members.
3. Edit a member:
   - name
   - email
   - phone
   - role
   - status
   - optional new password
4. Save changes.

Expected result:
- update succeeds
- changed values appear in the members list

## Test Case 40: Organization Admin Role Restrictions

Steps:
1. Sign in as an Organization A admin.
2. Open Organization A members.
3. Try to add a new `OWNER`.
4. Try to edit an existing `OWNER`.
5. Try to reset or remove an existing `OWNER`.
6. Try to edit or remove a `VIEWER`.

Expected result:
- admin should not be allowed to create or manage owner-level memberships
- admin should be able to manage non-owner memberships
- hidden buttons and server-side blocking should both align

## Test Case 41: Owner Role Protection

Steps:
1. Sign in as platform super admin or org owner with sufficient rights.
2. Ensure an organization has only one remaining owner.
3. Try to downgrade that owner to `ADMIN` or `VIEWER`.
4. Try to remove that owner.

Expected result:
- action is blocked
- user sees an error like `At least one owner must remain for the organization.`

## Test Case 42: Send Organization Member Reset

Steps:
1. Open Organization A members.
2. Click `Send reset link` for an active non-owner, non-platform-admin member.
3. Use the emailed or manual reset link.
4. Set a new password.
5. Sign in on the platform domain with the new password.

Expected result:
- reset flow works
- org member can sign in with the new password

## Test Case 43: Remove Organization Member

Steps:
1. Remove a non-owner member from Organization A.
2. If that user had only one organization membership, try signing in again after removal.

Expected result:
- member is removed from the organization
- if it was the last membership, the user should effectively lose active platform-console access

## Test Case 44: Duplicate Email Protection During Member Edit

Steps:
1. Edit a member.
2. Change the email to another already-used user email.
3. Save changes.

Expected result:
- update is rejected
- user sees an error like `Email already in use.`

## Test Case 45: Organization Viewer Should Not Mutate Members

Steps:
1. Sign in as an organization viewer.
2. Open the organization members dialog.

Expected result:
- viewer can inspect members
- viewer should not be able to add, edit, reset, or remove members

## Test Case 46: Danger Reset Confirmation Protection

Only run this in a disposable test environment.

Steps:
1. Sign in as platform super admin.
2. Open `Tenants`.
3. Open `Reset all tenant data`.
4. Do not type `RESET`.
5. Click `Reset data`.

Expected result:
- reset should not proceed
- user should see an error prompting for `RESET`

## Test Case 47: Danger Reset Is Platform-Super-Admin Only

Steps:
1. Sign in as organization owner or admin.
2. Open `Tenants`.

Expected result:
- `Danger zone` is not visible

## Test Case 48: Execute Bulk Reset Last

Only run this after all previous test cases are complete.

Steps:
1. Sign in as platform super admin.
2. Confirm multiple test tenants exist.
3. Open `Reset all tenant data`.
4. Leave `Keep platform tenant too` checked.
5. Type `RESET`.
6. Click `Reset data`.

Expected result:
- non-preserved tenants are deleted
- success toast shows deleted tenant and user counts
- platform admin login still works
- platform tenant remains available

## Test Case 49: Optional Live Custom-Domain Verification

Run this only if DNS for the custom hostname is already configured.

Steps:
1. Use a tenant with a saved custom domain.
2. Open `https://<custom-domain>/auth/signin`.
3. Sign in as that tenant's admin.
4. Trigger a tenant admin reset from the platform console.
5. Use the reset link.

Expected result:
- tenant custom domain resolves to the tenant correctly
- sign-in works on the custom domain
- reset flow returns a tenant-aware URL for that hostname

## Suggested Evidence To Capture

Ask the tester to capture:
- screenshot of organizations list after creation
- screenshot of organization members dialog with owner, admin, and viewer
- screenshot of invite/reset success result
- screenshot of org member sign-in landing page
- screenshot of tenant list showing organization and access URL columns
- screenshot of custom domain edit result
- screenshot of tenant admin edit dialog and saved result
- screenshot of last-owner protection error
- screenshot of viewer read-only state
- screenshot of danger reset confirmation protection

## Exit Criteria For Phase 1

Phase 1 can be marked as functionally passed when:
- platform super admin can manage organizations and tenants
- organization creation works
- organization member create, edit, reset, and remove flows work
- invited org members can set a password and sign in
- viewer, admin, owner, and super-admin restrictions behave correctly
- tenant creation under organizations works
- org-scoped tenant visibility works
- tenant custom-domain save rules work
- tenant admin edit and reset flows work
- tenant sign-in stays tenant-scoped
- parent-company users sign in only on the platform domain
- danger reset is protected and limited to the platform super admin
