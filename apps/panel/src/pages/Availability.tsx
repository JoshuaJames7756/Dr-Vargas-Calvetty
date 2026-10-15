import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { exceptionSchema, weeklyScheduleSchema, type ExceptionInput } from "@dr-vargas/shared";
import { ErrorState, Loading } from "../components/States";
import { ApiError, useApi, type DayConfig, type ExceptionDto } from "../lib/api";
import { addDays, capitalize, hhmmToMinutes, minutesToHHMM, todayLocal, WEEKDAY_ORDER, WEEKDAYS } from "../lib/time";
import { useMe } from "../lib/useMe";

const SLOT_OPTIONS = [15, 20, 30, 45, 60];

function TimeInput({ label, value, onChange, disabled }: { label: string; value: number; onChange: (m: number) => void; disabled?: boolean }) {
  return (
    <label className="text-sm font-semibold">
      <span className="block">{label}</span>
      <input type="time" step={300} className="field mt-1" disabled={disabled} value={minutesToHHMM(value)} onChange={(e) => e.target.value && onChange(hhmmToMinutes(e.target.value))} />
    </label>
  );
}

export default function Availability() {
  const api = useApi();
  const qc = useQueryClient();
  const me = useMe();
  const readOnly = me.data?.role !== "doctor";
  const q = useQuery({ queryKey: ["availability"], queryFn: api.getAvailability });

  const [days, setDays] = useState<DayConfig[]>([]);
  const [dirty, setDirty] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (q.data && !dirty) setDays(q.data.days);
  }, [q.data, dirty]);

  const save = useMutation({
    mutationFn: () => {
      const parsed = weeklyScheduleSchema.safeParse({ days });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Revisa los horarios");
      return api.saveWeekly(parsed.data);
    },
    onSuccess: () => {
      toast.success("Horario guardado");
      setDirty(false);
      setProblem(null);
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
    onError: (e) => setProblem(e instanceof ApiError || e instanceof Error ? e.message : "No se pudo guardar."),
  });

  const patchDay = (weekday: number, fn: (d: DayConfig) => DayConfig) => {
    setDirty(true);
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? fn(d) : d)));
  };

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  return (
    <div className="space-y-12">
      <section aria-labelledby="av-w">
        <h1 id="av-w" className="text-3xl sm:text-4xl">Disponibilidad</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Los horarios que definas aquí son los únicos que verán las pacientes. Un día sin horarios es un día sin atención. Horario de Cochabamba.
        </p>
        {readOnly && me.data && <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-amber-800">Solo el doctor puede modificar la disponibilidad.</p>}

        <div className="mt-6 space-y-4">
          {WEEKDAY_ORDER.map((wd) => {
            const day = days.find((d) => d.weekday === wd);
            if (!day) return null;
            const open = day.ranges.length > 0;
            return (
              <fieldset key={wd} className="card p-4 sm:p-5" disabled={readOnly}>
                <legend className="sr-only">{WEEKDAYS[wd]}</legend>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl">{WEEKDAYS[wd]}</h2>
                  <label className="flex items-center gap-2 font-semibold">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-teal-700"
                      checked={open}
                      onChange={(e) => patchDay(wd, (d) => ({ ...d, ranges: e.target.checked ? [{ startMinute: 540, endMinute: 1080, slotMinutes: 30 }] : [], breaks: e.target.checked ? d.breaks : [] }))}
                    />
                    Atiende
                  </label>
                </div>

                {open && (
                  <div className="mt-4 space-y-4">
                    {day.ranges.map((r, i) => (
                      <div key={i} className="flex flex-wrap items-end gap-3">
                        <TimeInput label="Desde" value={r.startMinute} onChange={(m) => patchDay(wd, (d) => ({ ...d, ranges: d.ranges.map((x, j) => (j === i ? { ...x, startMinute: m } : x)) }))} />
                        <TimeInput label="Hasta" value={r.endMinute} onChange={(m) => patchDay(wd, (d) => ({ ...d, ranges: d.ranges.map((x, j) => (j === i ? { ...x, endMinute: m } : x)) }))} />
                        <label className="text-sm font-semibold">
                          <span className="block">Duración del cupo</span>
                          <select className="field mt-1" value={r.slotMinutes} onChange={(e) => patchDay(wd, (d) => ({ ...d, ranges: d.ranges.map((x, j) => (j === i ? { ...x, slotMinutes: Number(e.target.value) } : x)) }))}>
                            {SLOT_OPTIONS.map((o) => (
                              <option key={o} value={o}>{o} min</option>
                            ))}
                          </select>
                        </label>
                        {day.ranges.length > 1 && (
                          <button type="button" className="btn btn-danger" aria-label={`Quitar horario ${i + 1} del ${WEEKDAYS[wd]}`} onClick={() => patchDay(wd, (d) => ({ ...d, ranges: d.ranges.filter((_, j) => j !== i) }))}>
                            <Trash2 aria-hidden size={16} />
                          </button>
                        )}
                      </div>
                    ))}

                    {day.breaks.map((b, i) => (
                      <div key={`b${i}`} className="flex flex-wrap items-end gap-3 rounded-lg bg-sand/60 p-3">
                        <TimeInput label="Descanso desde" value={b.startMinute} onChange={(m) => patchDay(wd, (d) => ({ ...d, breaks: d.breaks.map((x, j) => (j === i ? { ...x, startMinute: m } : x)) }))} />
                        <TimeInput label="Hasta" value={b.endMinute} onChange={(m) => patchDay(wd, (d) => ({ ...d, breaks: d.breaks.map((x, j) => (j === i ? { ...x, endMinute: m } : x)) }))} />
                        <button type="button" className="btn btn-danger" aria-label={`Quitar descanso ${i + 1} del ${WEEKDAYS[wd]}`} onClick={() => patchDay(wd, (d) => ({ ...d, breaks: d.breaks.filter((_, j) => j !== i) }))}>
                          <Trash2 aria-hidden size={16} />
                        </button>
                      </div>
                    ))}

                    <div className="flex flex-wrap gap-2">
                      {day.ranges.length < 4 && (
                        <button type="button" className="btn btn-outline" onClick={() => patchDay(wd, (d) => ({ ...d, ranges: [...d.ranges, { startMinute: 840, endMinute: 1080, slotMinutes: 30 }] }))}>
                          <Plus aria-hidden size={16} /> Otro horario
                        </button>
                      )}
                      {day.breaks.length < 4 && (
                        <button type="button" className="btn btn-outline" onClick={() => patchDay(wd, (d) => ({ ...d, breaks: [...d.breaks, { startMinute: 780, endMinute: 840 }] }))}>
                          <Plus aria-hidden size={16} /> Agregar descanso
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </fieldset>
            );
          })}
        </div>

        {problem && <p role="alert" className="mt-4 rounded-lg bg-[#fde8e6] px-3 py-2 text-[#7a1810]">{problem}</p>}
        {!readOnly && (
          <div className="sticky bottom-20 mt-6 flex items-center gap-3 md:bottom-4">
            <button type="button" className="btn btn-primary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 aria-hidden size={16} className="animate-spin" />} Guardar horario
            </button>
            {dirty && <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">Cambios sin guardar</span>}
          </div>
        )}
      </section>

      <Exceptions list={q.data?.exceptions ?? []} readOnly={readOnly} />
    </div>
  );
}

function Exceptions({ list, readOnly }: { list: ExceptionDto[]; readOnly: boolean }) {
  const api = useApi();
  const qc = useQueryClient();
  const [date, setDate] = useState(addDays(todayLocal(), 1));
  const [kind, setKind] = useState<"blocked" | "custom">("blocked");
  const [start, setStart] = useState(540);
  const [end, setEnd] = useState(780);
  const [slot, setSlot] = useState(30);
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["availability"] });
  const add = useMutation({
    mutationFn: () => {
      const body: ExceptionInput = kind === "blocked" ? { blocked: true, note: note || undefined } : { blocked: false, startMinute: start, endMinute: end, slotMinutes: slot, note: note || undefined };
      const parsed = exceptionSchema.safeParse(body);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Revisa los datos");
      return api.saveException(date, parsed.data);
    },
    onSuccess: () => {
      toast.success("Excepción guardada");
      setProblem(null);
      setNote("");
      refresh();
    },
    onError: (e) => setProblem(e instanceof Error ? e.message : "No se pudo guardar."),
  });
  const remove = useMutation({
    mutationFn: (d: string) => api.deleteException(d),
    onSuccess: () => {
      toast.success("Excepción eliminada");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo eliminar."),
  });

  return (
    <section aria-labelledby="av-e">
      <h2 id="av-e" className="text-2xl">Vacaciones, feriados y cambios de horario</h2>
      <p className="mt-2 max-w-2xl text-ink-soft">Una excepción reemplaza el horario normal de ese día. Las citas ya confirmadas no se cancelan solas: revísalas en la agenda.</p>

      {!readOnly && (
        <form
          className="card mt-5 flex flex-wrap items-end gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <label className="text-sm font-semibold">
            <span className="block">Fecha</span>
            <input type="date" className="field mt-1" min={todayLocal()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
          <label className="text-sm font-semibold">
            <span className="block">Tipo</span>
            <select className="field mt-1" value={kind} onChange={(e) => setKind(e.target.value as "blocked" | "custom")}>
              <option value="blocked">Día sin atención</option>
              <option value="custom">Horario especial</option>
            </select>
          </label>
          {kind === "custom" && (
            <>
              <TimeInput label="Desde" value={start} onChange={setStart} />
              <TimeInput label="Hasta" value={end} onChange={setEnd} />
              <label className="text-sm font-semibold">
                <span className="block">Cupo</span>
                <select className="field mt-1" value={slot} onChange={(e) => setSlot(Number(e.target.value))}>
                  {SLOT_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o} min</option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className="min-w-40 flex-1 text-sm font-semibold">
            <span className="block">Nota (opcional)</span>
            <input className="field mt-1 w-full" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={add.isPending}>
            {add.isPending ? <Loader2 aria-hidden size={16} className="animate-spin" /> : <Plus aria-hidden size={16} />} Agregar
          </button>
          {problem && <p role="alert" className="w-full text-danger">{problem}</p>}
        </form>
      )}

      <ul className="mt-5 space-y-2">
        {list.length === 0 && <li className="text-ink-soft">No hay excepciones próximas.</li>}
        {list.map((x) => (
          <li key={x.date} className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-semibold">{capitalize(new Intl.DateTimeFormat("es-BO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${x.date}T00:00:00Z`)))}</p>
              <p className="text-ink-soft">
                {x.blocked ? "Sin atención" : `Horario especial ${minutesToHHMM(x.startMinute ?? 0)} a ${minutesToHHMM(x.endMinute ?? 0)}`}
                {x.note ? `. ${x.note}` : ""}
              </p>
            </div>
            {!readOnly && (
              <button type="button" className="btn btn-danger" disabled={remove.isPending} onClick={() => remove.mutate(x.date)} aria-label={`Eliminar excepción del ${x.date}`}>
                <Trash2 aria-hidden size={16} /> Eliminar
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
