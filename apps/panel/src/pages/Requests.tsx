import { useQuery } from "@tanstack/react-query";
import AppointmentCard from "../components/AppointmentCard";
import { Empty, ErrorState, Loading } from "../components/States";
import PageHeader from "../components/PageHeader";
import { useApi } from "../lib/api";

export default function Requests() {
  const api = useApi();
  const q = useQuery({ queryKey: ["appointments", "pending"], queryFn: () => api.listAppointments({ status: "PENDING" }) });

  return (
    <div>
      <PageHeader title="Solicitudes" description="Una solicitud no es una cita hasta que la confirmes. Si dos pacientes piden el mismo horario, solo podrás confirmar una." />
      <div className="mt-6 space-y-4">
        {q.isLoading && <Loading />}
        {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
        {q.data?.length === 0 && <Empty title="No hay solicitudes pendientes">Todo al día.</Empty>}
        {q.data?.map((a) => <AppointmentCard key={a.id} appt={a} showDay />)}
      </div>
    </div>
  );
}
