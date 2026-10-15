/**
 * Verifica contra una base REAL que las protecciones de la migracion funcionan.
 * Todo corre dentro de una transaccion que se revierte al final: no deja datos.
 *
 * Uso:  DATABASE_URL="postgresql://..." pnpm --filter @dr-vargas/api db:verify
 */
import { Pool } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL");

const pool = new Pool({ connectionString: url });
const client = await pool.connect();
let failed = 0;

function report(ok: boolean, name: string, extra = "") {
  console.log(`${ok ? "OK   " : "FALLA"} ${name}${extra ? ` (${extra})` : ""}`);
  if (!ok) failed++;
}

/** Ejecuta una sentencia dentro de un savepoint y devuelve el codigo de error de Postgres, o null si funciono. */
async function tryStmt(sql: string, params: unknown[] = []): Promise<string | null> {
  await client.query("SAVEPOINT s");
  try {
    await client.query(sql, params);
    await client.query("RELEASE SAVEPOINT s");
    return null;
  } catch (e) {
    await client.query("ROLLBACK TO SAVEPOINT s");
    return (e as { code?: string }).code ?? "desconocido";
  }
}

try {
  await client.query("BEGIN");

  const svc = await client.query("select id from services limit 1");
  if (!svc.rows[0]) throw new Error("No hay servicios. Ejecuta db:seed primero.");
  const serviceId = svc.rows[0].id as string;

  const ins = `insert into appointments (service_id, requester_name, requester_phone, starts_at, ends_at, status)
               values ($1, 'Prueba', '70000000', $2, $3, $4) returning id`;
  const A = ["2099-01-05T14:00:00Z", "2099-01-05T14:30:00Z"];
  const overlap = ["2099-01-05T14:15:00Z", "2099-01-05T14:45:00Z"];
  const adjacent = ["2099-01-05T14:30:00Z", "2099-01-05T15:00:00Z"];

  const first = await client.query(ins, [serviceId, A[0], A[1], "CONFIRMED"]);
  report(first.rowCount === 1, "Se puede crear una cita confirmada");

  report((await tryStmt(ins, [serviceId, overlap[0], overlap[1], "CONFIRMED"])) === "23P01", "Una segunda cita CONFIRMADA que se solapa es rechazada (23P01)");
  report((await tryStmt(ins, [serviceId, adjacent[0], adjacent[1], "CONFIRMED"])) === null, "Una cita confirmada pegada al final de otra es permitida");
  report((await tryStmt(ins, [serviceId, overlap[0], overlap[1], "PENDING"])) === null, "Una solicitud PENDIENTE en el mismo horario es permitida");
  report((await tryStmt(ins, [serviceId, A[1], A[0], "PENDING"])) === "23514", "Una cita que termina antes de empezar es rechazada (23514)");

  const apptId = first.rows[0].id as string;
  await client.query("insert into appointment_status_history (appointment_id, to_status) values ($1, 'CONFIRMED')", [apptId]);
  report((await tryStmt("update appointment_status_history set note = 'x' where appointment_id = $1", [apptId])) !== null, "El historial de estados no se puede modificar");
  report((await tryStmt("delete from appointment_status_history where appointment_id = $1", [apptId])) !== null, "El historial de estados no se puede borrar");
} finally {
  await client.query("ROLLBACK").catch(() => {});
  client.release();
  await pool.end();
}

console.log(failed === 0 ? "\nTodo correcto. No se guardo ningun dato de prueba." : `\n${failed} verificacion(es) fallaron.`);
process.exit(failed === 0 ? 0 : 1);
