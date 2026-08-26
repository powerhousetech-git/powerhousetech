-- Multi-industry V3 tables

CREATE TABLE "Industry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Industry_name_key" ON "Industry"("name");
CREATE UNIQUE INDEX "Industry_slug_key" ON "Industry"("slug");

CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "industryId" TEXT NOT NULL,
    "followUpNum" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "templateType" TEXT NOT NULL DEFAULT 'ai',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmailTemplate_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EmailTemplate_industryId_followUpNum_key" ON "EmailTemplate"("industryId", "followUpNum");

CREATE TABLE "IndustryConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "industryId" TEXT NOT NULL,
    "cadenceDays" JSON NOT NULL DEFAULT '[1,4,9,null,null,null,null,null,null,null]',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IndustryConfig_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "IndustryConfig_industryId_key" ON "IndustryConfig"("industryId");

CREATE TABLE "HistoricalSend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "industryId" TEXT NOT NULL,
    "followUpNum" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,
    "trackA" INTEGER NOT NULL DEFAULT 0,
    "trackB" INTEGER NOT NULL DEFAULT 0,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistoricalSend_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "HistoricalSend_industryId_idx" ON "HistoricalSend"("industryId");
CREATE INDEX "HistoricalSend_followUpNum_idx" ON "HistoricalSend"("followUpNum");

ALTER TABLE "Contact" ADD COLUMN "industryId" TEXT;
CREATE INDEX "Contact_industryId_idx" ON "Contact"("industryId");

ALTER TABLE "EmailLog" ADD COLUMN "industryId" TEXT;
CREATE INDEX "EmailLog_industryId_idx" ON "EmailLog"("industryId");
