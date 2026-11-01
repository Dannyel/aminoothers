-- CreateEnum
CREATE TYPE "shipment_status" AS ENUM ('DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED');

-- CreateEnum
CREATE TYPE "shipment_event_source" AS ENUM ('MANUAL', 'API');

-- CreateEnum
CREATE TYPE "return_status" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "return_disposition" AS ENUM ('PENDING_INSPECTION', 'RESTOCK', 'DESTROY', 'RETURN_TO_SUPPLIER');

-- CreateEnum
CREATE TYPE "refund_method" AS ENUM ('BANK_TRANSFER', 'CASH');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "quantity_returned" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cancel_reason" VARCHAR(500),
ADD COLUMN     "cancelled_at" TIMESTAMPTZ(3),
ADD COLUMN     "cancelled_by" UUID;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "bank_account_id" UUID,
ADD COLUMN     "bank_reference" VARCHAR(50),
ADD COLUMN     "collected_amount" DECIMAL(12,2),
ADD COLUMN     "collected_at" TIMESTAMPTZ(3),
ADD COLUMN     "collected_by" UUID,
ADD COLUMN     "collection_note" VARCHAR(500),
ADD COLUMN     "proof_file_id" UUID,
ADD COLUMN     "rejection_reason" VARCHAR(500),
ADD COLUMN     "submitted_at" TIMESTAMPTZ(3),
ADD COLUMN     "transfer_date" DATE,
ADD COLUMN     "verified_at" TIMESTAMPTZ(3),
ADD COLUMN     "verified_by" UUID;

-- AlterTable
ALTER TABLE "shipping_methods" ADD COLUMN     "courier_id" UUID;

-- AlterTable
ALTER TABLE "stock_reservations" ADD COLUMN     "consumed_movement_id" UUID;

-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN     "return_window_days" INTEGER NOT NULL DEFAULT 7;

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL,
    "bank_name" VARCHAR(100) NOT NULL,
    "account_number" VARCHAR(50) NOT NULL,
    "account_type" VARCHAR(30) NOT NULL,
    "account_holder" VARCHAR(150) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'GTQ',
    "instructions" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "couriers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(30),
    "website" VARCHAR(200),
    "tracking_url_template" VARCHAR(300),
    "integration_code" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "couriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "courier_id" UUID NOT NULL,
    "tracking_number" VARCHAR(100),
    "courier_cost" DECIMAL(12,2),
    "status" "shipment_status" NOT NULL DEFAULT 'DISPATCHED',
    "dispatched_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMPTZ(3),
    "received_by_name" VARCHAR(150),
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_events" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "status" "shipment_status" NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "location" VARCHAR(150),
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "shipment_event_source" NOT NULL DEFAULT 'MANUAL',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "returns" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "order_id" UUID NOT NULL,
    "status" "return_status" NOT NULL DEFAULT 'REQUESTED',
    "reason" VARCHAR(500) NOT NULL,
    "notes" VARCHAR(1000),
    "created_by" UUID NOT NULL,
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "rejected_reason" VARCHAR(500),
    "received_by" UUID,
    "received_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_items" (
    "id" UUID NOT NULL,
    "return_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "condition_notes" VARCHAR(500),
    "disposition" "return_disposition" NOT NULL DEFAULT 'PENDING_INSPECTION',
    "inspected_by" UUID,
    "inspected_at" TIMESTAMPTZ(3),
    "movement_id" UUID,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "return_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "refund_method" NOT NULL,
    "reference" VARCHAR(100),
    "reason" VARCHAR(500) NOT NULL,
    "status" "refund_status" NOT NULL DEFAULT 'PENDING',
    "created_by" UUID NOT NULL,
    "processed_by" UUID,
    "processed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipments_order_id_key" ON "shipments"("order_id");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "shipment_events_shipment_id_occurred_at_idx" ON "shipment_events"("shipment_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "returns_number_key" ON "returns"("number");

-- CreateIndex
CREATE INDEX "returns_order_id_idx" ON "returns"("order_id");

-- CreateIndex
CREATE INDEX "returns_status_created_at_idx" ON "returns"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "return_items_movement_id_key" ON "return_items"("movement_id");

-- CreateIndex
CREATE INDEX "return_items_return_id_idx" ON "return_items"("return_id");

-- CreateIndex
CREATE INDEX "return_items_order_item_id_idx" ON "return_items"("order_item_id");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "refunds_status_created_at_idx" ON "refunds"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_proof_file_id_key" ON "payments"("proof_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_reservations_consumed_movement_id_key" ON "stock_reservations"("consumed_movement_id");

-- AddForeignKey
ALTER TABLE "shipping_methods" ADD CONSTRAINT "shipping_methods_courier_id_fkey" FOREIGN KEY ("courier_id") REFERENCES "couriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_consumed_movement_id_fkey" FOREIGN KEY ("consumed_movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_proof_file_id_fkey" FOREIGN KEY ("proof_file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_courier_id_fkey" FOREIGN KEY ("courier_id") REFERENCES "couriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── Restricciones que Prisma no expresa ────────────────────────────────────

ALTER TABLE "store_settings"
  ADD CONSTRAINT "store_settings_return_window_check" CHECK ("return_window_days" BETWEEN 0 AND 90);

CREATE INDEX "bank_accounts_active_idx" ON "bank_accounts" ("sort_order") WHERE "deleted_at" IS NULL;

ALTER TABLE "couriers"
  ADD CONSTRAINT "couriers_tracking_template_check"
    CHECK ("tracking_url_template" IS NULL OR "tracking_url_template" LIKE '%{tracking}%');

-- Una referencia bancaria no se reutiliza en la misma cuenta (comprobantes
-- duplicados). Un intento rechazado no la bloquea: el cliente puede corregirlo.
CREATE UNIQUE INDEX "payments_bank_reference_unique_idx" ON "payments" ("bank_account_id", "bank_reference")
  WHERE "bank_reference" IS NOT NULL AND "status" NOT IN ('REJECTED', 'CANCELLED');
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_collected_amount_check" CHECK ("collected_amount" IS NULL OR "collected_amount" >= 0);

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_returned_check"
    CHECK ("quantity_returned" >= 0 AND "quantity_returned" <= "quantity");

-- Un número de guía no se repite en la misma mensajería.
CREATE UNIQUE INDEX "shipments_tracking_unique_idx" ON "shipments" ("courier_id", "tracking_number")
  WHERE "tracking_number" IS NOT NULL;
ALTER TABLE "shipments"
  ADD CONSTRAINT "shipments_courier_cost_check" CHECK ("courier_cost" IS NULL OR "courier_cost" >= 0);

ALTER TABLE "return_items" ADD CONSTRAINT "return_items_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_check" CHECK ("amount" > 0);

-- El seguimiento del envío es de solo inserción, como los demás historiales.
CREATE TRIGGER "shipment_events_immutable"
  BEFORE UPDATE OR DELETE ON "shipment_events"
  FOR EACH ROW EXECUTE FUNCTION forbid_history_changes();
