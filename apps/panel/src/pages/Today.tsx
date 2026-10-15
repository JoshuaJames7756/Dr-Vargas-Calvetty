import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import AppointmentCard from "../components/AppointmentCard";
import { Empty, ErrorState, Loading } from "../components/States";
import { useApi } from "../lib/api";
import { capitalize, dayRangeUtc, fmtDay, fmtTime, todayLocal } from "../lib/time";

export default function Today() {
  const api = useApi();
  const today = todayLocal();
  const { from, to } = dayRangeUtc(today);

  const agenda = useQuery({ queryKey: ["appointments", "today", today], queryFn: () => api.listAppointments({ status: "CONFIRMED", from, to }) });
  const pending = useQuery({ queryKey: ["appointments", "pending"], queryFn: () => api.listAppointments({ status: "PENDING" }) });

  const now = Date.now();
  const next = agenda.data?.find((a) => new Date(a.endsAt).getTime() > now);

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-teal-700">{capitalize(fmtDay(new Date().toISOString()))}</p>
        <h1 className="mt-1 text-3xl sm:text-4xl">Hoy</h1>
        {next && (
          <p className="mt-2 text-lg text-ink-soft">
            Próxima consulta: <strong className="text-ink">{next.requesterName}</strong> a las {fmtTime(next.startsAt)}.
          </p>
        )}
      </header>

      <section aria-labelledby="h-pend">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="h-pend" className="text-2xl">
            Solicitudes por revisar{pending.data ? ` (${pending.data.length})` : ""}
          </h2>
          {pending.data && pending.data.length > 3 && (
            <Link className="font-semibold text-teal-700 underline underline-offset-4" to="/solicitudes">
              Ver todas
            </Link>
          )}
        </div>
        <div className="mt-4 space-y-3">
          {pending.isLoading && <Loading />}
          {pending.error && <ErrorState error={pending.error} onRetry={() => pending.refetch()} />}
          {pending.data?.length === 0 && <Empty title="No hay solicitudes pendientes">Cuando una paciente solicite una cita, aparecerá aquí.</Empty>}
          {pending.data?.slice(0, 3).map((a) => <AppointmentCard key={a.id} appt={a} showDay />)}
        </div>
      </section>

      <section aria-labelledby="h-agenda">
        <h2 id="h-agenda" className="text-2xl">
          Agenda de hoy
        </h2>
        <div className="mt-4 space-y-3">
          {agenda.isLoading && <Loading />}
          {agenda.error && <ErrorState error={agenda.error} onRetry={() => agenda.refetch()} />}
          {agenda.data?.length === 0 && <Empty title="No tienes citas confirmadas hoy" />}
          {agenda.data?.map((a) => <AppointmentCard key={a.id} appt={a} />)}
        </div>
      </section>
    </div>
  );
}
