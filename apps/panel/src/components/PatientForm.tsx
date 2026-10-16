import { Loader2 } from "lucide-react";
import { useState } from "react";
import { patientInputSchema, type PatientInput } from "@dr-vargas/shared";
import type { PatientDto } from "../lib/api";

type Errors = Partial<Record<"fullName" | "phone" | "birthDate" | "email", string>>;

interface Props {
  initial?: PatientDto;
  submitLabel: string;
  busy: boolean;
  onSubmit: (value: PatientInput) => void;
  onCancel: () => void;
}

/** La validacion del navegador es comodidad; el servidor repite las mismas reglas (mismo esquema compartido). */
export default function PatientForm({ initial, submitLabel, busy, onSubmit, onCancel }: Props) {
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [errors, setErrors] = useState<Errors>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = patientInputSchema.safeParse({ fullName, phone, birthDate: birthDate || null, email: email || null });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Errors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };

  const field = (id: keyof Errors, label: string, input: React.ReactNode) => (
    <div>
      <label htmlFor={`pf-${id}`} className="block font-semibold">
        {label}
      </label>
      {input}
      {errors[id] && (
        <p id={`pf-${id}-err`} role="alert" className="mt-1 text-sm text-danger">
          {errors[id]}
        </p>
      )}
    </div>
  );
  const aria = (id: keyof Errors) => ({ id: `pf-${id}`, "aria-invalid": !!errors[id], "aria-describedby": errors[id] ? `pf-${id}-err` : undefined });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {field("fullName", "Nombre completo", <input {...aria("fullName")} className="field mt-1 w-full" autoComplete="off" value={fullName} onChange={(e) => setFullName(e.target.value)} />)}
      {field("phone", "Teléfono", <input {...aria("phone")} className="field mt-1 w-full" inputMode="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} />)}
      {field("birthDate", "Fecha de nacimiento (opcional)", <input {...aria("birthDate")} type="date" className="field mt-1 w-full" max={new Date().toISOString().slice(0, 10)} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />)}
      {field("email", "Correo (opcional)", <input {...aria("email")} type="email" className="field mt-1 w-full" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />)}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy && <Loader2 aria-hidden size={16} className="animate-spin" />} {submitLabel}
        </button>
      </div>
    </form>
  );
}
