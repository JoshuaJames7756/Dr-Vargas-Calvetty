-- 001: tablas iniciales. YA APLICADA en tu Neon (con pnpm db:migrate). No la vuelvas a ejecutar.
CREATE TYPE "public"."appointment_status" AS ENUM('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'RESCHEDULED');
CREATE TYPE "public"."staff_role" AS ENUM('doctor', 'assistant');
CREATE TABLE "appointment_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"from_status" "appointment_status",
	"to_status" "appointment_status" NOT NULL,
	"actor_staff_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"patient_id" uuid,
	"requester_name" text NOT NULL,
	"requester_phone" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "appointment_status" DEFAULT 'PENDING' NOT NULL,
	"reason" text,
	"rescheduled_to_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_time_order" CHECK ("appointments"."ends_at" > "appointments"."starts_at")
);

CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"metadata" jsonb
);

CREATE TABLE "availability_breaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weekday" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	CONSTRAINT "availability_breaks_weekday" CHECK ("availability_breaks"."weekday" between 0 and 6),
	CONSTRAINT "availability_breaks_range" CHECK ("availability_breaks"."start_minute" >= 0 and "availability_breaks"."end_minute" <= 1440 and "availability_breaks"."start_minute" < "availability_breaks"."end_minute")
);

CREATE TABLE "availability_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"blocked" boolean DEFAULT true NOT NULL,
	"start_minute" integer,
	"end_minute" integer,
	"slot_minutes" integer,
	"note" text
);

CREATE TABLE "availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weekday" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"slot_minutes" integer DEFAULT 30 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "availability_rules_weekday" CHECK ("availability_rules"."weekday" between 0 and 6),
	CONSTRAINT "availability_rules_range" CHECK ("availability_rules"."start_minute" >= 0 and "availability_rules"."end_minute" <= 1440 and "availability_rules"."start_minute" < "availability_rules"."end_minute"),
	CONSTRAINT "availability_rules_slot" CHECK ("availability_rules"."slot_minutes" > 0)
);

CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"message" text NOT NULL,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"specialty" text NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"bookable" boolean DEFAULT true NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "services_slug_unique" UNIQUE("slug")
);

CREATE TABLE "staff_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "staff_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);

ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appointment_status_history_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appointment_status_history_actor_staff_id_staff_users_id_fk" FOREIGN KEY ("actor_staff_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;
CREATE INDEX "appointment_history_appt_idx" ON "appointment_status_history" USING btree ("appointment_id");
CREATE INDEX "appointments_starts_at_idx" ON "appointments" USING btree ("starts_at");
CREATE INDEX "appointments_status_idx" ON "appointments" USING btree ("status");
CREATE INDEX "appointments_patient_idx" ON "appointments" USING btree ("patient_id");
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");
CREATE UNIQUE INDEX "availability_exceptions_date_idx" ON "availability_exceptions" USING btree ("date");
CREATE INDEX "patients_phone_idx" ON "patients" USING btree ("phone");
CREATE INDEX "patients_name_idx" ON "patients" USING btree ("full_name");