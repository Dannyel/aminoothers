-- CreateEnum
CREATE TYPE "invoice_kind" AS ENUM ('INTERNAL_RECEIPT', 'FEL');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('ISSUED', 'VOIDED');

-- CreateEnum
CREATE TYPE "fel_status" AS ENUM ('PENDING', 'CERTIFIED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "promotion_type" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "promotion_id" UUID;

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "order_id" UUID NOT NULL,
    "kind" "invoice_kind" NOT NULL DEFAULT 'INTERNAL_RECEIPT',
    "status" "invoice_status" NOT NULL DEFAULT 'ISSUED',
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issued_by" UUID,
    "voided_at" TIMESTAMPTZ(3),
    "void_reason" VARCHAR(500),
    "voided_by" UUID,
    "customer_tax_id" VARCHAR(20) NOT NULL,
    "customer_name" VARCHAR(200) NOT NULL,
    "customer_address" VARCHAR(500),
    "currency" CHAR(3) NOT NULL DEFAULT 'GTQ',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount_total" DECIMAL(12,2) NOT NULL,
    "tax_total" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "fel_status" "fel_status" NOT NULL DEFAULT 'PENDING',
    "fel_authorization_uuid" UUID,
    "fel_series" VARCHAR(50),
    "fel_number" VARCHAR(50),
    "fel_certifier" VARCHAR(100),
    "fel_certified_at" TIMESTAMPTZ(3),
    "fel_registered_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "order_item_id" UUID,
    "description" VARCHAR(300) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL,
    "tax_amount" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,
    "is_good" BOOLEAN NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(500),
    "type" "promotion_type" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_products" (
    "promotion_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,

    CONSTRAINT "promotion_products_pkey" PRIMARY KEY ("promotion_id","product_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_order_id_key" ON "invoices"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_fel_authorization_uuid_key" ON "invoices"("fel_authorization_uuid");

-- CreateIndex
CREATE INDEX "invoices_status_issued_at_idx" ON "invoices"("status", "issued_at");

-- CreateIndex
CREATE INDEX "invoices_fel_status_idx" ON "invoices"("fel_status");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "promotions_starts_at_ends_at_idx" ON "promotions"("starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "promotion_products_product_id_idx" ON "promotion_products"("product_id");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_products" ADD CONSTRAINT "promotion_products_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_products" ADD CONSTRAINT "promotion_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── Restricciones que Prisma no expresa ────────────────────────────────────

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_amounts_check" CHECK (
    "subtotal" >= 0 AND "discount_total" >= 0 AND "tax_total" >= 0 AND "total" >= 0),
  ADD CONSTRAINT "invoices_void_check" CHECK (
    ("status" = 'VOIDED') = ("voided_at" IS NOT NULL AND "void_reason" IS NOT NULL)),
  ADD CONSTRAINT "invoices_fel_check" CHECK (
    "fel_status" <> 'CERTIFIED' OR (
      "fel_authorization_uuid" IS NOT NULL AND "fel_series" IS NOT NULL
      AND "fel_number" IS NOT NULL AND "fel_certified_at" IS NOT NULL));

ALTER TABLE "invoice_items"
  ADD CONSTRAINT "invoice_items_amounts_check" CHECK (
    "quantity" > 0 AND "unit_price" >= 0 AND "discount" >= 0
    AND "tax_amount" >= 0 AND "line_total" >= 0);

ALTER TABLE "promotions"
  ADD CONSTRAINT "promotions_dates_check" CHECK ("ends_at" > "starts_at"),
  ADD CONSTRAINT "promotions_value_check" CHECK (
    "value" > 0 AND ("type" <> 'PERCENTAGE' OR "value" <= 100));
CREATE INDEX "promotions_active_idx" ON "promotions" ("ends_at")
  WHERE "is_active" AND "deleted_at" IS NULL;
