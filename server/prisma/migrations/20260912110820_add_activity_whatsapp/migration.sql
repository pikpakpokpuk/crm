-- Activity log table
CREATE TABLE "job_activity_logs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_activity_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "job_activity_logs" ADD CONSTRAINT "job_activity_logs_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_activity_logs" ADD CONSTRAINT "job_activity_logs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- WhatsApp messages table
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "customerPhone" TEXT NOT NULL,
    "fromMe" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "waMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_messages_waMessageId_key" ON "whatsapp_messages"("waMessageId");

ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
