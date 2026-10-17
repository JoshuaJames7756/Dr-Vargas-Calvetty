import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { createDb } from "./db/client";
import type { AppEnv } from "./env";
import { AppError } from "./lib/errors";
import { requireStaff } from "./middleware/auth";
import { appointmentRoutes } from "./routes/appointments";
import { availabilityRoutes } from "./routes/availability";
import { documentRoutes, patientDocumentRoutes } from "./routes/documents";
import { patientRoutes } from "./routes/patients";
import { publicRoutes } from "./routes/public";

const app = new Hono<AppEnv>();

app.use("*", secureHeaders());

// CORS restrictivo: solo el origen configurado. En produccion el sitio y la API comparten origen.
app.use("/api/*", (c, next) =>
  cors({
    origin: c.env.ALLOWED_ORIGIN,
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  })(c, next),
);

// Una conexion de base de datos por solicitud; se cierra al terminar sin bloquear la respuesta.
app.use("/api/*", async (c, next) => {
  const { db, pool } = createDb(c.env.DATABASE_URL);
  c.set("db", db);
  try {
    await next();
  } finally {
    c.executionCtx.waitUntil(pool.end());
  }
});

app.get("/api/health", (c) => c.json({ ok: true }));

app.route("/api/public", publicRoutes);

app.get("/api/me", requireStaff, (c) => {
  const staff = c.get("staff");
  return c.json({ id: staff.id, displayName: staff.displayName, role: staff.role });
});

// Cada modulo privado se protege por prefijo. Las rutas desconocidas responden 404, no 401.
app.use("/api/appointments/*", requireStaff);
app.use("/api/appointments", requireStaff);
app.route("/api/appointments", appointmentRoutes);

app.use("/api/patients/*", requireStaff);
app.use("/api/patients", requireStaff);
app.route("/api/patients", patientRoutes);
app.route("/api/patients", patientDocumentRoutes);

app.use("/api/documents/*", requireStaff);
app.route("/api/documents", documentRoutes);

app.use("/api/availability/*", requireStaff);
app.use("/api/availability", requireStaff);
app.route("/api/availability", availabilityRoutes);

// Panel (SPA de React). Los archivos con extension se sirven tal cual; cualquier otra ruta (por ejemplo /panel/agenda)
// devuelve index.html para que React Router resuelva la pantalla. Los recursos /panel/assets/* no pasan por el Worker.
app.get("/panel/*", async (c) => {
  const assets = c.env.ASSETS;
  if (!assets) return c.json({ error: { code: "NOT_FOUND", message: "Ruta no encontrada" } }, 404);
  // Las respuestas de ASSETS tienen cabeceras de solo lectura: se copian antes de que secureHeaders agregue las suyas.
  const copy = (r: Response) => new Response(r.body, r);
  const res = await assets.fetch(c.req.raw);
  if (res.status !== 404 || /\.[a-z0-9]+$/i.test(c.req.path)) return copy(res);
  return copy(await assets.fetch(new Request(new URL("/panel/index.html", c.req.url))));
});

app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Ruta no encontrada" } }, 404));

// Errores: mensajes seguros para el usuario, sin trazas ni detalles internos.
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.status);
  }
  // HTTPException de Hono (por ejemplo, validacion) conserva su respuesta.
  if ("getResponse" in err && typeof err.getResponse === "function") {
    return err.getResponse() as Response;
  }
  console.error("Error no controlado", { path: c.req.path, name: err.name });
  return c.json({ error: { code: "INTERNAL", message: "Ocurrió un error inesperado. Inténtalo de nuevo." } }, 500);
});

export default app;
