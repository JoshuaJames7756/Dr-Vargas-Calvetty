-- 004: recordatorios por WhatsApp (columna reminder_sent_at en appointments). Ya aplicada.
-- Corre dentro de una transaccion: o se aplica completa o no se aplica nada.
BEGIN;

ALTER TABLE "appointments" ADD COLUMN "reminder_sent_at" timestamp with time zone;
-- Constancia en el registro de migraciones de Drizzle (por si algun dia se usa pnpm db:migrate).
DO $$
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NOT NULL THEN
    INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('560206ed88ad86bac09f70d2914785a667cbee991bb1470d611ef0b70935adac', 1792128730263);
  END IF;
END $$;

COMMIT;
