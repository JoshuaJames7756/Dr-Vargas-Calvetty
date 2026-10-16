-- 003: pacientes y notas clinicas. ESTA ES LA NUEVA: ejecutala una sola vez en el SQL Editor de Neon.
-- Corre dentro de una transaccion: o se aplica completa o no se aplica nada.
BEGIN;

CREATE TABLE "patient_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"author_staff_id" uuid NOT NULL,
	"body" text NOT NULL,
	"amends_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patient_notes_body_length" CHECK (char_length("patient_notes"."body") between 1 and 10000)
);

ALTER TABLE "patients" ADD COLUMN "birth_date" date;
ALTER TABLE "patients" ADD COLUMN "email" text;
ALTER TABLE "patient_notes" ADD CONSTRAINT "patient_notes_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "patient_notes" ADD CONSTRAINT "patient_notes_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "patient_notes" ADD CONSTRAINT "patient_notes_author_staff_id_staff_users_id_fk" FOREIGN KEY ("author_staff_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "patient_notes" ADD CONSTRAINT "patient_notes_amends_id_patient_notes_id_fk" FOREIGN KEY ("amends_id") REFERENCES "public"."patient_notes"("id") ON DELETE restrict ON UPDATE no action;
CREATE INDEX "patient_notes_patient_idx" ON "patient_notes" USING btree ("patient_id","created_at");
-- Las notas clinicas son de solo insercion: no se modifican ni se borran (una correccion es una nota nueva).
CREATE TRIGGER "patient_notes_immutable_rows"
  BEFORE UPDATE OR DELETE ON "patient_notes"
  FOR EACH ROW EXECUTE FUNCTION prevent_mutation();

CREATE TRIGGER "patient_notes_immutable_truncate"
  BEFORE TRUNCATE ON "patient_notes"
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_mutation();

-- Deja constancia en el registro de migraciones de Drizzle para que, si algun dia se usa pnpm db:migrate,
-- no intente aplicar esta migracion otra vez.
DO $$
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NOT NULL THEN
    INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('41329cbcd9341dfb95f39008591e86db32bf3d29abed13790d1fc51ebb390083', 1792107422310);
  END IF;
END $$;

COMMIT;
