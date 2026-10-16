import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, MessageCircle, Phone, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { CLINIC, patientWhatsappLink } from "@dr-vargas/shared";
import { ApiError, useApi, type AppointmentDto } from "../lib/api";
import { actionsFor, type ActionDef } from "../lib/actions";
import { addDays, capitalize, fmtDay, fmtTime, localDate, todayLocal } from "../lib/time";
import { useAppointmentActions } from "../lib/useAppointmentActions";
import Dialog from "./Dialog";
import StatusBadge from "./StatusBadge";

function whatsappText(a: AppointmentDto): string {
  if (a.status === "CONFIRMED") {
    return `Hola ${a.requesterName}, le confirmamos su cita de ${a.serviceName} con el ${CLINIC.doctorName} el ${fmtDay(a.startsAt)} a las ${fmtTime(a.startsAt)}. Consultorio: ${CLINIC.address.line1}, ${CLINIC.address.line2}. Si no puede asistir, por favor avísenos.`;
  }
  return `Hola ${a.requesterName}, le escribimos del consultorio del ${CLINIC.doctorName} sobre su solicitud de cita de ${a.serviceName}.`;
}

export default function AppointmentCard({ appt, showDay = false }: { appt: AppointmentDto; showDay?: boolean }) {
  const { changeStatus, reschedule } = useAppointmentActions();
  const [pending, setPending] = useState<ActionDef | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const busy = changeStatus.isPending || reschedule.isPending;
  const api = useApi();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const link = useMutation({
    mutationFn: () => api.linkAppointment(appt.id),
    onSuccess: (r) => {
      toast.success(r.created ? "Ficha de paciente creada" : "Cita vinculada a un paciente existente");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["patients"] });
      navigate(`/pacientes/${r.patientId}`);
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "No se pudo crear la ficha.");
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
  const canHavePatient = appt.status === "CONFIRMED" || appt.status === "COMPLETED";

  const run = (a: ActionDef) => {
    if (a.key === "reschedule") return setRescheduling(true);
    if (a.confirm) return setPending(a);
    changeStatus.mutate({ id: appt.id, to: a.to });
  };

  return (
    <article className="card p-4 sm:p-5" aria-label={`${appt.requesterName}, ${fmtTime(appt.startsAt)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl text-teal-900">
            {showDay && <span className="mr-2 text-base text-ink-soft">{capitalize(fmtDay(appt.startsAt))}</span>}
            {fmtTime(appt.startsAt)} <span className="text-base text-ink-soft">a {fmtTime(appt.endsAt)}</span>
          </p>
          <p className="mt-1 text-lg font-semibold">{appt.requesterName}</p>
          <p className="text-ink-soft">{appt.serviceName}</p>
          {appt.status === "CONFIRMED" && appt.reminderSentAt && (
            <p className="mt-1 text-sm font-semibold text-teal-700">Recordatorio enviado ({fmtDay(appt.reminderSentAt)} {fmtTime(appt.reminderSentAt)})</p>
          )}
        </div>
        <StatusBadge status={appt.status} />
      </div>

      {appt.reason && (
        <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm">
          <span className="font-semibold">Motivo: </span>
          {appt.reason}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a className="btn btn-outline" href={`tel:+591${appt.requesterPhone.replace(/\D/g, "").replace(/^591/, "")}`} aria-label={`Llamar a ${appt.requesterName}`}>
          <Phone aria-hidden size={16} /> {appt.requesterPhone}
        </a>
        <a className="btn btn-whatsapp" href={patientWhatsappLink(appt.requesterPhone, whatsappText(appt))} target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden size={16} /> {appt.status === "CONFIRMED" ? "Avisar por WhatsApp" : "WhatsApp"}
          <span className="sr-only"> (abre WhatsApp, no envía el mensaje)</span>
        </a>
        {canHavePatient &&
          (appt.patientId ? (
            <Link className="btn btn-outline" to={`/pacientes/${appt.patientId}`}>
              <UserRound aria-hidden size={16} /> Ver paciente
            </Link>
          ) : (
            <button type="button" className="btn btn-outline" disabled={link.isPending} onClick={() => link.mutate()}>
              {link.isPending ? <Loader2 aria-hidden size={16} className="animate-spin" /> : <UserRound aria-hidden size={16} />} Crear ficha
            </button>
          ))}
        {actionsFor(appt.status).map((a) => (
          <button key={a.key} type="button" className={`btn btn-${a.tone}`} disabled={busy} onClick={() => run(a)}>
            {busy && changeStatus.variables?.to === a.to ? <Loader2 aria-hidden size={16} className="animate-spin" /> : null}
            {a.label}
          </button>
        ))}
      </div>

      <Dialog open={!!pending} title={pending?.label ?? ""} onClose={() => setPending(null)}>
        <p>{pending?.confirm}</p>
        <p className="mt-2 text-ink-soft">
          {appt.requesterName}, {fmtDay(appt.startsAt)} {fmtTime(appt.startsAt)}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-outline" onClick={() => setPending(null)}>
            Volver
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              if (pending) changeStatus.mutate({ id: appt.id, to: pending.to });
              setPending(null);
            }}
          >
            Sí, {pending?.label.toLowerCase()}
          </button>
        </div>
      </Dialog>

      <RescheduleDialog
        open={rescheduling}
        appt={appt}
        onClose={() => setRescheduling(false)}
        onPick={(iso) => {
          reschedule.mutate({ id: appt.id, startsAt: iso });
          setRescheduling(false);
        }}
      />
    </article>
  );
}

function RescheduleDialog(props: { open: boolean; appt: AppointmentDto; onClose: () => void; onPick: (iso: string) => void }) {
  const api = useApi();
  const [date, setDate] = useState(() => addDays(todayLocal(), 1));
  const q = useQuery({
    queryKey: ["slots", props.appt.serviceId, date],
    queryFn: () => api.slots(props.appt.serviceId, date),
    enabled: props.open,
    retry: 1,
  });

  return (
    <Dialog open={props.open} title="Reagendar cita" onClose={props.onClose}>
      <p className="text-ink-soft">
        {props.appt.requesterName}, {props.appt.serviceName}. Actualmente: {fmtDay(props.appt.startsAt)} {fmtTime(props.appt.startsAt)}.
      </p>
      <label className="mt-4 block font-semibold" htmlFor="rs-date">
        Nueva fecha
      </label>
      <input id="rs-date" type="date" className="field mt-1" min={todayLocal()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />

      <div className="mt-4" aria-live="polite">
        {q.isLoading && (
          <p className="flex items-center gap-2 text-ink-soft">
            <Loader2 aria-hidden size={16} className="animate-spin" /> Buscando horarios…
          </p>
        )}
        {q.error && <p role="alert" className="text-danger">No se pudieron consultar los horarios.</p>}
        {q.data && q.data.length === 0 && <p className="rounded-lg bg-teal-50 p-3 text-ink-soft">No hay horarios libres ese día.</p>}
        {q.data && q.data.length > 0 && (
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Horarios libres">
            {q.data.map((s) => (
              <button
                key={s.startMinute}
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
                  props.onPick(new Date(Date.UTC(y, m - 1, d, 0, s.startMinute + 240)).toISOString());
                }}
              >
                <CalendarClock aria-hidden size={14} /> {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-6 flex justify-end">
        <button type="button" className="btn btn-outline" onClick={props.onClose}>
          Cerrar
        </button>
      </div>
    </Dialog>
  );
}

export { localDate };
