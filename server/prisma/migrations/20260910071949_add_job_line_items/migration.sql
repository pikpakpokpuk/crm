-- CreateTable
CREATE TABLE "job_line_items" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'service',
    "qty" DECIMAL(10,3) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'hr',
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "vatPct" DECIMAL(5,2) NOT NULL DEFAULT 27,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_line_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "job_line_items" ADD CONSTRAINT "job_line_items_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
