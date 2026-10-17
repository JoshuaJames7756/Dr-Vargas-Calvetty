import type { ReactNode } from "react";

/** Encabezado comun de cada pantalla: titulo, texto de apoyo y acciones alineadas a la derecha. */
export default function PageHeader({ title, eyebrow, description, actions, id }: { title: string; eyebrow?: string; description?: ReactNode; actions?: ReactNode; id?: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line pb-5">
      <div className="min-w-0">
        {eyebrow && <p className="text-sm font-semibold uppercase tracking-[0.12em] text-teal-700">{eyebrow}</p>}
        <h1 id={id} className="text-3xl sm:text-4xl">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-2xl text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
