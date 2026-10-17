import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MessageCircle, Pencil } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { CLINIC, patientWhatsappLink } from "@dr-vargas/shared";
import Dialog from "../components/Dialog";
import PatientDocuments from "../components/PatientDocuments";
import PatientForm from "../components/PatientForm";
import { ErrorState, Loading } from "../components/States";
import StatusBadge from "../components/StatusBadge";
import { ApiError, useApi, type NoteDto } from "../lib/api";
import { useMe } from "../lib/useMe";
import { capitalize, fmtDay, fmtTime } from "../lib/time";

const age = (birth: string) => {
  const b = new Date(`${birth}T00:00:00Z`);
  const n = new Date();
  let a = n.getUTCFullYear() - b.getUTCFullYear();
  if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a--;
  return a;
};
const fmtBirth = (d: string) => new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const fmtStamp = (iso: string) => `${capitalize(fmtDay(iso))}, ${fmtTime(iso)}`;

export default function PatientDetail() {
  const { id = "" } = useParams();
  const api = useApi();
  const qc = useQueryClient();
  const me = useMe();
  const [editing, setEditing] = useState(false);

  const q = useQuery({ queryKey: ["patient", id], queryFn: () => api.getPatient(id), retry: 1 });

  const update = useMutation({
    mutationFn: (v: Parameters<typeof api.updatePatient>[1]) => api.updatePatient(id, v),
    onSuccess: () => {
      toast.success("Datos guardados");
      qc.invalidateQueries({ queryKey: ["patient", id] });
      qc.invalidateQueries({ queryKey: ["patients"] });
      setEditing(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "No se pudieron guardar los datos."),
  });

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const { patient, appointments } = q.data;

  return (
    <div className="space-y-8">
      <div>
        <Link to="/pacientes" className="inline-flex items-center gap-1 text-teal-800 underline-offset-4 hover:underline">
          <ArrowLeft aria-hidden size={16} /> Pacientes
        </Link>
        <h1 className="mt-2 text-3xl sm:text-4xl">{patient.fullName}</h1>
      </div>

      <section aria-labelledby="datos" className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="datos" className="text-xl">
            Datos
          </h2>
          <button type="button" className="btn btn-outline" onClick={() => setEditing(true)}>
            <Pencil aria-hidden size={16} /> Editar
          </button>
        </div>
        <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink-soft">Teléfono</dt>
            <dd className="font-semibold">{patient.phone}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">Fecha de nacimiento</dt>
            <dd className="font-semibold">{patient.birthDate ? `${fmtBirth(patient.birthDate)} (${age(patient.birthDate)} años)` : "Sin registrar"}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">Correo</dt>
            <dd className="font-semibold">{patient.email ?? "Sin registrar"}</dd>
          </div>
        </dl>
        <a
          className="btn btn-whatsapp mt-4"
          href={patientWhatsappLink(patient.phone, `Hola ${patient.fullName}, le escribimos del consultorio del ${CLINIC.doctorName}.`)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle aria-hidden size={16} /> WhatsApp
          <span className="sr-only"> (abre WhatsApp, no envía el mensaje)</span>
        </a>
      </section>

      <section aria-labelledby="citas">
        <h2 id="citas" className="text-xl">
          Citas
        </h2>
        {appointments.length === 0 ? (
          <p className="mt-2 text-ink-soft">Este paciente todavía no tiene citas vinculadas.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {appointments.map((a) => (
              <li key={a.id} className="card flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="font-semibold">{fmtStamp(a.startsAt)}</p>
                  <p className="text-sm text-ink-soft">
                    {a.serviceName}
                    {a.reason ? ` · ${a.reason}` : ""}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {me.data?.role === "doctor" ? (
        <>
          <Notes patientId={id} />
          <PatientDocuments patientId={id} />
        </>
      ) : (
        me.data && <p className="rounded-lg bg-teal-50 p-3 text-ink-soft">Las notas clínicas y los documentos solo los ve el doctor.</p>
      )}

      <Dialog open={editing} title="Editar datos" onClose={() => setEditing(false)}>
        <PatientForm initial={patient} submitLabel="Guardar" busy={update.isPending} onSubmit={(v) => update.mutate(v)} onCancel={() => setEditing(false)} />
      </Dialog>
    </div>
  );
}

function Notes({ patientId }: { patientId: string }) {
  const api = useApi();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [amending, setAmending] = useState<NoteDto | null>(null);
  const [amendText, setAmendText] = useState("");

  const notes = useQuery({ queryKey: ["notes", patientId], queryFn: () => api.listNotes(patientId), retry: 1 });

  const save = useMutation({
    mutationFn: (v: { body: string; amendsId?: string }) => api.addNote(patientId, v.body, v.amendsId),
    onSuccess: (_d, v) => {
      toast.success(v.amendsId ? "Corrección guardada" : "Nota guardada");
      qc.invalidateQueries({ queryKey: ["notes", patientId] });
      if (v.amendsId) setAmending(null);
      else setText("");
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "No se pudo guardar la nota.");
      qc.invalidateQueries({ queryKey: ["notes", patientId] });
    },
  });

  return (
    <section aria-labelledby="notas">
      <h2 id="notas" className="text-xl">
        Notas clínicas
      </h2>
      <p className="mt-1 text-sm text-ink-soft">Solo las ve el doctor. Cada vez que se abren queda registro. No se pueden borrar ni editar: una corrección crea una versión nueva y conserva la anterior.</p>

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) save.mutate({ body: text.trim() });
        }}
      >
        <label htmlFor="nota-nueva" className="block font-semibold">
          Nueva nota
        </label>
        <textarea id="nota-nueva" className="field mt-1 min-h-28 w-full" maxLength={10_000} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="mt-2 flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={save.isPending || !text.trim()}>
            {save.isPending && !save.variables?.amendsId && <Loader2 aria-hidden size={16} className="animate-spin" />} Guardar nota
          </button>
        </div>
      </form>

      <div className="mt-4 space-y-3" aria-live="polite">
        {notes.isLoading && <Loading />}
        {notes.error && <ErrorState error={notes.error} onRetry={() => notes.refetch()} />}
        {notes.data?.length === 0 && <p className="text-ink-soft">Todavía no hay notas.</p>}
        {notes.data?.map((n) => (
          <article key={n.id} className={`card p-4 ${n.superseded ? "opacity-70" : ""}`}>
            <p className="text-sm text-ink-soft">
              {fmtStamp(n.createdAt)} · {n.authorName}
              {n.amendsId && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">Corrección</span>}
              {n.superseded && <span className="ml-2 rounded-full bg-sand px-2 py-0.5 text-xs font-bold text-ink-soft">Reemplazada por una corrección</span>}
            </p>
            <p className="mt-2 whitespace-pre-wrap">{n.body}</p>
            {!n.superseded && (
              <button
                type="button"
                className="btn btn-outline mt-3"
                onClick={() => {
                  setAmending(n);
                  setAmendText(n.body);
                }}
              >
                Corregir
              </button>
            )}
          </article>
        ))}
      </div>

      <Dialog open={!!amending} title="Corregir nota" onClose={() => setAmending(null)}>
        <p className="text-ink-soft">La nota original se conserva. Se guardará una nueva versión.</p>
        <label htmlFor="nota-corr" className="mt-3 block font-semibold">
          Texto corregido
        </label>
        <textarea id="nota-corr" className="field mt-1 min-h-32 w-full" maxLength={10_000} value={amendText} onChange={(e) => setAmendText(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn btn-outline" onClick={() => setAmending(null)}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={save.isPending || !amendText.trim() || amendText.trim() === amending?.body}
            onClick={() => amending && save.mutate({ body: amendText.trim(), amendsId: amending.id })}
          >
            {save.isPending && <Loader2 aria-hidden size={16} className="animate-spin" />} Guardar corrección
          </button>
        </div>
      </Dialog>
    </section>
  );
}
