-- CreateTable
CREATE TABLE "integration_settings" (
    "id" TEXT NOT NULL DEFAULT 'google_sheets',
    "sheetId" TEXT,
    "serviceAccountJson" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("id")
);

