-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PENDING_PAYMENT', 'PAYMENT_IN_REVIEW', 'PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'DELIVERY_FAILED', 'RETURNED_TO_STORE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('BANK_TRANSFER', 'CASH_ON_DELIVERY');

-- CreateEnum
CREATE TYPE "reservation_status" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN     "business_hours" VARCHAR(300),
ADD COLUMN     "cod_reservation_hours" INTEGER NOT NULL DEFAULT 48,
ADD COLUMN     "email" VARCHAR(254),
ADD COLUMN     "fiscal_address" VARCHAR(300),
ADD COLUMN     "legal_name" VARCHAR(200),
ADD COLUMN     "logo_file_id" UUID,
ADD COLUMN     "max_units_per_product" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "phone" VARCHAR(30),
ADD COLUMN     "regent_name" VARCHAR(150),
ADD COLUMN     "regulatory_notice" VARCHAR(2000) NOT NULL DEFAULT 'La información de esta tienda no sustituye la consulta con un profesional de la salud.',
ADD COLUMN     "sanitary_license" VARCHAR(100),
ADD COLUMN     "tax_id" VARCHAR(20),
ADD COLUMN     "trade_name" VARCHAR(150) NOT NULL DEFAULT 'Farmacia en línea',
ADD COLUMN     "transfer_reservation_hours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "whatsapp" VARCHAR(30);

-- CreateTable
CREATE TABLE "shipping_methods" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(300),
    "cost" DECIMAL(12,2) NOT NULL,
    "estimated_days_min" INTEGER,
    "estimated_days_max" INTEGER,
    "coverage_note" VARCHAR(300),
    "allows_cash_on_delivery" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "shipping_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "customer_id" UUID NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "status" "order_status" NOT NULL,
    "placed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reservation_expires_at" TIMESTAMPTZ(3),
    "customer_name" VARCHAR(201) NOT NULL,
    "customer_email" VARCHAR(254) NOT NULL,
    "customer_phone" VARCHAR(30),
    "billing_tax_id" VARCHAR(20) NOT NULL,
    "billing_name" VARCHAR(200) NOT NULL,
    "customer_address_id" UUID,
    "ship_recipient_name" VARCHAR(150) NOT NULL,
    "ship_phone" VARCHAR(30) NOT NULL,
    "ship_address_line1" VARCHAR(200) NOT NULL,
    "ship_address_line2" VARCHAR(200),
    "ship_zone" VARCHAR(20),
    "ship_municipality" VARCHAR(100) NOT NULL,
    "ship_department" VARCHAR(50) NOT NULL,
    "ship_reference" VARCHAR(300),
    "shipping_method_id" UUID NOT NULL,
    "shipping_method_name" VARCHAR(100) NOT NULL,
    "shipping_cost" DECIMAL(12,2) NOT NULL,
    "shipping_tax" DECIMAL(12,2) NOT NULL,
    "payment_method" "payment_method" NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'GTQ',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "customer_notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku" VARCHAR(50) NOT NULL,
    "product_name" VARCHAR(200) NOT NULL,
    "presentation_label" VARCHAR(100),
    "concentration_label" VARCHAR(100),
    "sale_condition" "sale_condition" NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "unit_discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,4) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_subtotal" DECIMAL(12,2) NOT NULL,
    "line_discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "line_tax" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" "order_status",
    "to_status" "order_status" NOT NULL,
    "changed_by" UUID,
    "note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "reservation_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "method" "payment_method" NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'GTQ',
    "provider" VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_status_history" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "from_status" "payment_status",
    "to_status" "payment_status" NOT NULL,
    "changed_by" UUID,
    "note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carts_customer_id_key" ON "carts"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_product_id_key" ON "cart_items"("cart_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

-- CreateIndex
CREATE INDEX "orders_customer_id_placed_at_idx" ON "orders"("customer_id", "placed_at" DESC);

-- CreateIndex
CREATE INDEX "orders_status_placed_at_idx" ON "orders"("status", "placed_at");

-- CreateIndex
CREATE INDEX "orders_placed_at_idx" ON "orders"("placed_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_customer_id_idempotency_key_key" ON "orders"("customer_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_product_id_key" ON "order_items"("order_id", "product_id");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_reservations_order_item_id_idx" ON "stock_reservations"("order_item_id");

-- CreateIndex
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payment_status_history_payment_id_created_at_idx" ON "payment_status_history"("payment_id", "created_at");

-- AddForeignKey
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_logo_file_id_fkey" FOREIGN KEY ("logo_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_address_id_fkey" FOREIGN KEY ("customer_address_id") REFERENCES "customer_addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_method_id_fkey" FOREIGN KEY ("shipping_method_id") REFERENCES "shipping_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_status_history" ADD CONSTRAINT "payment_status_history_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_status_history" ADD CONSTRAINT "payment_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Restricciones que Prisma no expresa ────────────────────────────────────

ALTER TABLE "store_settings"
  ADD CONSTRAINT "store_settings_order_params_check" CHECK (
    "transfer_reservation_hours" BETWEEN 1 AND 168
    AND "cod_reservation_hours" BETWEEN 1 AND 168
    AND "max_units_per_product" BETWEEN 1 AND 100),
  ADD CONSTRAINT "store_settings_trade_name_check" CHECK (btrim("trade_name") <> '');

ALTER TABLE "shipping_methods"
  ADD CONSTRAINT "shipping_methods_cost_check" CHECK ("cost" >= 0),
  ADD CONSTRAINT "shipping_methods_days_check" CHECK (
    ("estimated_days_min" IS NULL OR "estimated_days_min" >= 0)
    AND ("estimated_days_max" IS NULL OR "estimated_days_max" >= COALESCE("estimated_days_min", 0)));
CREATE INDEX "shipping_methods_active_idx" ON "shipping_methods" ("sort_order") WHERE "deleted_at" IS NULL;

ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_quantity_check" CHECK ("quantity" > 0);

-- Importes del pedido: con precios con IVA incluido (D1) el total es la suma
-- de las líneas con descuento más el envío.
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_amounts_check" CHECK (
    "subtotal" >= 0 AND "discount_total" >= 0 AND "tax_total" >= 0
    AND "shipping_cost" >= 0 AND "shipping_tax" >= 0
    AND "total" = "subtotal" - "discount_total" + "shipping_cost"),
  ADD CONSTRAINT "orders_billing_tax_id_check" CHECK ("billing_tax_id" ~ '^(CF|[0-9]{1,12}[0-9K])$');

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_quantity_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_items_amounts_check" CHECK (
    "unit_price" > 0 AND "unit_discount" >= 0 AND "unit_discount" <= "unit_price"
    AND "tax_rate" >= 0
    AND "line_subtotal" = "unit_price" * "quantity"
    AND "line_discount" = "unit_discount" * "quantity"
    AND "line_total" = "line_subtotal" - "line_discount"
    AND "line_tax" >= 0 AND "line_tax" <= "line_total");

ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_quantity_check" CHECK ("quantity" > 0);
CREATE INDEX "stock_reservations_active_lot_idx" ON "stock_reservations" ("lot_id") WHERE "status" = 'ACTIVE';

-- Pedidos pendientes cuya reserva vence (tarea periódica de expiración).
CREATE INDEX "orders_reservation_due_idx" ON "orders" ("reservation_expires_at")
  WHERE "status" IN ('PENDING_PAYMENT', 'PENDING_CONFIRMATION');

ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_check" CHECK ("amount" >= 0);
-- Un solo pago vigente por pedido; los rechazados y cancelados quedan en el historial.
CREATE UNIQUE INDEX "payments_one_open_per_order_idx" ON "payments" ("order_id")
  WHERE "status" IN ('PENDING', 'IN_REVIEW', 'APPROVED');

-- Los historiales solo admiten inserciones.
CREATE OR REPLACE FUNCTION forbid_history_changes() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'El historial de estados es de solo inserción'
    USING ERRCODE = 'restrict_violation';
END $$;

CREATE TRIGGER "order_status_history_immutable"
  BEFORE UPDATE OR DELETE ON "order_status_history"
  FOR EACH ROW EXECUTE FUNCTION forbid_history_changes();
CREATE TRIGGER "payment_status_history_immutable"
  BEFORE UPDATE OR DELETE ON "payment_status_history"
  FOR EACH ROW EXECUTE FUNCTION forbid_history_changes();
