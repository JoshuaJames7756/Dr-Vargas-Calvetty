import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>["db"];

/**
 * Crea una conexion por solicitud (requisito de Workers: no reutilizar conexiones entre solicitudes).
 * Usa el Pool por WebSocket de Neon porque soporta transacciones interactivas,
 * necesarias para confirmar citas de forma atomica.
 * Quien llama debe cerrar el pool al terminar (ver middleware en index.ts).
 */
export function createDb(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export { schema };
