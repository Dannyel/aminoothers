-- CreateEnum
CREATE TYPE "file_purpose" AS ENUM ('PRODUCT_IMAGE', 'CATEGORY_IMAGE', 'PAYMENT_PROOF', 'PRESCRIPTION', 'LOGO', 'FEL_DOCUMENT');

-- CreateEnum
CREATE TYPE "sale_condition" AS ENUM ('OTC', 'PRESCRIPTION', 'RETAINED_PRESCRIPTION', 'CONTROLLED');

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "storage_key" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "purpose" "file_purpose" NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "rate" DECIMAL(5,4) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "image_file_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcategories" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(170) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "manufacturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presentations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "presentations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concentrations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "concentrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_ingredients" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(170) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "active_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "sku" VARCHAR(50) NOT NULL,
    "barcode" VARCHAR(50),
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(250) NOT NULL,
    "short_description" VARCHAR(300),
    "description" TEXT,
    "category_id" UUID NOT NULL,
    "subcategory_id" UUID,
    "brand_id" UUID,
    "manufacturer_id" UUID,
    "presentation_id" UUID,
    "concentration_id" UUID,
    "sanitary_registration" VARCHAR(100),
    "sanitary_registration_expires_at" DATE,
    "price" DECIMAL(12,2) NOT NULL,
    "tax_rate_id" UUID NOT NULL,
    "sale_condition" "sale_condition" NOT NULL DEFAULT 'OTC',
    "online_sale_enabled" BOOLEAN NOT NULL DEFAULT false,
    "online_sale_approved_by" UUID,
    "online_sale_approved_at" TIMESTAMPTZ(3),
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_active_ingredients" (
    "product_id" UUID NOT NULL,
    "active_ingredient_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_active_ingredients_pkey" PRIMARY KEY ("product_id","active_ingredient_id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "alt_text" VARCHAR(200),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_tags" (
    "product_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "product_tags_pkey" PRIMARY KEY ("product_id","tag_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_key_key" ON "files"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rates_code_key" ON "tax_rates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "subcategories_id_category_id_key" ON "subcategories"("id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_category_id_is_active_idx" ON "products"("category_id", "is_active");

-- CreateIndex
CREATE INDEX "products_subcategory_id_idx" ON "products"("subcategory_id");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");

-- CreateIndex
CREATE INDEX "product_active_ingredients_active_ingredient_id_idx" ON "product_active_ingredients"("active_ingredient_id");

-- CreateIndex
CREATE INDEX "product_images_product_id_sort_order_idx" ON "product_images"("product_id", "sort_order");

-- CreateIndex
CREATE INDEX "product_tags_tag_id_idx" ON "product_tags"("tag_id");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_subcategory_id_category_id_fkey" FOREIGN KEY ("subcategory_id", "category_id") REFERENCES "subcategories"("id", "category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_presentation_id_fkey" FOREIGN KEY ("presentation_id") REFERENCES "presentations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_concentration_id_fkey" FOREIGN KEY ("concentration_id") REFERENCES "concentrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "tax_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_active_ingredients" ADD CONSTRAINT "product_active_ingredients_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_active_ingredients" ADD CONSTRAINT "product_active_ingredients_active_ingredient_id_fkey" FOREIGN KEY ("active_ingredient_id") REFERENCES "active_ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Restricciones que Prisma no expresa ────────────────────────────────────

-- Nombres (slug) únicos solo entre registros vigentes: una baja lógica no
-- impide volver a crear el mismo nombre.
CREATE UNIQUE INDEX "categories_slug_active_key" ON "categories" ("slug") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "subcategories_category_slug_active_key" ON "subcategories" ("category_id", "slug") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "brands_slug_active_key" ON "brands" ("slug") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "manufacturers_slug_active_key" ON "manufacturers" ("slug") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "presentations_slug_active_key" ON "presentations" ("slug") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "concentrations_slug_active_key" ON "concentrations" ("slug") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "active_ingredients_slug_active_key" ON "active_ingredients" ("slug") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "tags_slug_active_key" ON "tags" ("slug") WHERE "deleted_at" IS NULL;

-- Código de barras único entre productos vigentes que lo tienen.
CREATE UNIQUE INDEX "products_barcode_active_key" ON "products" ("barcode")
  WHERE "barcode" IS NOT NULL AND "deleted_at" IS NULL;

ALTER TABLE "products"
  ADD CONSTRAINT "products_price_positive_check" CHECK ("price" > 0),
  ADD CONSTRAINT "products_low_stock_threshold_check" CHECK ("low_stock_threshold" >= 0),
  ADD CONSTRAINT "products_name_not_blank_check" CHECK (btrim("name") <> '' AND btrim("sku") <> ''),
  -- Los controlados nunca se habilitan para la venta en línea.
  ADD CONSTRAINT "products_controlled_not_online_check"
    CHECK (NOT ("sale_condition" = 'CONTROLLED' AND "online_sale_enabled")),
  -- La habilitación en línea siempre registra quién y cuándo la aprobó.
  ADD CONSTRAINT "products_online_sale_approval_check"
    CHECK (NOT "online_sale_enabled" OR ("online_sale_approved_by" IS NOT NULL AND "online_sale_approved_at" IS NOT NULL));

-- Una sola imagen principal por producto.
CREATE UNIQUE INDEX "product_images_one_primary_per_product" ON "product_images" ("product_id") WHERE "is_primary";
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_sort_order_check" CHECK ("sort_order" >= 0);

ALTER TABLE "files" ADD CONSTRAINT "files_size_positive_check" CHECK ("size_bytes" > 0);

ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_rate_range_check" CHECK ("rate" >= 0 AND "rate" < 1);
CREATE UNIQUE INDEX "tax_rates_one_default" ON "tax_rates" ("is_default") WHERE "is_default";

-- ─── Búsqueda sin distinción de tildes ni mayúsculas ────────────────────────

-- unaccent() no es IMMUTABLE y no puede usarse en índices; este envoltorio fija
-- el diccionario y sí lo es.
CREATE OR REPLACE FUNCTION immutable_unaccent(value text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, lower(value)) $$;

CREATE INDEX "products_name_search_idx" ON "products" USING gin (immutable_unaccent("name") gin_trgm_ops);
CREATE INDEX "products_sku_search_idx" ON "products" USING gin (lower("sku") gin_trgm_ops);
CREATE INDEX "active_ingredients_name_search_idx" ON "active_ingredients" USING gin (immutable_unaccent("name") gin_trgm_ops);
CREATE INDEX "brands_name_search_idx" ON "brands" USING gin (immutable_unaccent("name") gin_trgm_ops);

-- ─── Datos de referencia ─────────────────────────────────────────────────────

-- Tasas iniciales (D1: precios con IVA incluido). Se administran en la Fase 8.
INSERT INTO "tax_rates" ("id", "code", "name", "rate", "is_default", "is_active", "updated_at") VALUES
  (gen_random_uuid(), 'IVA', 'IVA 12 %', 0.1200, true, true, now()),
  (gen_random_uuid(), 'EXENTO', 'Exento de IVA', 0.0000, false, true, now());
