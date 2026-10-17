import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { DOCUMENT_MAX_BYTES, documentTitleSchema } from "@dr-vargas/shared";
import type { AppEnv } from "../env";
import { AppError, badRequest } from "../lib/errors";
import { requireRole } from "../middleware/auth";
import { deleteDocument, listDocuments, readDocument, uploadDocument } from "../modules/documents/service";

const idParam = zValidator("param", z.object({ id: z.string().uuid() }));

/** Subir y listar, por paciente. SOLO el doctor (como las notas clinicas). */
export const patientDocumentRoutes = new Hono<AppEnv>();

patientDocumentRoutes.get("/:id/documents", requireRole("doctor"), idParam, async (c) => {
  return c.json({ documents: await listDocuments(c.get("db"), c.req.valid("param").id) });
});

patientDocumentRoutes.post("/:id/documents", requireRole("doctor"), idParam, async (c) => {
  // Se corta antes de leer el cuerpo si ya declara un tamano excesivo (el limite real se vuelve a comprobar en el servicio).
  const declared = Number(c.req.header("Content-Length") ?? "0");
  if (declared > DOCUMENT_MAX_BYTES + 64 * 1024) {
    throw new AppError(413, "FILE_TOO_LARGE", "El archivo es demasiado grande.");
  }

  let form: Record<string, string | File | (string | File)[]>;
  try {
    form = await c.req.parseBody();
  } catch {
    throw badRequest("BAD_FORM", "No se pudo leer el archivo enviado.");
  }
  const file = form.file;
  if (!(file instanceof File)) throw badRequest("NO_FILE", "Elige un archivo.");
  const title = documentTitleSchema.safeParse(typeof form.title === "string" ? form.title : "");
  if (!title.success) throw badRequest("BAD_TITLE", title.error.issues[0]?.message ?? "Título inválido");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const created = await uploadDocument(c.get("db"), c.req.valid("param").id, { title: title.data, fileName: file.name, bytes }, c.get("staff").id);
  return c.json({ document: created }, 201);
});

/** Descargar y eliminar, por id de documento. SOLO el doctor. */
export const documentRoutes = new Hono<AppEnv>();

documentRoutes.get("/:id/file", requireRole("doctor"), idParam, async (c) => {
  const doc = await readDocument(c.get("db"), c.req.valid("param").id, c.get("staff").id);
  return c.body(doc.content as unknown as ArrayBuffer, 200, {
    "Content-Type": doc.mimeType,
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
    "Content-Length": String(doc.sizeBytes),
    // Documentos clinicos: nunca en cache del navegador ni de intermediarios, y sin adivinar el tipo.
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
});

documentRoutes.delete("/:id", requireRole("doctor"), idParam, async (c) => {
  await deleteDocument(c.get("db"), c.req.valid("param").id, c.get("staff").id);
  return c.json({ ok: true });
});
