import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Dialogo modal nativo (<dialog>): foco atrapado, Escape cierra y es accesible para lectores de pantalla. */
export default function Dialog({ open, title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="dlg-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-2xl border border-line bg-white p-0 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.5)] backdrop:bg-teal-950/50"
    >
      {open && (
        <div className="p-6">
          <h2 id="dlg-title" className="text-2xl">
            {title}
          </h2>
          <div className="mt-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
