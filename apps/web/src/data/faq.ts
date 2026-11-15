/**
 * Preguntas frecuentes.
 * - Grupo "citas": describe el funcionamiento REAL del sitio y del consultorio (datos ya confirmados).
 * - Grupo "consultas": preguntas de ejemplo. Las respuestas medicas las redacta el doctor; hasta entonces
 *   se muestran solo en modo demostracion (Sample) y NUNCA se publican en produccion.
 */
import { CLINIC } from "@dr-vargas/shared";
import { HOURS, LITE } from "../lib/mode";

export interface FaqItem {
  q: string;
  a: string;
}

const FAQ_CITAS_FULL: FaqItem[] = [
  {
    q: "¿Qué datos necesito para pedir una cita?",
    a: "Solo necesitas tu nombre, tu número de celular o WhatsApp y, si quieres, un motivo breve. No pedimos diagnósticos ni datos médicos detallados.",
  },
  {
    q: "¿Mi solicitud ya es una cita confirmada?",
    a: "No todavía. Tu solicitud queda pendiente hasta que el consultorio la revise y la confirme. Hasta ese momento el horario no está reservado a tu nombre.",
  },
  {
    q: "¿Cómo sé si mi cita fue confirmada?",
    a: "El consultorio te escribe por WhatsApp al número que dejaste. Si no recibes mensaje, escríbenos o llámanos y lo revisamos.",
  },
  {
    q: "¿Puedo cambiar o cancelar mi cita?",
    a: "Sí. Avísanos por WhatsApp o por teléfono lo antes posible, para reagendarla y liberar el horario para otra paciente.",
  },
  {
    q: "¿Cuáles son los horarios de atención?",
    a: `${HOURS}. Al solicitar tu cita verás solo los horarios que están libres en ese momento.`,
  },
  {
    q: "¿Dónde queda el consultorio?",
    a: `${CLINIC.address.line1}, ${CLINIC.address.line2}, ${CLINIC.address.floor.toLowerCase()}. ${CLINIC.address.city}. Puedes abrir la ubicación en Google Maps desde la página de contacto.`,
  },
  {
    q: "¿Qué escribo en el motivo de la consulta?",
    a: "Una frase corta, por ejemplo «control» o «primera consulta». Los detalles de tu salud los conversarás directamente con el doctor en la consulta.",
  },
  {
    q: "¿El doctor atiende embarazos de alto riesgo?",
    a: "Entre los servicios del consultorio figuran el control prenatal y el embarazo de alto y bajo riesgo. Para saber qué corresponde a tu caso, consulta con el consultorio por WhatsApp.",
  },
];

/** Version 1 (modo lite): la cita se pide por WhatsApp. Ningun texto habla de confirmaciones ni de agenda en linea. */
const FAQ_CITAS_LITE: FaqItem[] = [
  {
    q: "¿Cómo pido mi cita?",
    a: "Entra a «Solicitar cita», elige el servicio y escribe tu nombre. Se abre WhatsApp con tu mensaje ya redactado: solo debes enviarlo y el consultorio te responde.",
  },
  {
    q: "¿Qué datos necesito para pedir una cita?",
    a: "Tu nombre, el servicio que necesitas y, si quieres, el día y el horario que prefieres y un motivo breve. No pedimos diagnósticos ni datos médicos detallados.",
  },
  {
    q: "¿Cuándo sé el día y la hora de mi cita?",
    a: "El consultorio te responde por WhatsApp para coordinar el día y la hora que mejor se ajusten. Si prefieres hablar, también puedes llamar por teléfono.",
  },
  {
    q: "¿Puedo cambiar o cancelar mi cita?",
    a: "Sí. Avísanos por WhatsApp o por teléfono lo antes posible, para reagendarla y liberar el horario para otra paciente.",
  },
  {
    q: "¿Cuáles son los horarios de atención?",
    a: "Para coordinar el día y la hora, escríbenos por WhatsApp o llámanos. Te indicamos los horarios disponibles.",
  },
  {
    q: "¿Dónde queda el consultorio?",
    a: `${CLINIC.address.line1}, ${CLINIC.address.line2}, ${CLINIC.address.floor.toLowerCase()}. ${CLINIC.address.city}. Puedes abrir la ubicación en Google Maps desde la página de contacto.`,
  },
  {
    q: "¿Qué escribo en el motivo de la consulta?",
    a: "Una frase corta, por ejemplo «control» o «primera consulta». Los detalles de tu salud los conversarás directamente con el doctor en la consulta.",
  },
  {
    q: "¿El doctor atiende embarazos de alto riesgo?",
    a: "Entre los servicios del consultorio figuran el control prenatal y el embarazo de alto y bajo riesgo. Para saber qué corresponde a tu caso, consulta con el consultorio por WhatsApp.",
  },
];

export const FAQ_CITAS: FaqItem[] = LITE ? FAQ_CITAS_LITE : FAQ_CITAS_FULL;

/** Ejemplos para la demostracion. El doctor redacta o aprueba cada respuesta. */
export const FAQ_CONSULTAS_EJEMPLO: FaqItem[] = [
  {
    q: "¿Cada cuánto tiempo debo hacerme un Papanicolaou?",
    a: "[Respuesta a cargo del doctor.] La frecuencia depende de cada persona; el doctor la indica en la consulta.",
  },
  {
    q: "¿Qué debo llevar a mi primera consulta?",
    a: "[Respuesta a cargo del doctor.] Por ejemplo: documento de identidad, estudios o exámenes anteriores y la lista de medicamentos que tomas.",
  },
  {
    q: "¿Cuánto dura una consulta?",
    a: "[Respuesta a cargo del doctor.] La duración varía según el tipo de consulta.",
  },
];
