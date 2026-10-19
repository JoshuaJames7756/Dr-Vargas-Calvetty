import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, ChevronLeft, ChevronRight, UserX, XCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import PageHeader from "../components/PageHeader";
import { Empty, ErrorState, Loading } from "../components/States";
import { useApi, type StatsDto } from "../lib/api";
import { addMonths, capitalize, fmtMonth, monthOf, monthRangeUtc, todayLocal } from "../lib/time";

function Tile({ icon, label, value, hint }: { icon: ReactNode; label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
        <span aria-hidden className="text-teal-700">{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-4xl font-semibold text-ink">{value}</p>
      {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
    </div>
  );
}

function Bars({ stats }: { stats: StatsDto }) {
  const max = Math.max(1, ...stats.byDay.map((d) => d.count));
  return (
    <div>
      <div className="flex h-40 items-end gap-1" aria-hidden>
        {stats.byDay.map((d) => (
          <div key={d.date} className="flex h-full max-w-8 flex-1 flex-col justify-end" title={`${d.date}: ${d.count}`}>
            <div className="rounded-t bg-teal-600" style={{ height: `${(d.count / max) * 100}%`, minHeight: 4 }} />
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Citas por día</caption>
        <thead><tr><th>Día</th><th>Citas</th></tr></thead>
        <tbody>{stats.byDay.map((d) => <tr key={d.date}><td>{d.date}</td><td>{d.count}</td></tr>)}</tbody>
      </table>
      <p className="mt-2 text-sm text-ink-soft">Cada barra es un día con citas. Día más cargado: {max} {max === 1 ? "cita" : "citas"}.</p>
    </div>
  );
}

export default function Stats() {
  const api = useApi();
  const [month, setMonth] = useState(monthOf(todayLocal()));
  const { from, to } = monthRangeUtc(month);
  const q = useQuery({ queryKey: ["appointments", "stats", month], queryFn: () => api.stats(from, to) });

  const s = q.data;
  const done = s?.byStatus.COMPLETED ?? 0;
  const noShow = s?.byStatus.NO_SHOW ?? 0;
  const closed = done + noShow;
  const attendance = closed > 0 ? Math.round((done / closed) * 100) : null;
  const cancelled = (s?.byStatus.CANCELLED ?? 0) + (s?.byStatus.REJECTED ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resumen"
        eyebrow="Consultorio"
        description="Cómo va el mes. Solo cuenta citas confirmadas, atendidas o con inasistencia."
        actions={
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mes anterior">
              <ChevronLeft aria-hidden size={18} />
            </button>
            <span className="min-w-36 text-center font-semibold" aria-live="polite">{capitalize(fmtMonth(month))}</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mes siguiente">
              <ChevronRight aria-hidden size={18} />
            </button>
          </div>
        }
      />

      {q.isLoading && <Loading label="Calculando el resumen…" />}
      {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {s && s.total === 0 && closed === 0 && cancelled === 0 && (
        <Empty title="Sin citas este mes">Cuando haya citas confirmadas o atendidas, aparecerán aquí.</Empty>
      )}
      {s && (s.total > 0 || closed > 0 || cancelled > 0) && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile icon={<CalendarCheck size={18} />} label="Citas del mes" value={s.total} hint="Confirmadas y cerradas" />
            <Tile icon={<CalendarCheck size={18} />} label="Atendidas" value={done} hint={attendance === null ? "Aún sin citas cerradas" : `Asistencia ${attendance}%`} />
            <Tile icon={<UserX size={18} />} label="No asistieron" value={noShow} hint="Inasistencias" />
            <Tile icon={<XCircle size={18} />} label="Canceladas" value={cancelled} hint="Incluye rechazadas" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-5" aria-labelledby="por-servicio">
              <h2 id="por-servicio" className="text-xl">Por servicio</h2>
              {s.byService.length === 0 ? (
                <p className="mt-3 text-ink-soft">Sin datos.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {s.byService.map((r) => (
                    <li key={r.name}>
                      <div className="flex justify-between text-sm"><span>{r.name}</span><span className="font-semibold">{r.count}</span></div>
                      <div className="mt-1 h-2 rounded-full bg-teal-50">
                        <div className="h-2 rounded-full bg-teal-600" style={{ width: `${(r.count / Math.max(1, s.byService[0]!.count)) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="card p-5" aria-labelledby="por-dia">
              <h2 id="por-dia" className="text-xl">Por día</h2>
              <div className="mt-4">{s.byDay.length === 0 ? <p className="text-ink-soft">Sin datos.</p> : <Bars stats={s} />}</div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
