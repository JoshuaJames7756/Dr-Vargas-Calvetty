-- 002: restricciones (anti doble reserva, historial inmutable). YA APLICADA en tu Neon. No la vuelvas a ejecutar.
-- Restricciones que Drizzle no puede expresar en el esquema TypeScript.

-- 1) Anti doble reserva: dos citas CONFIRMED no pueden solaparse en el tiempo.
--    Intervalo semiabierto [inicio, fin): una cita que termina a las 10:00 no choca con una que empieza a las 10:00.
--    Los rangos (tstzrange) soportan GiST de forma nativa, no hace falta la extension btree_gist.
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("status" = 'CONFIRMED');


-- 2) Una cita reagendada apunta a su reemplazo.
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_rescheduled_to_fk"
  FOREIGN KEY ("rescheduled_to_id") REFERENCES "appointments"("id") ON DELETE RESTRICT;


-- 3) Una excepcion que no bloquea el dia debe definir un horario alternativo completo.
ALTER TABLE "availability_exceptions"
  ADD CONSTRAINT "availability_exceptions_alt_hours"
  CHECK (
    "blocked" = true
    OR ("start_minute" IS NOT NULL AND "end_minute" IS NOT NULL AND "slot_minutes" IS NOT NULL
        AND "start_minute" < "end_minute" AND "slot_minutes" > 0)
  );


-- 4) Registros inmutables: auditoria e historial de estados no se modifican ni se borran.
CREATE OR REPLACE FUNCTION prevent_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% es un registro de solo insercion', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER "audit_log_immutable_rows"
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION prevent_mutation();


CREATE TRIGGER "audit_log_immutable_truncate"
  BEFORE TRUNCATE ON "audit_log"
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_mutation();


CREATE TRIGGER "appointment_history_immutable_rows"
  BEFORE UPDATE OR DELETE ON "appointment_status_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_mutation();
