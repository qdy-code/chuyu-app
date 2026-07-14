CREATE TABLE IF NOT EXISTS "AppointmentUnavailableDate" (
  "id" TEXT NOT NULL,
  "appointmentDate" TEXT NOT NULL,
  "businessType" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppointmentUnavailableDate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AppointmentUnavailableDate_appointmentDate_businessType_key"
  ON "AppointmentUnavailableDate"("appointmentDate", "businessType");
CREATE INDEX IF NOT EXISTS "AppointmentUnavailableDate_appointmentDate_idx"
  ON "AppointmentUnavailableDate"("appointmentDate");
CREATE INDEX IF NOT EXISTS "AppointmentUnavailableDate_businessType_idx"
  ON "AppointmentUnavailableDate"("businessType");
