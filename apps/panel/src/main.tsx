import { ClerkProvider } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { Toaster } from "sonner";
import App from "./App";
import "./styles.css";

const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true, retry: 1, retryDelay: 800 } } });

const root = createRoot(document.getElementById("root")!);

if (!key) {
  root.render(
    <p role="alert" className="m-8 rounded-lg border border-dashed border-rose-500 bg-rose-100 p-4">
      <strong>Configuración pendiente:</strong> falta VITE_CLERK_PUBLISHABLE_KEY en apps/panel/.env.
    </p>,
  );
} else {
  root.render(
    <StrictMode>
      <ClerkProvider publishableKey={key} afterSignOutUrl="/panel/">
        <QueryClientProvider client={queryClient}>
          <BrowserRouter basename="/panel">
            <App />
            <Toaster position="top-center" richColors closeButton />
          </BrowserRouter>
        </QueryClientProvider>
      </ClerkProvider>
    </StrictMode>,
  );
}
