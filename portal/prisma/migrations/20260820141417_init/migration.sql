-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "company" TEXT,
    "domain" TEXT NOT NULL,
    "title" TEXT,
    "country" TEXT,
    "track" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Queue',
    "source" TEXT DEFAULT 'Apollo',
    "allPermutations" TEXT,
    "day1SentAt" DATETIME,
    "day4SentAt" DATETIME,
    "day9SentAt" DATETIME,
    "repliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Contact_status_idx" ON "Contact"("status");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_domain_name_key" ON "Contact"("domain", "name");
