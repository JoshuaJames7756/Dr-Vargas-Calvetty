import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, CalendarDays, Clock, Inbox } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router";
import logoLight from "../assets/logo-light.png";
import AppointmentCard from "../components/AppointmentCard";
import { Empty, ErrorState, Loading } from "../components/States";
import { useApi } from "../lib/api";
import { capitalize, dayRangeUtc, fmtDay, fmtTime, todayLocal } from "../lib/time";
import { useMe } from "../lib/useMe";

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat("es-BO", { hour: "numeric", hour12: false, timeZone: "America/La_Paz" }).format(new Date()));
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

export default function Today() {
  const api = useApi();
  const reduce = useReducedMotion();
  const me = useMe();
  const today = todayLocal();
  const { from, to } = dayRangeUtc(today);

  const agenda = useQuery({ queryKey: ["appointments", "today", today], queryFn: () => api.listAppointments({ status: "CONFIRMED", from, to }) });
  const pending = useQuery({ queryKey: ["appointments", "pending"], queryFn: () => api.listAppointments({ status: "PENDING" }) });

  const now = Date.now();
  const next = agenda.data?.find((a) => new Date(a.endsAt).getTime() > now);
  const todayCount = agenda.data?.length;
  const pendingCount = pending.data?.length;

  const title = me.data?.role === "doctor" ? "Bienvenido, doctor" : me.data ? `Hola, ${me.data.displayName.split(" ")[0]}` : "Bienvenido";
  const summary =
    todayCount === undefined || pendingCount === undefined
      ? "Preparando tu día…"
      : todayCount === 0 && pendingCount === 0
        ? "Hoy no tienes citas confirmadas ni solicitudes por revisar."
        : `${todayCount === 0 ? "Hoy no tienes citas confirmadas" : todayCount === 1 ? "Tienes 1 cita confirmada hoy" : `Tienes ${todayCount} citas confirmadas hoy`}${
            pendingCount > 0 ? ` y ${pendingCount} ${pendingCount === 1 ? "solicitud por revisar" : "solicitudes por revisar"}` : ""
          }.`;

  const tiles = [
    { icon: CalendarCheck, label: "Citas de hoy", value: todayCount === undefined ? "…" : String(todayCount), to: "/agenda", tone: "bg-teal-100 text-teal-800" },
    { icon: Inbox, label: "Por revisar", value: pendingCount === undefined ? "…" : String(pendingCount), to: "/solicitudes", tone: "bg-rose-100 text-rose-500" },
    { icon: Clock, label: "Próxima consulta", value: next ? fmtTime(next.startsAt) : "Sin más hoy", sub: next?.requesterName, to: "/agenda", tone: "bg-amber-100 text-amber-800" },
  ];

  const rise = (i: number) => (reduce ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay: i * 0.08 } });

  return (
    <div className="space-y-10">
      <motion.section {...rise(0)} aria-labelledby="bienvenida" className="on-dark relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 to-teal-700 p-7 text-teal-50 sm:p-9">
        <img src={logoLight} alt="" aria-hidden className="float-slow pointer-events-none absolute -right-8 -top-10 -z-10 w-64 max-w-none opacity-[0.1]" />
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-teal-200">
          {greeting()} · {capitalize(fmtDay(new Date().toISOString()))}
        </p>
        <h1 id="bienvenida" className="mt-2 text-3xl !text-white sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-xl text-lg text-teal-100">{summary}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/solicitudes" className="btn bg-white !text-teal-900 hover:!bg-teal-50">
            <Inbox aria-hidden size={18} /> Revisar solicitudes
          </Link>
          <Link to="/agenda" className="btn !border-white/60 !text-white hover:!bg-white/10" style={{ background: "transparent" }}>
            <CalendarDays aria-hidden size={18} /> Ver agenda
          </Link>
        </div>
      </motion.section>

      <ul className="grid gap-4 sm:grid-cols-3">
        {tiles.map((t, i) => (
          <motion.li key={t.label} {...rise(i + 1)}>
            <Link to={t.to} className="card card-link flex h-full items-center gap-4 p-4">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${t.tone}`}>
                <t.icon aria-hidden size={22} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-ink-soft">{t.label}</span>
                <span className="block font-display text-2xl leading-tight text-teal-900">{t.value}</span>
                {"sub" in t && t.sub && <span className="block truncate text-sm text-ink-soft">{t.sub}</span>}
              </span>
            </Link>
          </motion.li>
        ))}
      </ul>

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
