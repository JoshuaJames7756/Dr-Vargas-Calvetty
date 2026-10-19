import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import logo from "../assets/logo.png";
import logoLight from "../assets/logo-light.png";
import { ApiError } from "../lib/api";

export function Loading({ label = "Cargando…" }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 py-8 text-ink-soft">
      <Loader2 aria-hidden size={18} className="animate-spin" /> {label}
    </p>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span aria-hidden className="relative mb-1 flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-teal-100/80" />
        <img src={logo} alt="" className="float-slow relative h-10 w-auto" />
      </span>
      <p className="font-display text-xl text-teal-900">{title}</p>
      {children && <p className="max-w-md text-ink-soft">{children}</p>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const denied = error instanceof ApiError && error.status === 403;
  const expired = error instanceof ApiError && error.status === 401;
  const message = denied
    ? "Tu cuenta no tiene permiso para ver esto."
    : expired
      ? "Tu sesión expiró. Vuelve a iniciar sesión."
      : error instanceof ApiError
        ? error.message
        : "Ocurrió un error inesperado.";
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl bg-[#fde8e6] p-4 text-[#7a1810]">
      <AlertCircle aria-hidden className="mt-0.5 shrink-0" size={20} />
      <div>
        <p>{message}</p>
        {onRetry && !denied && (
          <button type="button" className="btn btn-danger mt-3" onClick={onRetry}>
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}

/** Pantalla de arranque a pagina completa (verificando acceso). */
export function Splash({ label = "Verificando tu acceso…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-teal-900 to-teal-950 px-6 text-teal-50">
      <img src={logoLight} alt="" aria-hidden className="float-slow pointer-events-none absolute -bottom-20 -right-24 w-[28rem] max-w-none opacity-[0.06]" />
      <img src={logoLight} alt="" aria-hidden className="splash-logo relative w-24" />
      <p className="relative mt-6 text-2xl font-semibold" style={{ fontFamily: "var(--font-display, inherit)" }}>Panel del consultorio</p>
      <p className="relative mt-1 text-sm text-teal-200">Dr. Vargas Calvetty</p>
      <div className="relative mt-8 h-1 w-48 overflow-hidden rounded-full bg-teal-800">
        <div className="splash-bar h-full w-1/3 rounded-full bg-teal-300" />
      </div>
      <p className="relative mt-4 text-sm text-teal-100">{label}</p>
    </div>
  );
}
