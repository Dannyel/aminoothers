-- CreateEnum
CREATE TYPE "lot_status" AS ENUM ('AVAILABLE', 'QUARANTINE', 'RECALLED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "movement_type" AS ENUM ('PURCHASE_RECEIPT', 'SALE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN_RESTOCK', 'WRITE_OFF', 'RETURN_TO_SUPPLIER');

-- CreateEnum
CREATE TYPE "purchase_order_status" AS ENUM ('DRAFT', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "store_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "min_shelf_life_days_for_sale" INTEGER NOT NULL DEFAULT 30,
    "near_expiry_days" INTEGER NOT NULL DEFAULT 90,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "lot_number" VARCHAR(50) NOT NULL,
    "expiration_date" DATE,
    "manufacturing_date" DATE,
    "status" "lot_status" NOT NULL DEFAULT 'AVAILABLE',
    "status_reason" VARCHAR(300),
    "qty_on_hand" INTEGER NOT NULL DEFAULT 0,
    "qty_reserved" INTEGER NOT NULL DEFAULT 0,
    "avg_unit_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "first_received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "lot_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "type" "movement_type" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "unit_cost" DECIMAL(12,4) NOT NULL,
    "reason_code" VARCHAR(30),
    "notes" VARCHAR(500),
    "reference_type" VARCHAR(30),
    "reference_id" UUID,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "tax_id" VARCHAR(20),
    "contact_name" VARCHAR(150),
    "phone" VARCHAR(30),
    "email" VARCHAR(254),
    "address" VARCHAR(300),
    "notes" VARCHAR(1000),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "supplier_id" UUID NOT NULL,
    "status" "purchase_order_status" NOT NULL DEFAULT 'DRAFT',
    "order_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_date" DATE,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" VARCHAR(1000),
    "created_by" UUID NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity_ordered" INTEGER NOT NULL,
    "quantity_received" INTEGER NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(12,4) NOT NULL,
    "tax_rate" DECIMAL(5,4) NOT NULL,
    "line_subtotal" DECIMAL(12,2) NOT NULL,
    "line_tax" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipts" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "supplier_invoice_number" VARCHAR(50),
    "notes" VARCHAR(1000),
    "received_by" UUID NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipt_items" (
    "id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "purchase_order_item_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "movement_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(12,4) NOT NULL,
    "initial_status" "lot_status" NOT NULL,

    CONSTRAINT "purchase_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE INDEX "lots_product_id_status_expiration_date_idx" ON "lots"("product_id", "status", "expiration_date");

-- CreateIndex
CREATE UNIQUE INDEX "lots_product_id_lot_number_key" ON "lots"("product_id", "lot_number");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_number_key" ON "inventory_movements"("number");

-- CreateIndex
CREATE INDEX "inventory_movements_lot_id_created_at_idx" ON "inventory_movements"("lot_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_product_id_created_at_idx" ON "inventory_movements"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_reference_type_reference_id_idx" ON "inventory_movements"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "inventory_movements_type_created_at_idx" ON "inventory_movements"("type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_number_key" ON "purchase_orders"("number");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_order_date_idx" ON "purchase_orders"("supplier_id", "order_date");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_items_purchase_order_id_product_id_key" ON "purchase_order_items"("purchase_order_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_receipts_number_key" ON "purchase_receipts"("number");

-- CreateIndex
CREATE INDEX "purchase_receipts_purchase_order_id_idx" ON "purchase_receipts"("purchase_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_receipt_items_movement_id_key" ON "purchase_receipt_items"("movement_id");

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Restricciones que Prisma no expresa ────────────────────────────────────

-- Existencias nunca negativas y nunca más reservado que lo físico.
ALTER TABLE "lots"
  ADD CONSTRAINT "lots_quantities_check"
    CHECK ("qty_on_hand" >= 0 AND "qty_reserved" >= 0 AND "qty_reserved" <= "qty_on_hand"),
  ADD CONSTRAINT "lots_avg_cost_check" CHECK ("avg_unit_cost" >= 0),
  ADD CONSTRAINT "lots_lot_number_check" CHECK (btrim("lot_number") <> '');
-- Vencidos y próximos a vencer con existencia.
CREATE INDEX "lots_expiration_with_stock_idx" ON "lots" ("expiration_date") WHERE "qty_on_hand" > 0;

-- El signo de la cantidad debe corresponder al tipo de movimiento.
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_quantity_sign_check" CHECK (
    ("type" IN ('PURCHASE_RECEIPT', 'ADJUSTMENT_IN', 'RETURN_RESTOCK') AND "quantity" > 0)
    OR ("type" IN ('SALE', 'ADJUSTMENT_OUT', 'WRITE_OFF', 'RETURN_TO_SUPPLIER') AND "quantity" < 0)
  ),
  ADD CONSTRAINT "inventory_movements_balance_check" CHECK ("balance_after" >= 0),
  ADD CONSTRAINT "inventory_movements_unit_cost_check" CHECK ("unit_cost" >= 0);

-- Los movimientos confirmados no se modifican ni se eliminan: los errores se
-- corrigen con un movimiento de ajuste.
CREATE OR REPLACE FUNCTION forbid_inventory_movement_changes() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Los movimientos de inventario son inmutables; registre un ajuste'
    USING ERRCODE = 'restrict_violation';
END $$;
CREATE TRIGGER "inventory_movements_immutable"
  BEFORE UPDATE OR DELETE ON "inventory_movements"
  FOR EACH ROW EXECUTE FUNCTION forbid_inventory_movement_changes();

ALTER TABLE "purchase_order_items"
  ADD CONSTRAINT "purchase_order_items_quantity_check" CHECK ("quantity_ordered" > 0),
  ADD CONSTRAINT "purchase_order_items_received_check"
    CHECK ("quantity_received" >= 0 AND "quantity_received" <= "quantity_ordered"),
  ADD CONSTRAINT "purchase_order_items_cost_check" CHECK ("unit_cost" >= 0 AND "tax_rate" >= 0);

ALTER TABLE "purchase_receipt_items"
  ADD CONSTRAINT "purchase_receipt_items_quantity_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "purchase_receipt_items_cost_check" CHECK ("unit_cost" >= 0);

CREATE INDEX "suppliers_active_idx" ON "suppliers" ("name") WHERE "deleted_at" IS NULL;

ALTER TABLE "store_settings"
  ADD CONSTRAINT "store_settings_single_row_check" CHECK ("id" = 1),
  ADD CONSTRAINT "store_settings_inventory_days_check"
    CHECK ("min_shelf_life_days_for_sale" BETWEEN 0 AND 365 AND "near_expiry_days" BETWEEN 1 AND 730);

-- ─── Datos de referencia ─────────────────────────────────────────────────────

-- Una sola bodega operativa (decisión de negocio).
INSERT INTO "warehouses" ("id", "code", "name", "updated_at")
  VALUES (gen_random_uuid(), 'PRINCIPAL', 'Bodega principal', now());

-- Parámetros iniciales (D4): 30 días de vida útil mínima, alerta a 90 días.
INSERT INTO "store_settings" ("id", "min_shelf_life_days_for_sale", "near_expiry_days", "updated_at")
  VALUES (1, 30, 90, now());
