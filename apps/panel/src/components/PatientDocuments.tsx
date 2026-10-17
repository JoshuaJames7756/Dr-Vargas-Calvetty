import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileImage, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import Dialog from "./Dialog";
import { Empty, ErrorState, Loading } from "./States";
import { ApiError, useApi, type DocumentDto } from "../lib/api";
import { checkFile, DOCUMENT_ACCEPT, formatBytes, prepareFile } from "../lib/documents";
import { capitalize, fmtDay, fmtTime } from "../lib/time";

const stamp = (iso: string) => `${capitalize(fmtDay(iso))}, ${fmtTime(iso)}`;

/** Documentos del paciente (estudios, recetas). Solo el doctor. El servidor valida todo y registra cada apertura. */
export default function PatientDocuments({ patientId }: { patientId: string }) {
  const api = useApi();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ doc: DocumentDto; url: string } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [removing, setRemoving] = useState<DocumentDto | null>(null);

  const docs = useQuery({ queryKey: ["documents", patientId], queryFn: () => api.listDocuments(patientId), retry: 1 });

  // Libera la URL temporal del archivo al cerrar la vista previa.
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview.url)), [preview]);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("no-file");
      const ready = await prepareFile(file);
      const problem = checkFile(ready);
      if (problem) throw new ApiError(0, "CLIENT", problem);
      if (ready.size > 2 * 1024 * 1024) throw new ApiError(0, "CLIENT", `La imagen sigue pesando ${formatBytes(ready.size)}. El máximo es 2.0 MB.`);
      return api.uploadDocument(patientId, title.trim(), ready);
    },
    onSuccess: () => {
      toast.success("Documento guardado");
      setTitle("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["documents", patientId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "No se pudo subir el documento. Inténtalo de nuevo."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteDocument(id),
    onSuccess: () => {
      toast.success("Documento eliminado");
      setRemoving(null);
      qc.invalidateQueries({ queryKey: ["documents", patientId] });
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "No se pudo eliminar el documento.");
      qc.invalidateQueries({ queryKey: ["documents", patientId] });
    },
  });

  const open = async (doc: DocumentDto) => {
    setOpening(doc.id);
    try {
      const blob = await api.downloadDocument(doc.id);
      setPreview({ doc, url: URL.createObjectURL(blob) });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo abrir el documento.");
    } finally {
      setOpening(null);
    }
  };

  const onPick = (f: File | null) => {
    setFile(f);
    setFileError(f ? checkFile(f) : null);
    if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, "").slice(0, 120));
  };

  return (
    <section aria-labelledby="documentos">
      <h2 id="documentos" className="text-xl">
        Documentos
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Estudios y recetas del paciente. Solo los ve el doctor y cada vez que se abren queda registro. PDF, JPG, PNG o WEBP, hasta 2 MB (las fotos se reducen solas). «Eliminar» los oculta; la copia se conserva.
      </p>

      <form
        className="card mt-4 space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (file && title.trim() && !fileError) upload.mutate();
        }}
      >
        <div>
          <label htmlFor="doc-archivo" className="block font-semibold">
            Archivo
          </label>
          <input
            id="doc-archivo"
            ref={fileRef}
            type="file"
            accept={DOCUMENT_ACCEPT}
            className="field mt-1"
            aria-describedby={fileError ? "doc-error" : undefined}
            aria-invalid={!!fileError}
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
          {fileError && (
            <p id="doc-error" role="alert" className="mt-1 text-sm text-danger">
              {fileError}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="doc-titulo" className="block font-semibold">
            Título
          </label>
          <input id="doc-titulo" className="field mt-1" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Por ejemplo: Ecografía mamaria" />
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={upload.isPending || !file || !title.trim() || !!fileError}>
            {upload.isPending ? <Loader2 aria-hidden size={16} className="animate-spin" /> : <Upload aria-hidden size={16} />} {upload.isPending ? "Subiendo…" : "Subir documento"}
          </button>
        </div>
      </form>

      <div className="mt-4 space-y-3" aria-live="polite">
        {docs.isLoading && <Loading />}
        {docs.error && <ErrorState error={docs.error} onRetry={() => docs.refetch()} />}
        {docs.data?.length === 0 && <Empty title="Todavía no hay documentos">Sube un estudio o una receta para tenerlo en la ficha del paciente.</Empty>}
        {docs.data?.map((d) => (
          <article key={d.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-start gap-3">
              {d.mimeType === "application/pdf" ? <FileText aria-hidden size={24} className="mt-0.5 shrink-0 text-teal-700" /> : <FileImage aria-hidden size={24} className="mt-0.5 shrink-0 text-teal-700" />}
              <div className="min-w-0">
                <p className="break-words font-semibold">{d.title}</p>
                <p className="text-sm text-ink-soft">
                  {stamp(d.createdAt)} · {formatBytes(d.sizeBytes)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-outline" disabled={opening === d.id} onClick={() => open(d)}>
                {opening === d.id ? <Loader2 aria-hidden size={16} className="animate-spin" /> : null} Abrir<span className="sr-only"> {d.title}</span>
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setRemoving(d)}>
                <Trash2 aria-hidden size={16} /> Eliminar<span className="sr-only"> {d.title}</span>
              </button>
            </div>
          </article>
        ))}
      </div>

      <Dialog open={!!preview} title={preview?.doc.title ?? ""} wide onClose={() => setPreview(null)}>
        {preview &&
          (preview.doc.mimeType === "application/pdf" ? (
            <iframe title={preview.doc.title} src={preview.url} className="h-[65vh] w-full rounded-lg border border-line" />
          ) : (
            <img src={preview.url} alt={preview.doc.title} className="max-h-[65vh] w-full rounded-lg object-contain" />
          ))}
        <div className="mt-4 flex justify-end gap-2">
          {preview && (
            <a className="btn btn-outline" href={preview.url} download={preview.doc.fileName}>
              <Download aria-hidden size={16} /> Descargar
            </a>
          )}
          <button type="button" className="btn btn-primary" onClick={() => setPreview(null)}>
            Cerrar
          </button>
        </div>
      </Dialog>

      <Dialog open={!!removing} title="Eliminar documento" onClose={() => setRemoving(null)}>
        <p>¿Eliminar «{removing?.title}»? Dejará de verse en la ficha. La copia se conserva y la acción queda registrada.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-outline" onClick={() => setRemoving(null)}>
            Volver
          </button>
          <button type="button" className="btn btn-danger" disabled={remove.isPending} onClick={() => removing && remove.mutate(removing.id)}>
            {remove.isPending && <Loader2 aria-hidden size={16} className="animate-spin" />} Sí, eliminar
          </button>
        </div>
      </Dialog>
    </section>
  );
}
