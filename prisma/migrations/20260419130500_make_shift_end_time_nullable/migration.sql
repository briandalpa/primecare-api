ALTER TABLE "shifts" ALTER COLUMN "end_time" DROP NOT NULL;

CREATE INDEX "shifts_staff_id_end_time_idx" ON "shifts"("staff_id", "end_time");
