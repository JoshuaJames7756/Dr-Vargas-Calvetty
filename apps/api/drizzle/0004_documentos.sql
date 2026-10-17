CREATE TABLE "patient_document_files" (
	"document_id" uuid PRIMARY KEY NOT NULL,
	"content" "bytea" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"uploaded_by_staff_id" uuid NOT NULL,
	"title" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_staff_id" uuid,
	CONSTRAINT "patient_documents_title_length" CHECK (char_length("patient_documents"."title") between 1 and 120),
	CONSTRAINT "patient_documents_size" CHECK ("patient_documents"."size_bytes" between 1 and 2097152),
	CONSTRAINT "patient_documents_mime" CHECK ("patient_documents"."mime_type" in ('application/pdf','image/jpeg','image/png','image/webp')),
	CONSTRAINT "patient_documents_deleted_pair" CHECK (("patient_documents"."deleted_at" is null) = ("patient_documents"."deleted_by_staff_id" is null))
);
--> statement-breakpoint
ALTER TABLE "patient_document_files" ADD CONSTRAINT "patient_document_files_document_id_patient_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."patient_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_uploaded_by_staff_id_staff_users_id_fk" FOREIGN KEY ("uploaded_by_staff_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_deleted_by_staff_id_staff_users_id_fk" FOREIGN KEY ("deleted_by_staff_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patient_documents_patient_idx" ON "patient_documents" USING btree ("patient_id","created_at");--> statement-breakpoint

-- Protecciones de los documentos clinicos (Drizzle no las expresa en el esquema).
-- 1) El contenido de un archivo es inmutable: no se modifica ni se borra, ni por error ni a proposito.
CREATE TRIGGER "patient_document_files_immutable_rows"
  BEFORE UPDATE OR DELETE ON "patient_document_files"
  FOR EACH ROW EXECUTE FUNCTION prevent_mutation();
--> statement-breakpoint
CREATE TRIGGER "patient_document_files_immutable_truncate"
  BEFORE TRUNCATE ON "patient_document_files"
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_mutation();
--> statement-breakpoint

-- 2) Los metadatos tampoco se borran. Lo unico que puede cambiar es la "eliminacion logica" (deleted_at y deleted_by),
--    una sola vez e irreversible.
CREATE OR REPLACE FUNCTION patient_documents_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'patient_documents no permite borrar filas: usa la eliminacion logica (deleted_at)';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.uploaded_by_staff_id IS DISTINCT FROM OLD.uploaded_by_staff_id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.file_name IS DISTINCT FROM OLD.file_name
     OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
     OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes
     OR NEW.sha256 IS DISTINCT FROM OLD.sha256
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'patient_documents solo permite registrar la eliminacion logica';
  END IF;
  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'este documento ya fue eliminado y no se puede cambiar';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "patient_documents_guard_rows"
  BEFORE UPDATE OR DELETE ON "patient_documents"
  FOR EACH ROW EXECUTE FUNCTION patient_documents_guard();
--> statement-breakpoint
CREATE TRIGGER "patient_documents_immutable_truncate"
  BEFORE TRUNCATE ON "patient_documents"
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_mutation();
