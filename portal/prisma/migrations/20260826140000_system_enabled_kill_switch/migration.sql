-- Global automation kill switch (default OFF)
ALTER TABLE "OutreachConfig" ADD COLUMN "systemEnabled" BOOLEAN NOT NULL DEFAULT false;
