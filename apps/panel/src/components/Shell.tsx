import { UserButton } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { BarChart3, BellRing, CalendarDays, CalendarOff, CalendarPlus, Globe, Inbox, Sun, Users, type LucideIcon } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router";
import logo from "../assets/logo.png";
import logoLight from "../assets/logo-light.png";
import { useApi } from "../lib/api";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: boolean;
}

// El menu lateral va por categorias; la barra inferior del movil usa la lista plana.
const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Consultorio",
    items: [
      { to: "/", label: "Hoy", icon: Sun, end: true },
      { to: "/solicitudes", label: "Solicitudes", icon: Inbox, badge: true },
      { to: "/agenda", label: "Agenda", icon: CalendarDays },
      { to: "/recordatorios", label: "Recordatorios", icon: BellRing },
      { to: "/resumen", label: "Resumen", icon: BarChart3 },
    ],
  },
  { label: "Pacientes", items: [{ to: "/pacientes", label: "Pacientes", icon: Users }] },
  { label: "Configuración", items: [{ to: "/disponibilidad", label: "Disponibilidad", icon: CalendarOff }] },
];
const FLAT = GROUPS.flatMap((g) => g.items);

const SITE_LINKS = [
  { href: "/", label: "Ver sitio web", icon: Globe },
  { href: "/cita/", label: "Página de citas", icon: CalendarPlus },
];

export default function Shell() {
  const api = useApi();
  const reduce = useReducedMotion();
  const { pathname } = useLocation();
  const pending = useQuery({ queryKey: ["appointments", "pending"], queryFn: () => api.listAppointments({ status: "PENDING" }), refetchInterval: 60_000 });
  const count = pending.data?.length ?? 0;

  const link = (n: NavItem, mobile: boolean) => (
    <NavLink
      key={n.to}
      to={n.to}
      end={n.end}
      className={({ isActive }) =>
        mobile
          ? `relative flex min-h-14 min-w-[4.6rem] flex-1 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold ${isActive ? "text-teal-800" : "text-ink-soft"}`
          : `group relative flex min-h-11 items-center gap-3 rounded-xl px-4 font-semibold transition-colors ${isActive ? "bg-teal-700 text-white shadow-[0_8px_20px_-10px_rgb(0_0_0/0.6)]" : "text-teal-100 hover:bg-teal-800/80"}`
      }
    >
      <n.icon aria-hidden size={mobile ? 22 : 19} />
      {n.label}
      {n.badge && count > 0 && (
        <span aria-label={`${count} pendientes`} className={`rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white ${mobile ? "absolute right-[22%] top-1.5" : "ml-auto"}`}>
          {count}
        </span>
      )}
    </NavLink>
  );

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[17.5rem_1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-b from-teal-900 to-teal-950 text-teal-50 md:sticky md:top-0 md:flex md:h-dvh md:flex-col">
        <img src={logoLight} alt="" aria-hidden className="float-slow pointer-events-none absolute -bottom-12 -right-16 w-64 max-w-none opacity-[0.07]" />
        <div className="relative flex flex-1 flex-col overflow-y-auto p-5">
          <div className="flex items-center gap-3 px-2 py-2">
            <img src={logo} alt="" className="h-9 w-auto" />
            <div className="leading-tight">
              <p className="font-display text-lg text-white">Panel</p>
              <p className="text-xs text-teal-200">Dr. Vargas Calvetty</p>
            </div>
          </div>

          <nav aria-label="Principal" className="mt-5 space-y-5">
            {GROUPS.map((g) => (
              <div key={g.label}>
                <p className="px-4 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-teal-300">{g.label}</p>
                <div className="mt-1.5 flex flex-col gap-1">{g.items.map((n) => link(n, false))}</div>
              </div>
            ))}
          </nav>

          <div className="mt-6">
            <p className="px-4 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-teal-300">Sitio web</p>
            <div className="mt-1.5 flex flex-col gap-1">
              {SITE_LINKS.map((s) => (
                <a key={s.href} href={s.href} className="flex min-h-11 items-center gap-3 rounded-xl px-4 font-semibold text-teal-100 transition-colors hover:bg-teal-800/80">
                  <s.icon aria-hidden size={19} /> {s.label}
                </a>
              ))}
            </div>
          </div>

          <div className="mt-auto flex items-center gap-3 border-t border-teal-800 px-4 pt-4">
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

        <main className="bg-dots flex-1 px-4 pb-28 pt-6 sm:px-8 md:pb-12 md:pt-10">
          <motion.div key={pathname} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="mx-auto max-w-4xl">
            <Outlet />
          </motion.div>
        </main>

        <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-line bg-cream md:hidden">
          {FLAT.map((n) => link(n, true))}
        </nav>
      </div>
    </div>
  );
}
