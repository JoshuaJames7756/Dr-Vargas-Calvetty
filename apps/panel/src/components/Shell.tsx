import { UserButton } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { BellRing, CalendarDays, CalendarOff, Globe, Inbox, Sun, Users } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router";
import logo from "../assets/logo.png";
import { useApi } from "../lib/api";

const NAV = [
  { to: "/", label: "Hoy", icon: Sun, end: true },
  { to: "/solicitudes", label: "Solicitudes", icon: Inbox, end: false, badge: true },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, end: false },
  { to: "/recordatorios", label: "Recordatorios", icon: BellRing, end: false },
  { to: "/pacientes", label: "Pacientes", icon: Users, end: false },
  { to: "/disponibilidad", label: "Disponibilidad", icon: CalendarOff, end: false },
] as const;

export default function Shell() {
  const api = useApi();
  const reduce = useReducedMotion();
  const { pathname } = useLocation();
  const pending = useQuery({ queryKey: ["appointments", "pending"], queryFn: () => api.listAppointments({ status: "PENDING" }), refetchInterval: 60_000 });
  const count = pending.data?.length ?? 0;

  const link = (n: (typeof NAV)[number], mobile: boolean) => (
    <NavLink
      key={n.to}
      to={n.to}
      end={n.end}
      className={({ isActive }) =>
        mobile
          ? `relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${isActive ? "text-teal-800" : "text-ink-soft"}`
          : `flex min-h-12 items-center gap-3 rounded-xl px-4 font-semibold ${isActive ? "bg-teal-700 text-white" : "text-teal-100 hover:bg-teal-800"}`
      }
    >
      <n.icon aria-hidden size={mobile ? 22 : 20} />
      {n.label}
      {"badge" in n && count > 0 && (
        <span aria-label={`${count} pendientes`} className={`rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white ${mobile ? "absolute right-[22%] top-1.5" : "ml-auto"}`}>
          {count}
        </span>
      )}
    </NavLink>
  );

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[17rem_1fr]">
      <aside className="hidden bg-teal-900 p-5 text-teal-50 md:flex md:flex-col">
        <div className="flex items-center gap-3 px-2 py-3">
          <img src={logo} alt="" className="h-9 w-auto" />
          <div className="leading-tight">
            <p className="font-display text-lg text-white">Panel</p>
            <p className="text-xs text-teal-200">Dr. Vargas Calvetty</p>
          </div>
        </div>
        <nav aria-label="Principal" className="mt-6 flex flex-col gap-1">
          {NAV.map((n) => link(n, false))}
        </nav>
        <div className="mt-auto space-y-3 border-t border-teal-800 pt-4">
          <a href="/" className="flex min-h-12 items-center gap-3 rounded-xl px-4 font-semibold text-teal-100 transition-colors hover:bg-teal-800">
            <Globe aria-hidden size={20} /> Ver sitio web
          </a>
          <div className="flex items-center gap-3 px-4">
            <UserButton />
            <span className="text-sm text-teal-200">Tu cuenta</span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-cream px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-8 w-auto" />
            <span className="font-display text-lg text-teal-900">Panel</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-sm font-semibold text-teal-800">
              <Globe aria-hidden size={16} /> Sitio web
            </a>
            <UserButton />
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-6 sm:px-8 md:pb-12 md:pt-10">
          <motion.div key={pathname} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="mx-auto max-w-4xl">
            <Outlet />
          </motion.div>
        </main>

        <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-cream md:hidden">
          {NAV.map((n) => link(n, true))}
        </nav>
      </div>
    </div>
  );
}
