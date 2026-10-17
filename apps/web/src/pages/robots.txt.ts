import type { APIRoute } from "astro";
import { SHOW_PENDING } from "../lib/pending";

/** Con contenido de ejemplo visible no se indexa nada; en produccion se permite el sitio y se excluyen panel y API. */
export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL("https://dr-vargas.example");
  const lines = SHOW_PENDING
    ? ["User-agent: *", "Disallow: /"]
    : ["User-agent: *", "Allow: /", "Disallow: /panel/", "Disallow: /api/", "", `Sitemap: ${new URL("/sitemap-index.xml", base)}`];
  return new Response(lines.join("\n") + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
