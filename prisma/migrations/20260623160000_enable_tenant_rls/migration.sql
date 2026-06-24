CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')
$$;

CREATE OR REPLACE FUNCTION app.rls_bypass()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(NULLIF(lower(current_setting('app.rls_bypass', true)), ''), 'off') IN ('on', 'true', '1')
$$;

CREATE OR REPLACE FUNCTION app.tenant_match(row_tenant_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app.rls_bypass()
    OR (
      row_tenant_id IS NOT NULL
      AND row_tenant_id = app.current_tenant_id()
    )
$$;

CREATE OR REPLACE FUNCTION app.user_in_tenant(target_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app.rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "User" u
      WHERE u."id" = target_user_id
        AND app.tenant_match(u."tenantId")
    )
$$;

CREATE OR REPLACE FUNCTION app.service_in_tenant(target_service_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app.rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "Service" s
      WHERE s."id" = target_service_id
        AND app.tenant_match(s."tenantId")
    )
$$;

CREATE OR REPLACE FUNCTION app.appointment_order_in_tenant(target_order_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app.rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "AppointmentOrder" ao
      WHERE ao."id" = target_order_id
        AND app.tenant_match(ao."tenantId")
    )
$$;

CREATE OR REPLACE FUNCTION app.app_setting_in_tenant(target_setting_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app.rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "AppSetting" aps
      WHERE aps."id" = target_setting_id
        AND app.tenant_match(aps."tenantId")
    )
$$;

CREATE OR REPLACE FUNCTION app.staff_profile_in_tenant(target_staff_profile_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app.rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "StaffProfile" sp
      JOIN "User" u
        ON u."id" = sp."userId"
      WHERE sp."id" = target_staff_profile_id
        AND app.tenant_match(u."tenantId")
    )
$$;

CREATE OR REPLACE FUNCTION app.shift_template_in_tenant(target_template_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app.rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "ShiftTemplate" st
      WHERE st."id" = target_template_id
        AND app.tenant_match(st."tenantId")
    )
$$;

CREATE OR REPLACE FUNCTION app.shift_schedule_in_tenant(target_schedule_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app.rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "ShiftSchedule" ss
      WHERE ss."id" = target_schedule_id
        AND app.tenant_match(ss."tenantId")
    )
$$;

CREATE OR REPLACE FUNCTION app.leave_definition_in_tenant(target_leave_definition_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app.rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "LeaveDefinition" ld
      WHERE ld."id" = target_leave_definition_id
        AND app.tenant_match(ld."tenantId")
    )
$$;

CREATE OR REPLACE FUNCTION app.leave_group_in_tenant(target_leave_group_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app.rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "LeaveGroup" lg
      WHERE lg."id" = target_leave_group_id
        AND app.tenant_match(lg."tenantId")
    )
$$;

CREATE OR REPLACE FUNCTION app.inventory_product_in_tenant(target_product_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app.rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "InventoryProduct" ip
      WHERE ip."id" = target_product_id
        AND app.tenant_match(ip."tenantId")
    )
$$;

CREATE OR REPLACE FUNCTION app.purchase_order_in_tenant(target_order_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app.rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "PurchaseOrder" po
      WHERE po."id" = target_order_id
        AND app.tenant_match(po."tenantId")
    )
$$;

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "User";
CREATE POLICY "tenant_isolation" ON "User"
  FOR ALL
  USING (app.tenant_match("tenantId"))
  WITH CHECK (
    app.tenant_match("tenantId")
    AND ("tenantId" IS NOT NULL)
  );

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "AuditLog";
CREATE POLICY "tenant_isolation" ON "AuditLog"
  FOR ALL
  USING (app.tenant_match("tenantId"))
  WITH CHECK (app.tenant_match("tenantId"));

ALTER TABLE "ServiceCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceCategory" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ServiceCategory";
CREATE POLICY "tenant_isolation" ON "ServiceCategory"
  FOR ALL
  USING (app.tenant_match("tenantId"))
  WITH CHECK (app.tenant_match("tenantId"));

ALTER TABLE "LeaveDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveDefinition" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "LeaveDefinition";
CREATE POLICY "tenant_isolation" ON "LeaveDefinition"
  FOR ALL
  USING (app.tenant_match("tenantId"))
  WITH CHECK (app.tenant_match("tenantId"));

ALTER TABLE "LeaveGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveGroup" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "LeaveGroup";
CREATE POLICY "tenant_isolation" ON "LeaveGroup"
  FOR ALL
  USING (app.tenant_match("tenantId"))
  WITH CHECK (app.tenant_match("tenantId"));

ALTER TABLE "LeaveRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveRequest" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "LeaveRequest";
CREATE POLICY "tenant_isolation" ON "LeaveRequest"
  FOR ALL
  USING (app.tenant_match("tenantId"))
  WITH CHECK (
    app.tenant_match("tenantId")
    AND app.staff_profile_in_tenant("staffProfileId")
    AND app.leave_definition_in_tenant("leaveDefinitionId")
  );

ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Service" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Service";
CREATE POLICY "tenant_isolation" ON "Service"
  FOR ALL
  USING (app.tenant_match("tenantId"))
  WITH CHECK (app.tenant_match("tenantId"));

ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Appointment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Appointment";
CREATE POLICY "tenant_isolation" ON "Appointment"
  FOR ALL
  USING (app.tenant_match("tenantId"))
  WITH CHECK (
    app.tenant_match("tenantId")
    AND app.staff_profile_in_tenant("staffProfileId")
    AND app.service_in_tenant("serviceId")
    AND app.user_in_tenant("customerId")
  );

ALTER TABLE "AppointmentOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppointmentOrder" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "AppointmentOrder";
CREATE POLICY "tenant_isolation" ON "AppointmentOrder"
  FOR ALL
  USING (app.tenant_match("tenantId"))
  WITH CHECK (
    app.tenant_match("tenantId")
    AND app.user_in_tenant("customerId")
  );

ALTER TABLE "AppSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppSetting" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "AppSetting";
CREATE POLICY "tenant_isolation" ON "AppSetting"
  FOR ALL
  USING (app.tenant_match("tenantId"))
  WITH CHECK (
    app.tenant_match("tenantId")
    AND ("tenantId" IS NOT NULL)
  );

ALTER TABLE "Coupon" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Coupon" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Coupon";
CREATE POLICY "tenant_isolation" ON "Coupon"
  FOR ALL
  USING (app.tenant_match("tenantId"))
  WITH CHECK (app.tenant_match("tenantId"));

ALTER TABLE "Tax" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tax" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Tax";
CREATE POLICY "tenant_isolation" ON "Tax"
  FOR ALL
  USING (app.tenant_match("tenantId"))
  WITH CHECK (app.tenant_match("tenantId"));

ALTER TABLE "InventoryCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryCategory" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "InventoryCategory";
CREATE POLICY "tenant_isolation" ON "InventoryCategory"
  FOR ALL
  USING (app.tenant_match("tenantId"))
  WITH CHECK (app.tenant_match("tenantId"));

ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Supplier" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Supplier";
CREATE POLICY "tenant_isolation" ON "Supplier"
  FOR ALL
  USING (app.tenant_match("tenantId"))
  WITH CHECK (app.tenant_match("tenantId"));

ALTER TABLE "InventoryProduct" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryProduct" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "InventoryProduct";
CREATE POLICY "tenant_isolation" ON "InventoryProduct"
  FOR ALL
  USING (app.tenant_match("tenantId"))
  WITH CHECK (
    app.tenant_match("tenantId")
    AND EXISTS (
      SELECT 1
      FROM "InventoryCategory" ic
      WHERE ic."id" = "categoryId"
        AND app.tenant_match(ic."tenantId")
    )
  );

ALTER TABLE "PurchaseOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrder" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "PurchaseOrder";
CREATE POLICY "tenant_isolation" ON "PurchaseOrder"
  FOR ALL
  USING (app.tenant_match("tenantId"))
  WITH CHECK (
    app.tenant_match("tenantId")
    AND EXISTS (
      SELECT 1
      FROM "Supplier" s
      WHERE s."id" = "supplierId"
        AND app.tenant_match(s."tenantId")
    )
  );

ALTER TABLE "InventoryStockMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryStockMovement" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "InventoryStockMovement";
CREATE POLICY "tenant_isolation" ON "InventoryStockMovement"
  FOR ALL
  USING (app.tenant_match("tenantId"))
  WITH CHECK (
    app.tenant_match("tenantId")
    AND app.inventory_product_in_tenant("productId")
    AND (
      "orderItemId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "PurchaseOrderItem" poi
        WHERE poi."id" = "orderItemId"
          AND app.purchase_order_in_tenant(poi."orderId")
      )
    )
  );

ALTER TABLE "ShiftTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShiftTemplate" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ShiftTemplate";
CREATE POLICY "tenant_isolation" ON "ShiftTemplate"
  FOR ALL
  USING (app.tenant_match("tenantId"))
  WITH CHECK (app.tenant_match("tenantId"));

ALTER TABLE "ShiftSchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShiftSchedule" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ShiftSchedule";
CREATE POLICY "tenant_isolation" ON "ShiftSchedule"
  FOR ALL
  USING (app.tenant_match("tenantId"))
  WITH CHECK (app.tenant_match("tenantId"));

ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invitation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Invitation";
CREATE POLICY "tenant_isolation" ON "Invitation"
  FOR ALL
  USING (app.tenant_match("tenantId"))
  WITH CHECK (
    app.tenant_match("tenantId")
    AND (
      "invitedById" IS NULL
      OR app.user_in_tenant("invitedById")
    )
  );

ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Account";
CREATE POLICY "tenant_isolation" ON "Account"
  FOR ALL
  USING (app.user_in_tenant("userId"))
  WITH CHECK (app.user_in_tenant("userId"));

ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Session";
CREATE POLICY "tenant_isolation" ON "Session"
  FOR ALL
  USING (app.user_in_tenant("userId"))
  WITH CHECK (app.user_in_tenant("userId"));

ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordResetToken" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "PasswordResetToken";
CREATE POLICY "tenant_isolation" ON "PasswordResetToken"
  FOR ALL
  USING (app.user_in_tenant("userId"))
  WITH CHECK (app.user_in_tenant("userId"));

ALTER TABLE "ServiceTax" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceTax" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ServiceTax";
CREATE POLICY "tenant_isolation" ON "ServiceTax"
  FOR ALL
  USING (
    app.service_in_tenant("serviceId")
    AND EXISTS (
      SELECT 1
      FROM "Tax" t
      WHERE t."id" = "taxId"
        AND app.tenant_match(t."tenantId")
    )
  )
  WITH CHECK (
    app.service_in_tenant("serviceId")
    AND EXISTS (
      SELECT 1
      FROM "Tax" t
      WHERE t."id" = "taxId"
        AND app.tenant_match(t."tenantId")
    )
  );

ALTER TABLE "AppointmentOrderLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppointmentOrderLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "AppointmentOrderLine";
CREATE POLICY "tenant_isolation" ON "AppointmentOrderLine"
  FOR ALL
  USING (
    app.appointment_order_in_tenant("orderId")
    AND app.service_in_tenant("serviceId")
    AND app.staff_profile_in_tenant("staffProfileId")
  )
  WITH CHECK (
    app.appointment_order_in_tenant("orderId")
    AND app.service_in_tenant("serviceId")
    AND app.staff_profile_in_tenant("staffProfileId")
  );

ALTER TABLE "AppointmentOrderProductLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppointmentOrderProductLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "AppointmentOrderProductLine";
CREATE POLICY "tenant_isolation" ON "AppointmentOrderProductLine"
  FOR ALL
  USING (
    app.appointment_order_in_tenant("orderId")
    AND app.inventory_product_in_tenant("productId")
  )
  WITH CHECK (
    app.appointment_order_in_tenant("orderId")
    AND app.inventory_product_in_tenant("productId")
  );

ALTER TABLE "AppointmentOrderCoupon" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppointmentOrderCoupon" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "AppointmentOrderCoupon";
CREATE POLICY "tenant_isolation" ON "AppointmentOrderCoupon"
  FOR ALL
  USING (app.appointment_order_in_tenant("orderId"))
  WITH CHECK (app.appointment_order_in_tenant("orderId"));

ALTER TABLE "AppointmentOrderTax" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppointmentOrderTax" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "AppointmentOrderTax";
CREATE POLICY "tenant_isolation" ON "AppointmentOrderTax"
  FOR ALL
  USING (
    app.appointment_order_in_tenant("orderId")
    AND (
      "taxId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "Tax" t
        WHERE t."id" = "taxId"
          AND app.tenant_match(t."tenantId")
      )
    )
  )
  WITH CHECK (
    app.appointment_order_in_tenant("orderId")
    AND (
      "taxId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "Tax" t
        WHERE t."id" = "taxId"
          AND app.tenant_match(t."tenantId")
      )
    )
  );

ALTER TABLE "ServicePackageItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServicePackageItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ServicePackageItem";
CREATE POLICY "tenant_isolation" ON "ServicePackageItem"
  FOR ALL
  USING (
    app.service_in_tenant("packageId")
    AND app.service_in_tenant("itemServiceId")
  )
  WITH CHECK (
    app.service_in_tenant("packageId")
    AND app.service_in_tenant("itemServiceId")
  );

ALTER TABLE "AppSettingDay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppSettingDay" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "AppSettingDay";
CREATE POLICY "tenant_isolation" ON "AppSettingDay"
  FOR ALL
  USING (app.app_setting_in_tenant("settingId"))
  WITH CHECK (app.app_setting_in_tenant("settingId"));

ALTER TABLE "AppSettingPeriod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppSettingPeriod" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "AppSettingPeriod";
CREATE POLICY "tenant_isolation" ON "AppSettingPeriod"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "AppSettingDay" asd
      WHERE asd."id" = "dayId"
        AND app.app_setting_in_tenant(asd."settingId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "AppSettingDay" asd
      WHERE asd."id" = "dayId"
        AND app.app_setting_in_tenant(asd."settingId")
    )
  );

ALTER TABLE "AppSettingOverride" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppSettingOverride" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "AppSettingOverride";
CREATE POLICY "tenant_isolation" ON "AppSettingOverride"
  FOR ALL
  USING (app.app_setting_in_tenant("settingId"))
  WITH CHECK (app.app_setting_in_tenant("settingId"));

ALTER TABLE "AppSettingOverridePeriod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppSettingOverridePeriod" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "AppSettingOverridePeriod";
CREATE POLICY "tenant_isolation" ON "AppSettingOverridePeriod"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "AppSettingOverride" aso
      WHERE aso."id" = "overrideId"
        AND app.app_setting_in_tenant(aso."settingId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "AppSettingOverride" aso
      WHERE aso."id" = "overrideId"
        AND app.app_setting_in_tenant(aso."settingId")
    )
  );

ALTER TABLE "StaffServiceEligibility" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffServiceEligibility" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StaffServiceEligibility";
CREATE POLICY "tenant_isolation" ON "StaffServiceEligibility"
  FOR ALL
  USING (
    app.user_in_tenant("userId")
    AND app.service_in_tenant("serviceId")
  )
  WITH CHECK (
    app.user_in_tenant("userId")
    AND app.service_in_tenant("serviceId")
  );

ALTER TABLE "StaffProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffProfile" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StaffProfile";
CREATE POLICY "tenant_isolation" ON "StaffProfile"
  FOR ALL
  USING (app.user_in_tenant("userId"))
  WITH CHECK (
    app.user_in_tenant("userId")
    AND (
      "managerUserId" IS NULL
      OR app.user_in_tenant("managerUserId")
    )
  );

ALTER TABLE "StaffRosterHistoryDay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffRosterHistoryDay" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StaffRosterHistoryDay";
CREATE POLICY "tenant_isolation" ON "StaffRosterHistoryDay"
  FOR ALL
  USING (app.staff_profile_in_tenant("staffProfileId"))
  WITH CHECK (
    app.staff_profile_in_tenant("staffProfileId")
    AND (
      "templateId" IS NULL
      OR app.shift_template_in_tenant("templateId")
    )
    AND (
      "leaveRequestId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "LeaveRequest" lr
        WHERE lr."id" = "leaveRequestId"
          AND app.tenant_match(lr."tenantId")
      )
    )
  );

ALTER TABLE "StaffCertification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffCertification" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StaffCertification";
CREATE POLICY "tenant_isolation" ON "StaffCertification"
  FOR ALL
  USING (app.staff_profile_in_tenant("staffProfileId"))
  WITH CHECK (app.staff_profile_in_tenant("staffProfileId"));

ALTER TABLE "StaffDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffDocument" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StaffDocument";
CREATE POLICY "tenant_isolation" ON "StaffDocument"
  FOR ALL
  USING (app.staff_profile_in_tenant("staffProfileId"))
  WITH CHECK (app.staff_profile_in_tenant("staffProfileId"));

ALTER TABLE "ShiftTemplateBreak" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShiftTemplateBreak" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ShiftTemplateBreak";
CREATE POLICY "tenant_isolation" ON "ShiftTemplateBreak"
  FOR ALL
  USING (app.shift_template_in_tenant("templateId"))
  WITH CHECK (app.shift_template_in_tenant("templateId"));

ALTER TABLE "ShiftScheduleBlock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShiftScheduleBlock" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "ShiftScheduleBlock";
CREATE POLICY "tenant_isolation" ON "ShiftScheduleBlock"
  FOR ALL
  USING (
    app.shift_schedule_in_tenant("scheduleId")
    AND app.shift_template_in_tenant("templateId")
  )
  WITH CHECK (
    app.shift_schedule_in_tenant("scheduleId")
    AND app.shift_template_in_tenant("templateId")
  );

ALTER TABLE "StaffScheduleAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffScheduleAssignment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StaffScheduleAssignment";
CREATE POLICY "tenant_isolation" ON "StaffScheduleAssignment"
  FOR ALL
  USING (
    app.staff_profile_in_tenant("staffProfileId")
    AND app.shift_schedule_in_tenant("scheduleId")
  )
  WITH CHECK (
    app.staff_profile_in_tenant("staffProfileId")
    AND app.shift_schedule_in_tenant("scheduleId")
  );

ALTER TABLE "StaffShiftOverride" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffShiftOverride" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StaffShiftOverride";
CREATE POLICY "tenant_isolation" ON "StaffShiftOverride"
  FOR ALL
  USING (
    app.staff_profile_in_tenant("staffProfileId")
    AND (
      "templateId" IS NULL
      OR app.shift_template_in_tenant("templateId")
    )
  )
  WITH CHECK (
    app.staff_profile_in_tenant("staffProfileId")
    AND (
      "templateId" IS NULL
      OR app.shift_template_in_tenant("templateId")
    )
  );

ALTER TABLE "StaffFlexibleAvailability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffFlexibleAvailability" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StaffFlexibleAvailability";
CREATE POLICY "tenant_isolation" ON "StaffFlexibleAvailability"
  FOR ALL
  USING (app.staff_profile_in_tenant("staffProfileId"))
  WITH CHECK (app.staff_profile_in_tenant("staffProfileId"));

ALTER TABLE "StaffFlexibleWeekPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffFlexibleWeekPlan" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StaffFlexibleWeekPlan";
CREATE POLICY "tenant_isolation" ON "StaffFlexibleWeekPlan"
  FOR ALL
  USING (app.staff_profile_in_tenant("staffProfileId"))
  WITH CHECK (app.staff_profile_in_tenant("staffProfileId"));

ALTER TABLE "StaffFlexibleWeekDay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffFlexibleWeekDay" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StaffFlexibleWeekDay";
CREATE POLICY "tenant_isolation" ON "StaffFlexibleWeekDay"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "StaffFlexibleWeekPlan" sfwp
      WHERE sfwp."id" = "planId"
        AND app.staff_profile_in_tenant(sfwp."staffProfileId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "StaffFlexibleWeekPlan" sfwp
      WHERE sfwp."id" = "planId"
        AND app.staff_profile_in_tenant(sfwp."staffProfileId")
    )
  );

ALTER TABLE "StaffFlexibleWeekSlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffFlexibleWeekSlot" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StaffFlexibleWeekSlot";
CREATE POLICY "tenant_isolation" ON "StaffFlexibleWeekSlot"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "StaffFlexibleWeekDay" sfwd
      JOIN "StaffFlexibleWeekPlan" sfwp
        ON sfwp."id" = sfwd."planId"
      WHERE sfwd."id" = "dayId"
        AND app.staff_profile_in_tenant(sfwp."staffProfileId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "StaffFlexibleWeekDay" sfwd
      JOIN "StaffFlexibleWeekPlan" sfwp
        ON sfwp."id" = sfwd."planId"
      WHERE sfwd."id" = "dayId"
        AND app.staff_profile_in_tenant(sfwp."staffProfileId")
    )
  );

ALTER TABLE "StaffFlexibleWeekBreak" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffFlexibleWeekBreak" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StaffFlexibleWeekBreak";
CREATE POLICY "tenant_isolation" ON "StaffFlexibleWeekBreak"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "StaffFlexibleWeekSlot" sfws
      JOIN "StaffFlexibleWeekDay" sfwd
        ON sfwd."id" = sfws."dayId"
      JOIN "StaffFlexibleWeekPlan" sfwp
        ON sfwp."id" = sfwd."planId"
      WHERE sfws."id" = "slotId"
        AND app.staff_profile_in_tenant(sfwp."staffProfileId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "StaffFlexibleWeekSlot" sfws
      JOIN "StaffFlexibleWeekDay" sfwd
        ON sfwd."id" = sfws."dayId"
      JOIN "StaffFlexibleWeekPlan" sfwp
        ON sfwp."id" = sfwd."planId"
      WHERE sfws."id" = "slotId"
        AND app.staff_profile_in_tenant(sfwp."staffProfileId")
    )
  );

ALTER TABLE "StaffFlexiblePattern" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffFlexiblePattern" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StaffFlexiblePattern";
CREATE POLICY "tenant_isolation" ON "StaffFlexiblePattern"
  FOR ALL
  USING (app.staff_profile_in_tenant("staffProfileId"))
  WITH CHECK (app.staff_profile_in_tenant("staffProfileId"));

ALTER TABLE "StaffFlexiblePatternWeek" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffFlexiblePatternWeek" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StaffFlexiblePatternWeek";
CREATE POLICY "tenant_isolation" ON "StaffFlexiblePatternWeek"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "StaffFlexiblePattern" sfp
      WHERE sfp."id" = "patternId"
        AND app.staff_profile_in_tenant(sfp."staffProfileId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "StaffFlexiblePattern" sfp
      WHERE sfp."id" = "patternId"
        AND app.staff_profile_in_tenant(sfp."staffProfileId")
    )
  );

ALTER TABLE "StaffFlexiblePatternDay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffFlexiblePatternDay" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StaffFlexiblePatternDay";
CREATE POLICY "tenant_isolation" ON "StaffFlexiblePatternDay"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "StaffFlexiblePatternWeek" sfpw
      JOIN "StaffFlexiblePattern" sfp
        ON sfp."id" = sfpw."patternId"
      WHERE sfpw."id" = "weekId"
        AND app.staff_profile_in_tenant(sfp."staffProfileId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "StaffFlexiblePatternWeek" sfpw
      JOIN "StaffFlexiblePattern" sfp
        ON sfp."id" = sfpw."patternId"
      WHERE sfpw."id" = "weekId"
        AND app.staff_profile_in_tenant(sfp."staffProfileId")
    )
  );

ALTER TABLE "StaffFlexiblePatternSlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffFlexiblePatternSlot" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StaffFlexiblePatternSlot";
CREATE POLICY "tenant_isolation" ON "StaffFlexiblePatternSlot"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "StaffFlexiblePatternDay" sfpd
      JOIN "StaffFlexiblePatternWeek" sfpw
        ON sfpw."id" = sfpd."weekId"
      JOIN "StaffFlexiblePattern" sfp
        ON sfp."id" = sfpw."patternId"
      WHERE sfpd."id" = "dayId"
        AND app.staff_profile_in_tenant(sfp."staffProfileId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "StaffFlexiblePatternDay" sfpd
      JOIN "StaffFlexiblePatternWeek" sfpw
        ON sfpw."id" = sfpd."weekId"
      JOIN "StaffFlexiblePattern" sfp
        ON sfp."id" = sfpw."patternId"
      WHERE sfpd."id" = "dayId"
        AND app.staff_profile_in_tenant(sfp."staffProfileId")
    )
  );

ALTER TABLE "StaffFlexiblePatternBreak" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffFlexiblePatternBreak" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "StaffFlexiblePatternBreak";
CREATE POLICY "tenant_isolation" ON "StaffFlexiblePatternBreak"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "StaffFlexiblePatternSlot" sfps
      JOIN "StaffFlexiblePatternDay" sfpd
        ON sfpd."id" = sfps."dayId"
      JOIN "StaffFlexiblePatternWeek" sfpw
        ON sfpw."id" = sfpd."weekId"
      JOIN "StaffFlexiblePattern" sfp
        ON sfp."id" = sfpw."patternId"
      WHERE sfps."id" = "slotId"
        AND app.staff_profile_in_tenant(sfp."staffProfileId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "StaffFlexiblePatternSlot" sfps
      JOIN "StaffFlexiblePatternDay" sfpd
        ON sfpd."id" = sfps."dayId"
      JOIN "StaffFlexiblePatternWeek" sfpw
        ON sfpw."id" = sfpd."weekId"
      JOIN "StaffFlexiblePattern" sfp
        ON sfp."id" = sfpw."patternId"
      WHERE sfps."id" = "slotId"
        AND app.staff_profile_in_tenant(sfp."staffProfileId")
    )
  );

ALTER TABLE "LeaveGroupLeave" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveGroupLeave" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "LeaveGroupLeave";
CREATE POLICY "tenant_isolation" ON "LeaveGroupLeave"
  FOR ALL
  USING (
    app.leave_group_in_tenant("leaveGroupId")
    AND app.leave_definition_in_tenant("leaveDefinitionId")
  )
  WITH CHECK (
    app.leave_group_in_tenant("leaveGroupId")
    AND app.leave_definition_in_tenant("leaveDefinitionId")
  );

ALTER TABLE "LeaveGroupStaffAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveGroupStaffAssignment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "LeaveGroupStaffAssignment";
CREATE POLICY "tenant_isolation" ON "LeaveGroupStaffAssignment"
  FOR ALL
  USING (
    app.leave_group_in_tenant("leaveGroupId")
    AND app.staff_profile_in_tenant("staffProfileId")
  )
  WITH CHECK (
    app.leave_group_in_tenant("leaveGroupId")
    AND app.staff_profile_in_tenant("staffProfileId")
  );

ALTER TABLE "LeaveDefinitionNonClubbable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveDefinitionNonClubbable" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "LeaveDefinitionNonClubbable";
CREATE POLICY "tenant_isolation" ON "LeaveDefinitionNonClubbable"
  FOR ALL
  USING (
    app.leave_definition_in_tenant("leaveDefinitionId")
    AND app.leave_definition_in_tenant("blockedLeaveId")
  )
  WITH CHECK (
    app.leave_definition_in_tenant("leaveDefinitionId")
    AND app.leave_definition_in_tenant("blockedLeaveId")
  );

ALTER TABLE "InventoryProductSupplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryProductSupplier" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "InventoryProductSupplier";
CREATE POLICY "tenant_isolation" ON "InventoryProductSupplier"
  FOR ALL
  USING (
    app.inventory_product_in_tenant("productId")
    AND EXISTS (
      SELECT 1
      FROM "Supplier" s
      WHERE s."id" = "supplierId"
        AND app.tenant_match(s."tenantId")
    )
  )
  WITH CHECK (
    app.inventory_product_in_tenant("productId")
    AND EXISTS (
      SELECT 1
      FROM "Supplier" s
      WHERE s."id" = "supplierId"
        AND app.tenant_match(s."tenantId")
    )
  );

ALTER TABLE "InventoryProductTax" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryProductTax" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "InventoryProductTax";
CREATE POLICY "tenant_isolation" ON "InventoryProductTax"
  FOR ALL
  USING (
    app.inventory_product_in_tenant("productId")
    AND EXISTS (
      SELECT 1
      FROM "Tax" t
      WHERE t."id" = "taxId"
        AND app.tenant_match(t."tenantId")
    )
  )
  WITH CHECK (
    app.inventory_product_in_tenant("productId")
    AND EXISTS (
      SELECT 1
      FROM "Tax" t
      WHERE t."id" = "taxId"
        AND app.tenant_match(t."tenantId")
    )
  );

ALTER TABLE "PurchaseOrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrderItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "PurchaseOrderItem";
CREATE POLICY "tenant_isolation" ON "PurchaseOrderItem"
  FOR ALL
  USING (
    app.purchase_order_in_tenant("orderId")
    AND app.inventory_product_in_tenant("productId")
  )
  WITH CHECK (
    app.purchase_order_in_tenant("orderId")
    AND app.inventory_product_in_tenant("productId")
  );
