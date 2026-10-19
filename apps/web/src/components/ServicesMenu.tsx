import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { SERVICE_GROUPS } from "../data/services";

/**
 * Menu de servicios del encabezado (escritorio). "Servicios" sigue siendo un enlace normal a /servicios (funciona sin JavaScript);
 * la flecha y el cursor abren una ventana con las especialidades. Escape cierra, y al salir el foco tambien.
 */
export default function ServicesMenu({ base, current }: { base: string; current: boolean }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);
  // Si la persona hizo clic, el menu queda fijo y no se cierra al sacar el cursor.
  const pinned = useRef(false);

  const show = () => {
    window.clearTimeout(timer.current);
    setOpen(true);
  };
  const hideSoon = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (!pinned.current) setOpen(false);
    }, 160);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        pinned.current = false;
        setOpen(false);
        toggle.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) {
        pinned.current = false;
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className="static"
      onMouseEnter={show}
      onMouseLeave={hideSoon}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          pinned.current = false;
          setOpen(false);
        }
      }}
    >
      <div className="flex items-center gap-1">
        <a href={`${base}/servicios`} aria-current={current ? "page" : undefined} className="text-[0.95rem] font-medium text-ink-soft hover:text-teal-700">
          Servicios
        </a>
        <button
          ref={toggle}
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-label={open ? "Ocultar especialidades" : "Mostrar especialidades"}
          onClick={() => {
            pinned.current = !pinned.current;
            setOpen(pinned.current);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-teal-100 hover:text-teal-800"
        >
          <ChevronDown aria-hidden size={16} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute inset-x-0 top-full z-50 pt-2"
          >
            <div className="container-page">
              <div className="grid gap-8 rounded-3xl border border-line bg-white p-7 shadow-[0_24px_60px_-24px_rgb(10_63_66/0.35)] md:grid-cols-[1.4fr_1fr_1fr]">
                {SERVICE_GROUPS.map((g) => (
                  <div key={g.id}>
                    <a href={`${base}/servicios#${g.id}`} onClick={() => {
                        pinned.current = false;
                        setOpen(false);
                      }} className="font-display text-lg text-teal-900 hover:text-teal-700">
                      {g.title}
                    </a>
                    {g.items.length > 0 ? (
                      <ul className="mt-3 space-y-1.5">
                        {g.items.slice(0, 5).map((item) => (
                          <li key={item}>
                            <a href={`${base}/servicios#${g.id}`} onClick={() => {
                        pinned.current = false;
                        setOpen(false);
                      }} className="text-sm text-ink-soft hover:text-teal-700">
                              {item}
                            </a>
                          </li>
                        ))}
                        {g.items.length > 5 && (
                          <li>
                            <a href={`${base}/servicios#${g.id}`} onClick={() => {
                        pinned.current = false;
                        setOpen(false);
                      }} className="text-sm font-semibold text-teal-700">
                              y {g.items.length - 5} más
                            </a>
                          </li>
                        )}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-ink-soft">{g.intro}</p>
                    )}
                  </div>
                ))}
                <div className="md:col-span-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                  <a href={`${base}/servicios`} className="font-semibold text-teal-700 underline underline-offset-4">
                    Ver todos los servicios
                  </a>
                  <a href={`${base}/cita`} className="btn btn-primary !min-h-11 !py-2">
                    Solicitar cita
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
