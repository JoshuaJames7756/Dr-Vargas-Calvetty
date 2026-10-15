import type { Db } from "../db/client";
import { auditLog } from "../db/schema";

export interface AuditEntry {
  actorType: "staff" | "public" | "system";
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  /** Solo datos operativos. NUNCA diagnosticos, notas clinicas ni contenido de documentos. */
  metadata?: Record<string, unknown>;
}

// Acepta la conexion principal o una transaccion.
type Executor = Pick<Db, "insert">;

export async function audit(db: Executor, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    actorType: entry.actorType,
    actorId: entry.actorId ?? null,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    metadata: entry.metadata ?? null,
  });
}
