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
    floor: "Primer piso",
    city: "Cochabamba, Bolivia",
  },
  phones: {
    whatsapp: "70344225",
    landlines: ["4011030", "4011040"],
  },
  // Codigo de pais de Bolivia para enlaces wa.me
  whatsappCountryCode: "591",
  /**
   * Horario de atencion mostrado en el sitio. Dato provisional dado por Xion para la demostracion:
   * el doctor debe confirmarlo. Los horarios reales para pedir cita salen de la agenda (panel, Disponibilidad).
   */
  hours: {
    label: "Lunes a viernes, de 14:00 a 18:00",
  },
  /** Ubicacion real (enlace de Google Maps del consultorio, "V&V NUR"). */
  maps: {
    lat: -17.3715105,
    lng: -66.1511622,
    url: "https://maps.app.goo.gl/jVbbk2aRgfpR5MJ66",
  },
  social: {
    facebook: "https://www.facebook.com/ginecologocochabamba/" as string | null,
  },
  /** Agencia que desarrollo el sitio (credito del pie de pagina). */
  developer: { name: "Xion Technology", url: "https://xiontech-seven.vercel.app/" },
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
