/**
 * Autoriza a un usuario de Clerk para entrar al panel. Sin esta fila, iniciar sesion NO da acceso.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." pnpm --filter @dr-vargas/api db:add-staff -- user_XXXX "Dr. Rolando Vargas" doctor
 *
 * El ID (user_...) se ve en el dashboard de Clerk, seccion Users.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { staffUsers } from "../src/db/schema";

const [clerkUserId, displayName, role] = process.argv.slice(2);
const url = process.env.DATABASE_URL;

if (!url) throw new Error("Falta DATABASE_URL");
if (!clerkUserId?.startsWith("user_") || !displayName || (role !== "doctor" && role !== "assistant")) {
  throw new Error('Uso: db:add-staff -- user_XXXX "Nombre visible" doctor|assistant');
}

const db = drizzle(neon(url));
const [row] = await db
  .insert(staffUsers)
  .values({ clerkUserId, displayName, role })
  .onConflictDoUpdate({ target: staffUsers.clerkUserId, set: { displayName, role, active: true } })
  .returning({ id: staffUsers.id, role: staffUsers.role });
console.log("Usuario autorizado:", row);
