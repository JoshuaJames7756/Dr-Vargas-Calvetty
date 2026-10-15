import { verifyToken } from "@clerk/backend";
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { staffUsers } from "../db/schema";
import type { AppEnv } from "../env";
import { forbidden, unauthorized } from "../lib/errors";

/**
 * Autenticacion (Clerk verifica la identidad) + autorizacion (la tabla staff_users decide el rol).
 * Un usuario de Clerk sin fila activa en staff_users NO obtiene acceso, aunque inicie sesion.
 */
export const requireStaff = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw unauthorized();

  let clerkUserId: string;
  try {
    const payload = await verifyToken(token, {
      secretKey: c.env.CLERK_SECRET_KEY,
      authorizedParties: [c.env.ALLOWED_ORIGIN],
    });
    if (!payload.sub) throw unauthorized();
    clerkUserId = payload.sub;
  } catch {
    throw unauthorized();
  }

  const db = c.get("db");
  const [staff] = await db.select().from(staffUsers).where(eq(staffUsers.clerkUserId, clerkUserId)).limit(1);
  if (!staff || !staff.active) throw forbidden();

  c.set("staff", {
    id: staff.id,
    clerkUserId: staff.clerkUserId,
    role: staff.role,
    displayName: staff.displayName,
  });
  await next();
});

/** Restringe una ruta a ciertos roles. Siempre se comprueba en el servidor. */
export const requireRole = (...roles: Array<"doctor" | "assistant">) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!roles.includes(c.get("staff").role)) throw forbidden();
    await next();
  });
