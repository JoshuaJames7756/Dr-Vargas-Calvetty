import { CLINIC } from "@dr-vargas/shared";

/**
 * Modo del sitio (variable de build PUBLIC_MODE).
 *  - "lite" (Version 1, por defecto): sitio informativo. La cita se pide por WhatsApp con un mensaje prellenado.
 *    No usa panel, base de datos ni confirmaciones. No muestra horarios que el doctor no haya confirmado.
 *  - "full" (Version 3): solicitud de cita con horarios libres, panel y confirmacion desde el panel.
 */
export const LITE = (import.meta.env.PUBLIC_MODE ?? "lite") !== "full";

/** Horario de atencion publicado. En modo lite no se muestra hasta que el doctor lo confirme: edita CLINIC.hours.label y define PUBLIC_SHOW_HOURS=true. */
export const HOURS: string | null = LITE && import.meta.env.PUBLIC_SHOW_HOURS !== "true" ? null : CLINIC.hours.label;

export const COPY = LITE
  ? {
      ctaText: "Cuéntanos qué necesitas y qué día te conviene. Se abre WhatsApp con tu mensaje listo para enviar.",
      tileText: "Cuéntanos el servicio y el día que te conviene. Se abre WhatsApp con tu mensaje listo.",
      heroNote: "Se abre WhatsApp con tu mensaje listo para enviar.",
      steps: [
        { title: "Elige el servicio", text: "Selecciona el motivo de tu consulta entre los servicios disponibles." },
        { title: "Cuéntanos qué día te conviene", text: "Indica el día y el horario que prefieres. Es solo una preferencia." },
        { title: "Envía por WhatsApp", text: "Se abre WhatsApp con tu mensaje listo. Lo envías y el consultorio te responde." },
      ],
      citaDescription: "Pide tu cita con el Dr. Rolando Vargas Calvetty en Cochabamba. Completa unos datos y se abre WhatsApp con tu mensaje listo.",
      citaIntro: "Completa unos datos y se abrirá WhatsApp con tu mensaje listo. Lo envías y el consultorio te responde para coordinar el día y la hora.",
      hoursFallback: "Coordina tu día y hora por WhatsApp o teléfono.",
    }
  : {
      ctaText: "Elige el servicio y un horario libre. El consultorio revisa tu solicitud y te confirma por WhatsApp.",
      tileText: "Elige el servicio y un horario libre. El consultorio te confirma por WhatsApp.",
      heroNote: "Tu solicitud queda pendiente hasta que el consultorio la confirme.",
      steps: [
        { title: "Elige el servicio", text: "Selecciona el motivo de tu consulta entre los servicios disponibles." },
        { title: "Escoge un horario", text: "Verás solo los horarios que realmente están libres en la agenda." },
        { title: "Recibe la confirmación", text: "El consultorio revisa tu solicitud y te confirma por WhatsApp." },
      ],
      citaDescription: "Solicita tu cita con el Dr. Rolando Vargas Calvetty en Cochabamba. El consultorio revisa tu solicitud y te confirma por WhatsApp.",
      citaIntro: "El consultorio revisará tu solicitud y te confirmará por WhatsApp. Hasta entonces, la cita no está confirmada.",
      hoursFallback: "",
    };
