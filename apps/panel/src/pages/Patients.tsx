import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import Dialog from "../components/Dialog";
import PatientForm from "../components/PatientForm";
import { Empty, ErrorState, Loading } from "../components/States";
import { ApiError, useApi } from "../lib/api";

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function Patients() {
  const api = useApi();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(false);
  const q = useDebounced(text.trim());

  useEffect(() => setOffset(0), [q]);

  const list = useQuery({ queryKey: ["patients", q, offset], queryFn: () => api.searchPatients(q, offset), placeholderData: keepPreviousData });

  const create = useMutation({
    mutationFn: api.createPatient,
    onSuccess: ({ patient }) => {
      toast.success("Paciente creado");
      qc.invalidateQueries({ queryKey: ["patients"] });
      setCreating(false);
      navigate(`/pacientes/${patient.id}`);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "No se pudo crear el paciente."),
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl">Pacientes</h1>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus aria-hidden size={18} /> Nuevo paciente
        </button>
      </div>

      <div className="relative mt-5 max-w-md">
        <label htmlFor="pt-search" className="sr-only">
          Buscar por nombre o teléfono
        </label>
        <Search aria-hidden size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input id="pt-search" type="search" className="field w-full pl-10" placeholder="Buscar por nombre o teléfono" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
      </div>

      <div className="mt-5 space-y-2" aria-live="polite">
        {list.isLoading && <Loading />}
        {list.error && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
        {list.data && list.data.patients.length === 0 && (
          <Empty title={q ? "Sin resultados" : "Aún no hay pacientes"}>
            {q ? "Prueba con otro nombre o con el teléfono." : "Los pacientes aparecen aquí cuando creas su ficha desde una cita confirmada, o con «Nuevo paciente»."}
          </Empty>
        )}
        {list.data?.patients.map((p) => (
          <Link key={p.id} to={`/pacientes/${p.id}`} className="card flex items-center justify-between gap-3 px-4 py-3 hover:border-teal-500">
            <span className="font-semibold">{p.fullName}</span>
            <span className="text-ink-soft">{p.phone}</span>
          </Link>
        ))}
        {list.data && (offset > 0 || list.data.hasMore) && (
          <div className="flex justify-between pt-2">
            <button type="button" className="btn btn-outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>
              Anteriores
            </button>
            <button type="button" className="btn btn-outline" disabled={!list.data.hasMore} onClick={() => setOffset(offset + 20)}>
              Siguientes
            </button>
          </div>
        )}
      </div>

      <Dialog open={creating} title="Nuevo paciente" onClose={() => setCreating(false)}>
        <PatientForm submitLabel="Crear paciente" busy={create.isPending} onSubmit={(v) => create.mutate(v)} onCancel={() => setCreating(false)} />
      </Dialog>
    </div>
  );
}
