import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Error esperado, con mensaje seguro para mostrar al usuario. */
export class AppError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (msg = "No encontrado") => new AppError(404, "NOT_FOUND", msg);
export const forbidden = (msg = "No tienes permiso para esta acción") => new AppError(403, "FORBIDDEN", msg);
export const unauthorized = (msg = "Sesión inválida o expirada") => new AppError(401, "UNAUTHORIZED", msg);
export const conflict = (code: string, msg: string) => new AppError(409, code, msg);
export const badRequest = (code: string, msg: string) => new AppError(400, code, msg);
