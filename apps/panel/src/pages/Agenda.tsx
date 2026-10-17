import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import PageHeader from "../components/PageHeader";
import AppointmentCard from "../components/AppointmentCard";
import { Empty, ErrorState, Loading } from "../components/States";
import { useApi, type AppointmentDto } from "../lib/api";
import { addDays, capitalize, dayRangeUtc, fmtDay, localDate, todayLocal } from "../lib/time";

const RANGES = [
  { days: 7, label: "7 días" },
  { days: 14, label: "14 días" },
  { days: 30, label: "30 días" },
] as const;

export default function Agenda() {
  const api = useApi();
  const [start, setStart] = useState(todayLocal());
  const [days, setDays] = useState<number>(7);
  const { from, to } = dayRangeUtc(start, days);

  const q = useQuery({ queryKey: ["appointments", "agenda", start, days], queryFn: () => api.listAppointments({ from, to }) });

  // Las canceladas y rechazadas no ocupan agenda; se ocultan por defecto.
  const visible = (q.data ?? []).filter((a) => a.status !== "REJECTED" && a.status !== "CANCELLED" && a.status !== "RESCHEDULED");
  const byDay = visible.reduce<Record<string, AppointmentDto[]>>((acc, a) => ((acc[localDate(a.startsAt)] ??= []).push(a), acc), {});

  return (
    <div>
      <PageHeader title="Agenda" description="Citas confirmadas y pendientes del rango elegido. Las canceladas y rechazadas no se muestran." />
      <div className="card mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <button type="button" className="btn btn-outline" aria-label={`Anterior, ${days} días atrás`} onClick={() => setStart(addDays(start, -days))}>
            <ChevronLeft aria-hidden size={18} /> Anterior
          </button>
          <div>
            <label htmlFor="ag-start" className="block text-sm font-semibold">
              Desde
            </label>
            <input id="ag-start" type="date" className="field" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
          </div>
          <button type="button" className="btn btn-outline" aria-label={`Siguiente, ${days} días adelante`} onClick={() => setStart(addDays(start, days))}>
            Siguiente <ChevronRight aria-hidden size={18} />
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setStart(todayLocal())} disabled={start === todayLocal()}>
            Hoy
          </button>
        </div>
        <div role="group" aria-label="Rango" className="inline-flex rounded-full bg-teal-50 p-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              aria-pressed={days === r.days}
              onClick={() => setDays(r.days)}
              className={`min-h-10 rounded-full px-4 text-sm font-semibold transition-colors ${days === r.days ? "bg-teal-700 text-white" : "text-teal-800 hover:bg-teal-100"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-8">
        {q.isLoading && <Loading />}
        {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
        {q.data && Object.keys(byDay).length === 0 && <Empty title="Sin citas en este rango" />}
        {Object.entries(byDay).map(([date, list]) => (
          <section key={date} aria-labelledby={`d-${date}`}>
            <h2 id={`d-${date}`} className="text-xl">
              {capitalize(fmtDay(list[0]!.startsAt))}
            </h2>
            <div className="mt-3 space-y-3">{list.map((a) => <AppointmentCard key={a.id} appt={a} />)}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
