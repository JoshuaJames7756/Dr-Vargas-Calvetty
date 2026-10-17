import { z } from "zod";

/**
 * Documentos de pacientes (estudios, recetas). Se guardan en la base de datos, asi que se mantienen chicos:
 * el panel comprime las fotos antes de subirlas y el servidor vuelve a validar todo.
 */
export const DOCUMENT_MAX_BYTES = 2 * 1024 * 1024;
export const DOCUMENT_MAX_PER_PATIENT = 100;
/** Tope blando de almacenamiento total de documentos (el plan gratuito de Neon incluye 0,5 GB para toda la base). */
export const DOCUMENT_STORAGE_SOFT_LIMIT_BYTES = 350 * 1024 * 1024;
export const DOCUMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type DocumentMime = (typeof DOCUMENT_MIME_TYPES)[number];

export const documentTitleSchema = z.string().trim().min(1, "Escribe un título para el documento").max(120, "El título es demasiado largo");

/** Detecta el tipo REAL por los primeros bytes. El tipo que declara el navegador o la extension no son confiables. */
export function sniffDocumentType(bytes: Uint8Array): DocumentMime | null {
  const at = (i: number) => bytes[i] ?? -1;
  if (at(0) === 0x25 && at(1) === 0x50 && at(2) === 0x44 && at(3) === 0x46 && at(4) === 0x2d) return "application/pdf";
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47 && at(4) === 0x0d && at(5) === 0x0a && at(6) === 0x1a && at(7) === 0x0a) return "image/png";
  if (at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 && at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50) return "image/webp";
  return null;
}

/** Nombre de archivo seguro para mostrar y descargar: sin rutas, sin caracteres de control, con largo acotado. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>:*?|]/g, "").replace(/\s+/g, " ").trim();
  const limited = cleaned.length > 120 ? `${cleaned.slice(0, 100)}${cleaned.slice(cleaned.lastIndexOf(".")).slice(0, 15)}` : cleaned;
  return limited && limited !== "." && limited !== ".." ? limited : "documento";
}
