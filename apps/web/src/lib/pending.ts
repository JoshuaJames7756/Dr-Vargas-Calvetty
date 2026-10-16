/**
 * Contenido de ejemplo o pendiente de validar por el doctor.
 * Solo se muestra mientras PUBLIC_SHOW_PENDING sea "true" (demostraciones y desarrollo).
 * En produccion NO se publica: ningun texto de relleno aparece sin ser real.
 */
export const SHOW_PENDING = (import.meta.env.PUBLIC_SHOW_PENDING ?? (import.meta.env.DEV ? "true" : "false")) === "true";
