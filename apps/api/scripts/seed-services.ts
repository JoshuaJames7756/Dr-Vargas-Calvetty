/**
 * Carga inicial de servicios solicitables. Es idempotente (se puede ejecutar varias veces).
 *
 * Uso:  DATABASE_URL="postgresql://..." pnpm --filter @dr-vargas/api db:seed
 *
 * PENDIENTE: el doctor debe validar nombres, orden y DURACIONES (30 min es un valor provisional).
 * No se incluyen cirugias ni tratamientos oncologicos como "citas en linea"; esos se coordinan en consulta.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { services } from "../src/db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL");

const db = drizzle(neon(url));

const DEFAULT_MINUTES = 30;

const rows = [
  { slug: "consulta-ginecologia", name: "Consulta de ginecología", specialty: "ginecologia" },
  { slug: "control-prenatal", name: "Control prenatal", specialty: "ginecologia" },
  { slug: "papanicolaou", name: "Toma de Papanicolaou", specialty: "ginecologia" },
  { slug: "colposcopia", name: "Colposcopia", specialty: "ginecologia" },
  { slug: "vulvoscopia", name: "Vulvoscopia", specialty: "ginecologia" },
  { slug: "diagnostico-vph", name: "Diagnóstico de VPH", specialty: "ginecologia" },
  { slug: "planificacion-familiar", name: "Planificación familiar", specialty: "ginecologia" },
  { slug: "climaterio-menopausia", name: "Climaterio, menopausia y osteoporosis", specialty: "ginecologia" },
  { slug: "consulta-oncologia", name: "Consulta de oncología", specialty: "oncologia" },
  { slug: "consulta-mastologia", name: "Consulta de mastología", specialty: "mastologia" },
].map((r, i) => ({ ...r, durationMinutes: DEFAULT_MINUTES, bookable: true, published: true, sortOrder: i }));

const inserted = await db.insert(services).values(rows).onConflictDoNothing({ target: services.slug }).returning({ slug: services.slug });
console.log(`Servicios nuevos: ${inserted.length} de ${rows.length}`);
