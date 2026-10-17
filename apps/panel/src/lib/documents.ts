import { DOCUMENT_MAX_BYTES, DOCUMENT_MIME_TYPES, type DocumentMime } from "@dr-vargas/shared";

export const DOCUMENT_ACCEPT = DOCUMENT_MIME_TYPES.join(",");

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const isImage = (t: string) => t.startsWith("image/");

/** Valida lo que se puede validar antes de subir. El servidor vuelve a comprobar todo por el contenido real. */
export function checkFile(file: { type: string; size: number; name: string }): string | null {
  if (!(DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type as DocumentMime)) {
    return "Solo se aceptan PDF, JPG, PNG o WEBP.";
  }
  if (file.size === 0) return "El archivo está vacío.";
  if (file.type === "application/pdf" && file.size > DOCUMENT_MAX_BYTES) {
    return `El PDF pesa ${formatBytes(file.size)} y el máximo es ${formatBytes(DOCUMENT_MAX_BYTES)}. Reduce su tamaño y vuelve a intentarlo.`;
  }
  return null;
}

/**
 * Las fotos de celular pesan varios MB. Se reducen en el navegador (lado mayor 1800 px, JPEG) antes de subir,
 * para que quepan en el limite y no gasten almacenamiento de mas. Los PDF no se tocan.
 */
export async function prepareFile(file: File): Promise<File> {
  if (!isImage(file.type) || (file.size <= 700 * 1024 && file.type !== "image/png")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
