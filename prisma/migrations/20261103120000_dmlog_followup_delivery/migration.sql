-- Record follow-up delivery on the DmLog row.
-- Until now processFollowUp sent the message and wrote nothing, so a delivered
-- follow-up was indistinguishable from one that never fired except by reading the
-- worker's stdout log on the machine that happened to run it.
ALTER TABLE "DmLog" ADD COLUMN "followUpSentAt" TIMESTAMP(3);
ALTER TABLE "DmLog" ADD COLUMN "followUpError" TEXT;
