-- Drop FK constraints that reference vehicles
ALTER TABLE "jobs" DROP CONSTRAINT IF EXISTS "jobs_vehicleId_fkey";
ALTER TABLE "custom_field_values" DROP CONSTRAINT IF EXISTS "custom_field_values_vehicleId_fkey";

-- Remove vehicle_id column from jobs
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "vehicle_id";

-- Add inline vehicle fields to jobs
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "vehicle_make" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "vehicle_model" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "vehicle_year" INTEGER;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "vehicle_plate" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "vehicle_vin" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "vehicle_color" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "vehicle_mileage" INTEGER;

-- Remove vehicle_id from custom_field_values
ALTER TABLE "custom_field_values" DROP COLUMN IF EXISTS "vehicle_id";

-- Remove VEHICLE from CustomFieldEntity enum
ALTER TABLE "custom_fields" ALTER COLUMN "entity" TYPE TEXT;
DROP TYPE IF EXISTS "CustomFieldEntity";
CREATE TYPE "CustomFieldEntity" AS ENUM ('JOB', 'CUSTOMER');
ALTER TABLE "custom_fields" ALTER COLUMN "entity" TYPE "CustomFieldEntity" USING "entity"::"CustomFieldEntity";

-- Drop vehicles table (now safe, constraints removed)
DROP TABLE IF EXISTS "vehicles";
