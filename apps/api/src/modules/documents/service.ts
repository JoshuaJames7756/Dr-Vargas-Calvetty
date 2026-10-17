import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MAX_PER_PATIENT,
  DOCUMENT_STORAGE_SOFT_LIMIT_BYTES,
  safeFileName,
  sniffDocumentType,
} from "@dr-vargas/shared";
import type { Db } from "../../db/client";
import { patientDocumentFiles, patientDocuments, patients } from "../../db/schema";
import { audit } from "../../lib/audit";
import { AppError, badRequest, conflict, notFound } from "../../lib/errors";

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const mb = (n: number) => (n / (1024 * 1024)).toFixed(0);

/** Solo metadatos. Nunca lee el contenido de los archivos. */
export async function listDocuments(db: Db, patientId: string) {
  const [p] = await db.select({ id: patients.id }).from(patients).where(eq(patients.id, patientId)).limit(1);
  if (!p) throw notFound("Paciente no encontrado");

  return db
    .select({
      id: patientDocuments.id,
      title: patientDocuments.title,
      fileName: patientDocuments.fileName,
      mimeType: patientDocuments.mimeType,
      sizeBytes: patientDocuments.sizeBytes,
      createdAt: patientDocuments.createdAt,
    })
    .from(patientDocuments)
    .where(and(eq(patientDocuments.patientId, patientId), isNull(patientDocuments.deletedAt)))
    .orderBy(desc(patientDocuments.createdAt))
    .limit(DOCUMENT_MAX_PER_PATIENT);
}

export interface UploadInput {
  title: string;
  fileName: string;
  bytes: Uint8Array;
}

export async function uploadDocument(db: Db, patientId: string, input: UploadInput, actorStaffId: string) {
  if (input.bytes.byteLength === 0) throw badRequest("EMPTY_FILE", "El archivo está vacío.");
  if (input.bytes.byteLength > DOCUMENT_MAX_BYTES) {
    throw new AppError(413, "FILE_TOO_LARGE", `El archivo pesa más de ${mb(DOCUMENT_MAX_BYTES)} MB. Reduce su tamaño e inténtalo de nuevo.`);
  }
  // El tipo se decide por el contenido real, no por lo que declare el navegador.
  const mimeType = sniffDocumentType(input.bytes);
  if (!mimeType) throw new AppError(415, "UNSUPPORTED_TYPE", "Solo se aceptan PDF, JPG, PNG o WEBP.");

  const sha256 = await sha256Hex(input.bytes);

  return db.transaction(async (tx) => {
    const [p] = await tx.select({ id: patients.id }).from(patients).where(eq(patients.id, patientId)).limit(1);
    if (!p) throw notFound("Paciente no encontrado");

    const [{ count = 0, mine = 0 } = {}] = await tx
      .select({
        count: sql<number>`coalesce(sum(${patientDocuments.sizeBytes}), 0)::bigint`.mapWith(Number),
        mine: sql<number>`count(*) filter (where ${patientDocuments.patientId} = ${patientId} and ${patientDocuments.deletedAt} is null)`.mapWith(Number),
      })
      .from(patientDocuments);

    if (count + input.bytes.byteLength > DOCUMENT_STORAGE_SOFT_LIMIT_BYTES) {
      throw new AppError(507, "STORAGE_FULL", "El almacenamiento de documentos está casi lleno. Avisa a Xion Technology para ampliarlo antes de subir más.");
    }
    if (mine >= DOCUMENT_MAX_PER_PATIENT) {
      throw conflict("TOO_MANY_DOCUMENTS", `Este paciente ya tiene ${DOCUMENT_MAX_PER_PATIENT} documentos.`);
    }

    const [dup] = await tx
      .select({ id: patientDocuments.id })
      .from(patientDocuments)
      .where(and(eq(patientDocuments.patientId, patientId), eq(patientDocuments.sha256, sha256), isNull(patientDocuments.deletedAt)))
      .limit(1);
    if (dup) throw conflict("DUPLICATE_DOCUMENT", "Este archivo ya está subido en la ficha de este paciente.");

    const [doc] = await tx
      .insert(patientDocuments)
      .values({
        patientId,
        uploadedByStaffId: actorStaffId,
        title: input.title,
        fileName: safeFileName(input.fileName),
        mimeType,
        sizeBytes: input.bytes.byteLength,
        sha256,
      })
      .returning({ id: patientDocuments.id, createdAt: patientDocuments.createdAt });
    if (!doc) throw new Error("No se pudo guardar el documento");

    await tx.insert(patientDocumentFiles).values({ documentId: doc.id, content: input.bytes });

    await audit(tx, {
      actorType: "staff",
      actorId: actorStaffId,
      action: "patient.document.uploaded",
      entityType: "patient",
      entityId: patientId,
      // Sin titulo ni nombre de archivo: pueden revelar el contenido clinico.
      metadata: { documentId: doc.id, sizeBytes: input.bytes.byteLength, mimeType },
    });
    return { id: doc.id, createdAt: doc.createdAt };
  });
}

/** Entrega el archivo. SIEMPRE deja constancia de quien lo abrio. */
export async function readDocument(db: Db, documentId: string, actorStaffId: string) {
  const [row] = await db
    .select({
      patientId: patientDocuments.patientId,
      fileName: patientDocuments.fileName,
      mimeType: patientDocuments.mimeType,
      sizeBytes: patientDocuments.sizeBytes,
      content: patientDocumentFiles.content,
    })
    .from(patientDocuments)
    .innerJoin(patientDocumentFiles, eq(patientDocumentFiles.documentId, patientDocuments.id))
    .where(and(eq(patientDocuments.id, documentId), isNull(patientDocuments.deletedAt)))
    .limit(1);
  if (!row) throw notFound("Documento no encontrado");

  await audit(db, {
    actorType: "staff",
    actorId: actorStaffId,
    action: "patient.document.downloaded",
    entityType: "patient",
    entityId: row.patientId,
    metadata: { documentId },
  });
  return row;
}

/** "Eliminar" oculta el documento; la copia se conserva y el hecho queda en la auditoria. */
export async function deleteDocument(db: Db, documentId: string, actorStaffId: string) {
  return db.transaction(async (tx) => {
    const [doc] = await tx
      .select({ patientId: patientDocuments.patientId, deletedAt: patientDocuments.deletedAt })
      .from(patientDocuments)
      .where(eq(patientDocuments.id, documentId))
      .for("update")
      .limit(1);
    if (!doc || doc.deletedAt) throw notFound("Documento no encontrado");

    await tx.update(patientDocuments).set({ deletedAt: new Date(), deletedByStaffId: actorStaffId }).where(eq(patientDocuments.id, documentId));
    await audit(tx, {
      actorType: "staff",
      actorId: actorStaffId,
      action: "patient.document.deleted",
      entityType: "patient",
      entityId: doc.patientId,
      metadata: { documentId },
    });
  });
}
