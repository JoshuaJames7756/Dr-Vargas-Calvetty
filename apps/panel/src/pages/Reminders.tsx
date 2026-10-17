import PageHeader from "../components/PageHeader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, MessageCircle, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { patientWhatsappLink } from "@dr-vargas/shared";
import { Empty, ErrorState, Loading } from "../components/States";
import { ApiError, useApi, type AppointmentDto } from "../lib/api";
import { reminderProgress, reminderText } from "../lib/reminders";
import { addDays, capitalize, dayRangeUtc, fmtDay, fmtTime, todayLocal } from "../lib/time";

export default function Reminders() {
  const api = useApi();
  const today = todayLocal();
  const [date, setDate] = useState(() => addDays(today, 1));
  const { from, to } = dayRangeUtc(date);

  const q = useQuery({
    queryKey: ["appointments", "reminders", date],
    queryFn: () => api.listAppointments({ status: "CONFIRMED", from, to }),
  });
  const progress = q.data ? reminderProgress(q.data) : null;
  const quick = [
    { label: "Hoy", value: today },
    { label: "Mañana", value: addDays(today, 1) },
    { label: "Pasado mañana", value: addDays(today, 2) },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Recordatorios" description="Avisa a cada paciente por WhatsApp un día antes. El botón abre WhatsApp con el mensaje escrito; tú decides si lo envías. Después marca la cita como recordada para no repetir ni olvidar a nadie." />

      <section aria-labelledby="h-day" className="space-y-3">
        <h2 id="h-day" className="text-xl">
          ¿Qué día?
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {quick.map((o) => (
            <button key={o.label} type="button" className={`btn ${date === o.value ? "btn-primary" : "btn-outline"}`} aria-pressed={date === o.value} onClick={() => setDate(o.value)}>
              {o.label}
            </button>
          ))}
          <label className="sr-only" htmlFor="rem-date">
            Otra fecha
          </label>
          <input id="rem-date" type="date" className="field w-auto" value={date} min={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
        <p className="text-lg font-semibold">{capitalize(fmtDay(`${date}T12:00:00-04:00`))}</p>
        {progress && progress.total > 0 && (
          <p aria-live="polite" className="text-ink-soft">
            {progress.done} de {progress.total} recordadas
          </p>
        )}
      </section>

      <section aria-label="Citas del día" className="space-y-3">
        {q.isLoading && <Loading />}
        {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
        {q.data?.length === 0 && <Empty title="No hay citas confirmadas ese día">Cuando confirmes citas para esta fecha, aparecerán aquí para recordarlas.</Empty>}
        {q.data?.map((a) => <ReminderRow key={a.id} appt={a} />)}
      </section>
    </div>
  );
}

function ReminderRow({ appt }: { appt: AppointmentDto }) {
  const api = useApi();
  const qc = useQueryClient();
  const sent = !!appt.reminderSentAt;
  const mark = useMutation({
    mutationFn: (value: boolean) => api.setReminder(appt.id, value),
    onSuccess: (_d, value) => {
      toast.success(value ? "Marcada como recordada" : "Recordatorio desmarcado");
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "No se pudo guardar. Inténtalo de nuevo.");
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });

  return (
    <article className="card flex flex-wrap items-center justify-between gap-3 p-4" aria-label={`${appt.requesterName}, ${fmtTime(appt.startsAt)}`}>
      <div>
        <p className="font-display text-xl text-teal-900">{fmtTime(appt.startsAt)}</p>
        <p className="text-lg font-semibold">{appt.requesterName}</p>
        <p className="text-ink-soft">{appt.serviceName}</p>
        <p className={`mt-1 text-sm font-semibold ${sent ? "text-teal-700" : "text-amber-800"}`}>
          {sent ? `Recordada (${fmtDay(appt.reminderSentAt!)} ${fmtTime(appt.reminderSentAt!)})` : "Sin recordar"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a className="btn btn-whatsapp" href={patientWhatsappLink(appt.requesterPhone, reminderText(appt))} target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden size={16} /> {sent ? "Abrir de nuevo" : "Recordar por WhatsApp"}
          <span className="sr-only"> (abre WhatsApp, no envía el mensaje)</span>
        </a>
        {sent ? (
          <button type="button" className="btn btn-outline" disabled={mark.isPending} onClick={() => mark.mutate(false)}>
            {mark.isPending ? <Loader2 aria-hidden size={16} className="animate-spin" /> : <Undo2 aria-hidden size={16} />} Desmarcar
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={mark.isPending} onClick={() => mark.mutate(true)}>
            {mark.isPending ? <Loader2 aria-hidden size={16} className="animate-spin" /> : <Check aria-hidden size={16} />} Ya lo envié
          </button>
        )}
      </div>
    </article>
  );
}
