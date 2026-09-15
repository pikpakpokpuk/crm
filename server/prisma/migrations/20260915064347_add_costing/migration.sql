-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "costPrice" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "job_line_items" ADD COLUMN     "costPrice" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "hourlyRate" DECIMAL(8,2);

