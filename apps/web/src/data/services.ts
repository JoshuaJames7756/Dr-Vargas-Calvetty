/**
 * Servicios publicados. Fuente: flyer actual del consultorio y brief del proyecto.
 * No se agregan procedimientos ni alcances clinicos que el doctor no haya proporcionado.
 * PENDIENTE: el doctor debe validar esta lista y completar Mastologia.
 */
export interface ServiceGroup {
  id: "ginecologia" | "oncologia" | "mastologia";
  title: string;
  intro: string;
  items: string[];
  /** true si el contenido aun no fue proporcionado por el doctor. */
  pending?: boolean;
}

export const SERVICE_GROUPS: ServiceGroup[] = [
  {
    id: "ginecologia",
    title: "Ginecología y obstetricia",
    intro: "Atención integral de la salud de la mujer en cada etapa.",
    items: [
      "Control prenatal, embarazo de alto y bajo riesgo",
      "Embarazo, obstetricia y cesárea",
      "Toma de Papanicolaou",
      "Colposcopia y vulvoscopia",
      "Diagnóstico de VPH",
      "Cirugía ginecológica",
      "Cirugía mamaria",
      "Sexualidad",
      "Planificación familiar",
      "Manejo del climaterio, menopausia y osteoporosis",
    ],
  },
  {
    id: "oncologia",
    title: "Oncología",
    intro: "Diagnóstico, tratamiento y acompañamiento de pacientes oncológicas.",
    items: [
      "Tratamiento de cáncer",
      "Quimioterapia",
      "Hormonoterapia",
      "Terapia molecular",
      "Medicina paliativa",
    ],
  },
  {
    id: "mastologia",
    title: "Mastología",
    intro: "Atención de la salud de la mama.",
    items: [],
    // PENDIENTE: lista de servicios de Mastologia por validar con el doctor.
    pending: true,
  },
];
