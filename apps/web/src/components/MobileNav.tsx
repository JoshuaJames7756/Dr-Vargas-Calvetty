import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

interface Link {
  href: string;
  label: string;
}

/** Menu movil accesible: boton con aria-expanded, cierre con Escape y foco devuelto al boton. */
export default function MobileNav({ links, ctaHref }: { links: Link[]; ctaHref: string }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full text-teal-900 hover:bg-teal-100"
      >
        {open ? <X aria-hidden size={26} /> : <Menu aria-hidden size={26} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.nav
            id={panelId}
            aria-label="Menú principal"
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute inset-x-0 top-full border-b border-line bg-cream px-5 pb-6 pt-2 shadow-soft"
          >
            <ul className="flex flex-col">
              {links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-12 items-center border-b border-line text-lg font-medium text-ink"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            <a href={ctaHref} className="btn btn-primary mt-5 w-full">
              Solicitar cita
            </a>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}
