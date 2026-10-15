import { zodResolver } from "@hookform/resolvers/zod";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertCircle, ArrowLeft, CalendarCheck, Check, Loader2, MessageCircle } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { localToUtc, minutesToHHMM, whatsappLink } from "@dr-vargas/shared";
import {
  ApiError,
  fetchAvailability,
  fetchServices,
  submitAppointmentRequest,
  type PublicService,
  type SlotDto,
} from "./api";
import Turnstile from "./Turnstile";

// Esquema del formulario de datos (el servidor vuelve a validar todo con el esquema compartido).
const detailsSchema = z.object({
  fullName: z.string().trim().min(3, "Escribe tu nombre completo").max(120, "El nombre es demasiado largo"),
  phone: z
    .string()
    .trim()
    .refine((v) => /^(\+?591)?[67]\d{7}$/.test(v.replace(/[\s\-().]/g, "")), "Ingresa un celular boliviano válido (8 dígitos)"),
  reason: z.string().trim().max(280, "Máximo 280 caracteres").optional(),
  consent: z.boolean().refine((v) => v === true, "Debes aceptar para continuar"),
});
type DetailsForm = z.infer<typeof detailsSchema>;

const STEPS = ["Servicio", "Fecha y hora", "Tus datos", "Revisar"] as const;
const todayLocal = () => new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10);
const addDays = (date: string, n: number) => new Date(new Date(`${date}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("es-BO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

function Inner() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [service, setService] = useState<PublicService | null>(null);
  const [date, setDate] = useState(() => addDays(todayLocal(), 1));
  const [slot, setSlot] = useState<SlotDto | null>(null);
  const [details, setDetails] = useState<DetailsForm | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [done, setDone] = useState<{ message: string } | null>(null);

  const servicesQ = useQuery({ queryKey: ["services"], queryFn: fetchServices, staleTime: 5 * 60_000, retry: 1, retryDelay: 800 });
  const availabilityQ = useQuery({
    queryKey: ["availability", service?.id, date],
    queryFn: () => fetchAvailability(service!.id, date),
    enabled: !!service && step === 1,
    staleTime: 30_000,
    retry: 1,
    retryDelay: 800,
  });

  const startsAtIso = useMemo(() => (slot ? localToUtc(date, slot.startMinute).toISOString() : null), [date, slot]);

  const submit = useMutation({
    mutationFn: () =>
      submitAppointmentRequest({
        fullName: details!.fullName,
        phone: details!.phone,
        serviceId: service!.id,
        startsAt: startsAtIso!,
        reason: details!.reason || undefined,
        turnstileToken: token!,
        consent: true,
      }),
    onSuccess: (r) => setDone({ message: r.message }),
    onError: (err) => {
      setToken(null);
      setResetKey((k) => k + 1);
      // El horario pudo ocuparse mientras se llenaba el formulario: volver a elegir.
      if (err instanceof ApiError && (err.code === "SLOT_UNAVAILABLE" || err.code === "SLOT_TAKEN")) {
        setSlot(null);
        setStep(1);
      }
    },
  });

  if (done && service && slot) {
    const msg = `Hola, soy ${details?.fullName}. Envié una solicitud de cita para ${service.name} el ${formatDate(date)} a las ${slot.label}. Quedo atento(a) a su confirmación.`;
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card mx-auto max-w-xl p-7 text-center sm:p-9"
        role="status"
      >
        <motion.span
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-teal-700"
        >
          <Check aria-hidden size={34} />
        </motion.span>
        <h2 className="mt-5 text-3xl">Solicitud enviada</h2>
        <p className="mt-3 rounded-lg bg-rose-100 px-3 py-2 font-semibold text-ink">
          Estado: pendiente de confirmación. Todavía no es una cita confirmada.
        </p>
        <p className="mt-4 text-ink-soft">{done.message}</p>
        <dl className="mx-auto mt-5 max-w-sm text-left">
          <div className="flex justify-between gap-4 border-b border-line py-2"><dt className="text-ink-soft">Servicio</dt><dd className="font-medium">{service.name}</dd></div>
          <div className="flex justify-between gap-4 border-b border-line py-2"><dt className="text-ink-soft">Fecha</dt><dd className="font-medium capitalize">{formatDate(date)}</dd></div>
          <div className="flex justify-between gap-4 py-2"><dt className="text-ink-soft">Hora</dt><dd className="font-medium">{slot.label}</dd></div>
        </dl>
        <a href={whatsappLink(msg)} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp mt-6 w-full">
          <MessageCircle aria-hidden size={20} /> Avisar por WhatsApp (opcional)
        </a>
        <p className="mt-2 text-sm text-ink-soft">Al tocar el botón se abre WhatsApp; el mensaje solo se envía cuando tú lo envías.</p>
      </motion.div>
    );
  }

  const variants = {
    enter: reduce ? { opacity: 0 } : { opacity: 0, x: 24 },
    center: { opacity: 1, x: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, x: -24 },
  };

  return (
    <div className="mx-auto max-w-2xl">
      <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Progreso de la solicitud">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined} className="text-center">
            <span
              className={`mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold ${
                i < step ? "border-teal-700 bg-teal-700 text-white" : i === step ? "border-teal-700 bg-white text-teal-800" : "border-line bg-white text-ink-soft"
              }`}
            >
              {i < step ? <Check aria-hidden size={18} /> : i + 1}
            </span>
            <span className={`block text-xs sm:text-sm ${i === step ? "font-semibold text-teal-900" : "text-ink-soft"}`}>{label}</span>
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.18 }}>
          {step === 0 && (
            <StepService
              loading={servicesQ.isLoading}
              error={servicesQ.error as Error | null}
              onRetry={() => servicesQ.refetch()}
              services={servicesQ.data ?? []}
              selected={service}
              onSelect={(s) => {
                setService(s);
                setSlot(null);
                setStep(1);
              }}
            />
          )}
          {step === 1 && service && (
            <StepDate
              service={service}
              date={date}
              onDate={(d) => {
                setDate(d);
                setSlot(null);
              }}
              slot={slot}
              onSlot={setSlot}
              q={availabilityQ}
              onBack={() => setStep(0)}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <StepDetails
              initial={details}
              onBack={() => setStep(1)}
              onNext={(d) => {
                setDetails(d);
                setStep(3);
              }}
            />
          )}
          {step === 3 && service && slot && details && (
            <section aria-labelledby="rev-h">
              <h2 id="rev-h" className="text-2xl">Revisa tu solicitud</h2>
              <dl className="card mt-4 divide-y divide-line">
                {[
                  ["Servicio", service.name],
                  ["Fecha", formatDate(date)],
                  ["Hora", slot.label],
                  ["Nombre", details.fullName],
                  ["Teléfono", details.phone],
                  ["Motivo", details.reason || "No indicado"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-5 py-3">
                    <dt className="text-ink-soft">{k}</dt>
                    <dd className="text-right font-medium capitalize-first">{v}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-4 rounded-lg bg-teal-50 p-3 text-sm text-ink-soft">
                Esto es una <strong>solicitud</strong>. El consultorio la revisará y te confirmará la cita; hasta entonces no está confirmada.
              </p>

              <div className="mt-5">
                <Turnstile onToken={setToken} resetKey={resetKey} />
              </div>

              {submit.error && (
                <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-[#fde8e6] p-3 text-[#7a1810]">
                  <AlertCircle aria-hidden size={20} className="mt-0.5 shrink-0" />
                  {submit.error instanceof ApiError ? submit.error.message : "Ocurrió un error inesperado. Inténtalo de nuevo."}
                </p>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button type="button" className="btn btn-outline text-teal-800" onClick={() => setStep(2)} disabled={submit.isPending}>
                  <ArrowLeft aria-hidden size={18} /> Volver
                </button>
                <button type="button" className="btn btn-primary" disabled={!token || submit.isPending} onClick={() => submit.mutate()}>
                  {submit.isPending ? (
                    <>
                      <Loader2 aria-hidden size={18} className="animate-spin" /> Enviando…
                    </>
                  ) : (
                    <>
                      <CalendarCheck aria-hidden size={18} /> Enviar solicitud
                    </>
                  )}
                </button>
              </div>
              {!token && <p className="mt-2 text-sm text-ink-soft">Completa la verificación de seguridad para poder enviar.</p>}
            </section>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function StepService(props: {
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  services: PublicService[];
  selected: PublicService | null;
  onSelect: (s: PublicService) => void;
}) {
  const bookable = props.services.filter((s) => s.bookable);
  const groups = bookable.reduce<Record<string, PublicService[]>>((acc, s) => ((acc[s.specialty] ??= []).push(s), acc), {});
  const names: Record<string, string> = { ginecologia: "Ginecología", oncologia: "Oncología", mastologia: "Mastología" };

  return (
    <section aria-labelledby="svc-h">
      <h2 id="svc-h" className="text-2xl">¿Qué servicio necesitas?</h2>
      <p className="mt-1 text-ink-soft">Elige el motivo de tu consulta. Si no estás segura, escríbenos por WhatsApp.</p>

      {props.loading && <p role="status" className="mt-6 flex items-center gap-2 text-ink-soft"><Loader2 aria-hidden className="animate-spin" size={18} /> Cargando servicios…</p>}

      {props.error && (
        <div role="alert" className="mt-6 rounded-lg bg-[#fde8e6] p-4 text-[#7a1810]">
          <p>No pudimos cargar los servicios. Revisa tu conexión e inténtalo de nuevo.</p>
          <button type="button" className="btn btn-outline mt-3 !min-h-10 text-[#7a1810]" onClick={props.onRetry}>Reintentar</button>
        </div>
      )}

      {!props.loading && !props.error && bookable.length === 0 && (
        <p className="mt-6 rounded-lg bg-teal-50 p-4 text-ink-soft">Por ahora no hay servicios disponibles para solicitar en línea. Escríbenos por WhatsApp.</p>
      )}

      {Object.entries(groups).map(([spec, list]) => (
        <fieldset key={spec} className="mt-6">
          <legend className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-teal-700">{names[spec] ?? spec}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {list.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => props.onSelect(s)}
                aria-pressed={props.selected?.id === s.id}
                className="card min-h-14 px-4 py-3 text-left font-medium transition hover:border-teal-500 hover:bg-teal-50 aria-pressed:border-teal-700 aria-pressed:bg-teal-50"
              >
                {s.name}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
    </section>
  );
}

function StepDate(props: {
  service: PublicService;
  date: string;
  onDate: (d: string) => void;
  slot: SlotDto | null;
  onSlot: (s: SlotDto) => void;
  q: ReturnType<typeof useQuery<Awaited<ReturnType<typeof fetchAvailability>>>>;
  onBack: () => void;
  onNext: () => void;
}) {
  const dateId = useId();
  const min = todayLocal();
  const max = addDays(min, 90);
  const slots = props.q.data?.slots ?? [];

  return (
    <section aria-labelledby="date-h">
      <h2 id="date-h" className="text-2xl">Elige fecha y hora</h2>
      <p className="mt-1 text-ink-soft">{props.service.name}. Los horarios corresponden a Cochabamba (hora de Bolivia).</p>

      <label htmlFor={dateId} className="mt-5 block font-semibold">Fecha</label>
      <input id={dateId} type="date" className="field mt-1 max-w-xs" min={min} max={max} value={props.date} onChange={(e) => e.target.value && props.onDate(e.target.value)} />
      <p className="mt-1 text-sm capitalize-first text-ink-soft">{formatDate(props.date)}</p>

      <div className="mt-5" aria-live="polite">
        {props.q.isLoading && <p className="flex items-center gap-2 text-ink-soft"><Loader2 aria-hidden size={18} className="animate-spin" /> Buscando horarios…</p>}

        {props.q.error && (
          <div role="alert" className="rounded-lg bg-[#fde8e6] p-4 text-[#7a1810]">
            <p>{props.q.error instanceof ApiError ? props.q.error.message : "No pudimos consultar los horarios."}</p>
            <button type="button" className="btn btn-outline mt-3 !min-h-10 text-[#7a1810]" onClick={() => props.q.refetch()}>Reintentar</button>
          </div>
        )}

        {props.q.data && slots.length === 0 && (
          <p className="rounded-lg bg-teal-50 p-4 text-ink-soft">No hay horarios disponibles ese día. Prueba con otra fecha o escríbenos por WhatsApp.</p>
        )}

        {slots.length > 0 && (
          <div role="radiogroup" aria-label="Horarios disponibles" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((s) => (
              <button
                key={s.startMinute}
                type="button"
                role="radio"
                aria-checked={props.slot?.startMinute === s.startMinute}
                onClick={() => props.onSlot(s)}
                className="min-h-12 rounded-xl border-[1.5px] border-[#668684] bg-white font-semibold transition hover:border-teal-700 aria-checked:border-teal-700 aria-checked:bg-teal-700 aria-checked:text-white"
              >
                {minutesToHHMM(s.startMinute)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button type="button" className="btn btn-outline text-teal-800" onClick={props.onBack}><ArrowLeft aria-hidden size={18} /> Cambiar servicio</button>
        <button type="button" className="btn btn-primary" disabled={!props.slot} onClick={props.onNext}>Continuar</button>
      </div>
    </section>
  );
}

function StepDetails(props: { initial: DetailsForm | null; onBack: () => void; onNext: (d: DetailsForm) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DetailsForm>({
    resolver: zodResolver(detailsSchema),
    defaultValues: props.initial ?? { fullName: "", phone: "", reason: "", consent: false },
  });
  const f = useId();

  const err = (name: keyof DetailsForm) => (errors[name]?.message ? <p id={`${f}-${name}-e`} className="mt-1 text-sm font-medium text-[#9b1c13]">{errors[name]?.message as string}</p> : null);

  return (
    <form onSubmit={handleSubmit(props.onNext)} noValidate aria-labelledby="det-h">
      <h2 id="det-h" className="text-2xl">Tus datos de contacto</h2>
      <p className="mt-1 text-ink-soft">Solo lo necesario para que el consultorio pueda confirmarte la cita.</p>

      <div className="mt-5">
        <label htmlFor={`${f}-fullName`} className="block font-semibold">Nombre completo</label>
        <input id={`${f}-fullName`} autoComplete="name" className="field mt-1" aria-invalid={!!errors.fullName} aria-describedby={errors.fullName ? `${f}-fullName-e` : undefined} {...register("fullName")} />
        {err("fullName")}
      </div>

      <div className="mt-5">
        <label htmlFor={`${f}-phone`} className="block font-semibold">Celular o WhatsApp</label>
        <input id={`${f}-phone`} type="tel" inputMode="tel" autoComplete="tel" placeholder="70000000" className="field mt-1" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? `${f}-phone-e` : undefined} {...register("phone")} />
        {err("phone")}
      </div>

      <div className="mt-5">
        <label htmlFor={`${f}-reason`} className="block font-semibold">Motivo breve <span className="font-normal text-ink-soft">(opcional)</span></label>
        <textarea id={`${f}-reason`} rows={3} className="field mt-1" aria-describedby={`${f}-reason-h`} {...register("reason")} />
        <p id={`${f}-reason-h`} className="mt-1 text-sm text-ink-soft">No escribas diagnósticos ni datos médicos detallados. Esos temas se tratan en la consulta.</p>
        {err("reason")}
      </div>

      <div className="mt-5">
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-teal-700" aria-invalid={!!errors.consent} aria-describedby={errors.consent ? `${f}-consent-e` : undefined} {...register("consent")} />
          <span>
            Acepto que el consultorio use mi nombre y teléfono para contactarme sobre esta solicitud. Consulta la{" "}
            <a href="/privacidad" target="_blank" className="font-semibold text-teal-700 underline underline-offset-2">política de privacidad</a>.
          </span>
        </label>
        {err("consent")}
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button type="button" className="btn btn-outline text-teal-800" onClick={props.onBack}><ArrowLeft aria-hidden size={18} /> Volver</button>
        <button type="submit" className="btn btn-primary">Revisar solicitud</button>
      </div>
    </form>
  );
}

export default function BookingFlow() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }));
  return (
    <QueryClientProvider client={client}>
      <Inner />
    </QueryClientProvider>
  );
}
