import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { patientInputSchema, patientNoteSchema, patientSearchSchema } from "@dr-vargas/shared";
import type { AppEnv } from "../env";
import { requireRole } from "../middleware/auth";
import { addNote, createPatient, getPatient, listNotes, searchPatients, updatePatient } from "../modules/patients/service";

/** Rutas privadas (requireStaff se aplica al montar en index.ts). */
export const patientRoutes = new Hono<AppEnv>();

const idParam = zValidator("param", z.object({ id: z.string().uuid() }));

patientRoutes.get("/", zValidator("query", patientSearchSchema), async (c) => {
  return c.json(await searchPatients(c.get("db"), c.req.valid("query")));
});

patientRoutes.post("/", zValidator("json", patientInputSchema), async (c) => {
  const created = await createPatient(c.get("db"), c.req.valid("json"), c.get("staff").id);
  return c.json({ patient: created }, 201);
});

patientRoutes.get("/:id", idParam, async (c) => {
  return c.json(await getPatient(c.get("db"), c.req.valid("param").id));
});

patientRoutes.put("/:id", idParam, zValidator("json", patientInputSchema), async (c) => {
  const updated = await updatePatient(c.get("db"), c.req.valid("param").id, c.req.valid("json"), c.get("staff").id);
  return c.json({ patient: updated });
});

// Notas clinicas: SOLO el doctor. La asistente recibe 403 aunque conozca la ruta.
patientRoutes.get("/:id/notes", requireRole("doctor"), idParam, async (c) => {
  return c.json({ notes: await listNotes(c.get("db"), c.req.valid("param").id, c.get("staff").id) });
});

patientRoutes.post("/:id/notes", requireRole("doctor"), idParam, zValidator("json", patientNoteSchema), async (c) => {
  const note = await addNote(c.get("db"), c.req.valid("param").id, c.req.valid("json"), c.get("staff").id);
  return c.json({ note }, 201);
});
