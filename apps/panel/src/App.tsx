import { SignIn, SignedIn, SignedOut, useClerk } from "@clerk/clerk-react";
import { Route, Routes } from "react-router";
import Shell from "./components/Shell";
import { ErrorState, Loading } from "./components/States";
import { ApiError } from "./lib/api";
import { useMe } from "./lib/useMe";
import Agenda from "./pages/Agenda";
import Availability from "./pages/Availability";
import PatientDetail from "./pages/PatientDetail";
import Patients from "./pages/Patients";
import Requests from "./pages/Requests";
import Today from "./pages/Today";

function Authorized() {
  const me = useMe();
  const { signOut } = useClerk();

  if (me.isLoading) return <Loading label="Verificando tu acceso…" />;

  // Autenticada en Clerk, pero sin fila activa en staff_users: sin acceso.
  if (me.error instanceof ApiError && me.error.status === 403) {
    return (
      <div className="mx-auto mt-24 max-w-md px-4 text-center">
        <h1 className="text-3xl">Tu cuenta no está autorizada</h1>
        <p className="mt-3 text-ink-soft">Iniciaste sesión, pero este panel es solo para el consultorio. Si deberías tener acceso, pide que te habiliten.</p>
        <button type="button" className="btn btn-outline mt-6" onClick={() => signOut()}>
          Cerrar sesión
        </button>
      </div>
    );
  }
  if (me.error) {
    return (
      <div className="mx-auto mt-24 max-w-md px-4">
        <ErrorState error={me.error} onRetry={() => me.refetch()} />
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Today />} />
        <Route path="solicitudes" element={<Requests />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="pacientes" element={<Patients />} />
        <Route path="pacientes/:id" element={<PatientDetail />} />
        <Route path="disponibilidad" element={<Availability />} />
        <Route path="*" element={<Today />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <>
      <SignedOut>
        <div className="flex min-h-dvh items-center justify-center px-4 py-10">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-center text-3xl">Panel del consultorio</h1>
            <SignIn routing="hash" />
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <Authorized />
      </SignedIn>
    </>
  );
}
