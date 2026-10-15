/**
 * Datos del consultorio. Fuente unica para web, panel y API.
 * Todo lo marcado PENDIENTE debe ser validado por el doctor antes de publicarse.
 */
export const CLINIC = {
  doctorName: "Dr. Rolando Vargas Calvetty",
  shortName: "Rolando Vargas Calvetty",
  specialties: ["Ginecólogo Oncólogo", "Mastólogo"],
  city: "Cochabamba",
  country: "Bolivia",
  timezone: "America/La_Paz",
  address: {
    line1: "Parque Fidel Anze N° 200, esq. Av. Pando",
    line2: "Edificio V&V NUR",
    // PENDIENTE: confirmar piso con el doctor (el brief indica "primer piso", la tarjeta no lo menciona).
    floor: "Primer piso",
    city: "Cochabamba, Bolivia",
  },
  phones: {
    whatsapp: "70344225",
    landlines: ["4011030", "4011040"],
  },
  // Codigo de pais de Bolivia para enlaces wa.me
  whatsappCountryCode: "591",
  social: {
    // PENDIENTE: enlace exacto de Facebook.
    facebook: null as string | null,
  },
} as const;

/** Enlace wa.me con mensaje prellenado. Abrirlo NO equivale a haber enviado el mensaje. */
export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${CLINIC.whatsappCountryCode}${CLINIC.phones.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/**
 * Enlace wa.me hacia el telefono de un paciente (accion del doctor desde el panel).
 * Abrirlo NO envia el mensaje: el doctor decide si lo envia.
 */
export function patientWhatsappLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, "");
  const full = digits.startsWith(CLINIC.whatsappCountryCode) && digits.length === 11 ? digits : `${CLINIC.whatsappCountryCode}${digits}`;
  const base = `https://wa.me/${full}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
