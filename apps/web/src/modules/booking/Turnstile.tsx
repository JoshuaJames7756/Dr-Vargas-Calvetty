import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY as string | undefined;

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar la verificación"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface Props {
  onToken: (token: string | null) => void;
  /** Cambiar este valor reinicia el widget (por ejemplo tras un intento fallido). */
  resetKey?: number;
}

/** Verificacion anti spam de Cloudflare Turnstile. El token se valida SIEMPRE en el servidor. */
export default function Turnstile({ onToken, resetKey = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          language: "es",
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch(() => onToken(null));
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  if (!SITE_KEY) {
    return (
      <p role="alert" className="rounded-lg border border-dashed border-rose-500 bg-rose-100 px-3 py-2 text-sm">
        <strong>Configuración pendiente:</strong> falta PUBLIC_TURNSTILE_SITE_KEY. El envío está deshabilitado hasta
        configurarla.
      </p>
    );
  }
  return <div ref={ref} role="group" aria-label="Verificación de seguridad" />;
}
