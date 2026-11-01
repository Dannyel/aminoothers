-- Retención de la auditoría (D20): los registros no se modifican nunca y solo
-- pueden borrarse cuando tienen más de 5 años. La regla vive en la base de
-- datos, así ningún proceso puede acortar el plazo.
CREATE OR REPLACE FUNCTION forbid_audit_changes() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.created_at < now() - interval '5 years' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'El registro de auditoría es de solo inserción (se conserva 5 años)'
    USING ERRCODE = 'restrict_violation';
END $$;
