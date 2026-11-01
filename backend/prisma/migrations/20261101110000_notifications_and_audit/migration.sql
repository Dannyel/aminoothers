-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('ORDER_PLACED', 'ORDER_STATUS_CHANGED', 'STAFF_TRANSFER_TO_VERIFY', 'STAFF_INVENTORY_DIGEST');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN     "staff_alert_email" VARCHAR(254);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "recipient" VARCHAR(254) NOT NULL,
    "payload" JSONB NOT NULL,
    "subject" VARCHAR(300),
    "status" "notification_status" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" VARCHAR(1000),
    "sent_at" TIMESTAMPTZ(3),
    "related_type" VARCHAR(30),
    "related_id" UUID,
    "dedupe_key" VARCHAR(100),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(60) NOT NULL,
    "module" VARCHAR(40) NOT NULL,
    "route" VARCHAR(200),
    "entity_id" VARCHAR(64),
    "changes" JSONB,
    "status_code" INTEGER,
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_logs_dedupe_key_key" ON "notification_logs"("dedupe_key");

-- CreateIndex
CREATE INDEX "notification_logs_related_type_related_id_idx" ON "notification_logs"("related_type", "related_id");

-- CreateIndex
CREATE INDEX "notification_logs_created_at_idx" ON "notification_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_module_created_at_idx" ON "audit_logs"("module", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_id_idx" ON "audit_logs"("entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── Restricciones que Prisma no expresa ────────────────────────────────────

ALTER TABLE "notification_logs"
  ADD CONSTRAINT "notification_logs_attempts_check" CHECK ("attempts" >= 0),
  ADD CONSTRAINT "notification_logs_sent_check" CHECK (
    ("status" = 'SENT') = ("sent_at" IS NOT NULL));

-- El despachador solo recorre lo pendiente.
CREATE INDEX "notification_logs_pending_idx" ON "notification_logs" ("next_attempt_at")
  WHERE "status" = 'PENDING';

-- La auditoría solo admite inserciones.
CREATE OR REPLACE FUNCTION forbid_audit_changes() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'El registro de auditoría es de solo inserción'
    USING ERRCODE = 'restrict_violation';
END $$;
CREATE TRIGGER "audit_logs_immutable"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_changes();
