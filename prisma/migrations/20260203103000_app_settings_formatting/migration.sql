-- Create enums for formatting preferences
CREATE TYPE "CurrencySymbolPlacement" AS ENUM ('BEFORE', 'AFTER');
CREATE TYPE "NumberFormatStyle" AS ENUM (
  'US_UK',
  'EUROPEAN',
  'ISO_DECIMAL_POINT',
  'ISO_DECIMAL_COMMA',
  'COMPACT_DECIMAL_POINT',
  'COMPACT_DECIMAL_COMMA'
);

-- Add global setting fields
ALTER TABLE "AppSetting"
ADD COLUMN "firstDayOfWeek" "Weekday" NOT NULL DEFAULT 'SUNDAY',
ADD COLUMN "currencySymbolPlacement" "CurrencySymbolPlacement" NOT NULL DEFAULT 'BEFORE',
ADD COLUMN "numberFormat" "NumberFormatStyle" NOT NULL DEFAULT 'US_UK';
