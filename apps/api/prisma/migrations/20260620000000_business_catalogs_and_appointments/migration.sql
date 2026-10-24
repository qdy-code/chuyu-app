ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "businessType" TEXT NOT NULL DEFAULT 'NAIL';
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "productId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "productName" TEXT;

CREATE TABLE IF NOT EXISTS "NailCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NailCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AccessoryCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccessoryCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FlowerCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FlowerCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NailProduct" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT,
  "categoryName" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "referencePrice" DOUBLE PRECISION,
  "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NailProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AccessoryProduct" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT,
  "categoryName" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "referencePrice" DOUBLE PRECISION,
  "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "reservedByUserId" TEXT,
  "reservedAppointmentId" TEXT,
  "reservedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccessoryProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FlowerProduct" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT,
  "categoryName" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "referencePrice" DOUBLE PRECISION,
  "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FlowerProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NailCategory_name_key" ON "NailCategory"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "AccessoryCategory_name_key" ON "AccessoryCategory"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "FlowerCategory_name_key" ON "FlowerCategory"("name");

CREATE INDEX IF NOT EXISTS "Appointment_businessType_idx" ON "Appointment"("businessType");
CREATE INDEX IF NOT EXISTS "Appointment_productId_idx" ON "Appointment"("productId");
CREATE INDEX IF NOT EXISTS "NailCategory_sortOrder_idx" ON "NailCategory"("sortOrder");
CREATE INDEX IF NOT EXISTS "AccessoryCategory_sortOrder_idx" ON "AccessoryCategory"("sortOrder");
CREATE INDEX IF NOT EXISTS "FlowerCategory_sortOrder_idx" ON "FlowerCategory"("sortOrder");
CREATE INDEX IF NOT EXISTS "NailProduct_categoryId_idx" ON "NailProduct"("categoryId");
CREATE INDEX IF NOT EXISTS "NailProduct_sortOrder_idx" ON "NailProduct"("sortOrder");
CREATE INDEX IF NOT EXISTS "NailProduct_isActive_idx" ON "NailProduct"("isActive");
CREATE INDEX IF NOT EXISTS "AccessoryProduct_categoryId_idx" ON "AccessoryProduct"("categoryId");
CREATE INDEX IF NOT EXISTS "AccessoryProduct_sortOrder_idx" ON "AccessoryProduct"("sortOrder");
CREATE INDEX IF NOT EXISTS "AccessoryProduct_isActive_idx" ON "AccessoryProduct"("isActive");
CREATE INDEX IF NOT EXISTS "AccessoryProduct_reservedByUserId_idx" ON "AccessoryProduct"("reservedByUserId");
CREATE INDEX IF NOT EXISTS "FlowerProduct_categoryId_idx" ON "FlowerProduct"("categoryId");
CREATE INDEX IF NOT EXISTS "FlowerProduct_sortOrder_idx" ON "FlowerProduct"("sortOrder");
CREATE INDEX IF NOT EXISTS "FlowerProduct_isActive_idx" ON "FlowerProduct"("isActive");
