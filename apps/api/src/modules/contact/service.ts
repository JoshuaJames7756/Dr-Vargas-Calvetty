import { and, count, eq, gte } from "drizzle-orm";
import { contactMessages } from "../../db/schema";
import type { Db } from "../../db/client";
import { audit } from "../../lib/audit";
import { AppError } from "../../lib/errors";

/** Tope por telefono y por hora: frena el envio masivo aunque pase la verificacion humana. */
export const MAX_CONTACT_PER_PHONE_HOUR = 3;

export async function createContactMessage(db: Db, input: { fullName: string; phone: string; message: string }, now = new Date()) {
  const since = new Date(now.getTime() - 60 * 60_000);
  const [{ recent } = { recent: 0 }] = await db
    .select({ recent: count() })
    .from(contactMessages)
    .where(and(eq(contactMessages.phone, input.phone), gte(contactMessages.createdAt, since)));
  if (recent >= MAX_CONTACT_PER_PHONE_HOUR) {
    throw new AppError(429, "TOO_MANY_MESSAGES", "Ya recibimos varios mensajes tuyos. Espera un momento o escríbenos por WhatsApp.");
  }
  const [row] = await db
    .insert(contactMessages)
    .values({ fullName: input.fullName, phone: input.phone, message: input.message })
    .returning({ id: contactMessages.id });
  await audit(db, { actorType: "public", action: "contact.received", entityType: "contact_message", entityId: row?.id });
  return row;
}
