-- Cadence V2: 10-slot cadenceDays, followUpDates, EmailLog, status rename

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "followUpDates" JSON;

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contactId" TEXT NOT NULL,
    "followUpNum" INTEGER NOT NULL,
    "track" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "EmailLog_sentAt_idx" ON "EmailLog"("sentAt");
CREATE INDEX "EmailLog_followUpNum_idx" ON "EmailLog"("followUpNum");
CREATE INDEX "EmailLog_track_idx" ON "EmailLog"("track");

-- Rename status values
UPDATE "Contact" SET status = 'Follow1 Sent' WHERE status = 'Day1 Sent';
UPDATE "Contact" SET status = 'Follow2 Sent' WHERE status = 'Day4 Sent';
UPDATE "Contact" SET status = 'Follow3 Sent' WHERE status = 'Day9 Sent';

-- Backfill followUpDates from legacy timestamp fields
UPDATE "Contact"
SET "followUpDates" = json_object(
  '1', CASE WHEN "day1SentAt" IS NOT NULL THEN "day1SentAt" END,
  '2', CASE WHEN "day4SentAt" IS NOT NULL THEN "day4SentAt" END,
  '3', CASE WHEN "day9SentAt" IS NOT NULL THEN "day9SentAt" END
)
WHERE "day1SentAt" IS NOT NULL OR "day4SentAt" IS NOT NULL OR "day9SentAt" IS NOT NULL;

-- Backfill EmailLog
INSERT INTO "EmailLog" ("contactId", "followUpNum", "track", "sentAt")
SELECT id, 1, track, "day1SentAt" FROM "Contact" WHERE "day1SentAt" IS NOT NULL;

INSERT INTO "EmailLog" ("contactId", "followUpNum", "track", "sentAt")
SELECT id, 2, track, "day4SentAt" FROM "Contact" WHERE "day4SentAt" IS NOT NULL;

INSERT INTO "EmailLog" ("contactId", "followUpNum", "track", "sentAt")
SELECT id, 3, track, "day9SentAt" FROM "Contact" WHERE "day9SentAt" IS NOT NULL;

-- Rebuild OutreachConfig with cadenceDays JSON
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OutreachConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "cadenceDays" JSON NOT NULL DEFAULT '[1,4,9,null,null,null,null,null,null,null]',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_OutreachConfig" ("id", "cadenceDays", "updatedAt")
SELECT
  "id",
  json_array(
    COALESCE("sequenceDay1", 1),
    COALESCE("sequenceDay2", 4),
    COALESCE("sequenceDay3", 9),
    null, null, null, null, null, null, null
  ),
  "updatedAt"
FROM "OutreachConfig";
DROP TABLE "OutreachConfig";
ALTER TABLE "new_OutreachConfig" RENAME TO "OutreachConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
