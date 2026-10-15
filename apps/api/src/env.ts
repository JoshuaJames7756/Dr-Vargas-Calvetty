import type { Db } from "./db/client";

/** Bindings del Worker (variables y secretos). Los secretos NUNCA llegan al navegador. */
export interface Bindings {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  ALLOWED_ORIGIN: string;
  CLINIC_TIMEZONE: string;
  /** Recursos estaticos (sitio Astro + panel). Solo existe desplegado en Cloudflare. */
  ASSETS?: { fetch: (req: Request) => Promise<Response> };
}

export interface StaffContext {
  id: string;
  clerkUserId: string;
  role: "doctor" | "assistant";
  displayName: string;
}

export interface Variables {
  db: Db;
  staff: StaffContext;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
