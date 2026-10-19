// Junta el sitio (Astro) y el panel (Vite) en deploy/assets para que el Worker los sirva como recursos estaticos.
//   sitio -> deploy/assets/        panel -> deploy/assets/panel/
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

const out = "deploy/assets";
const web = "apps/web/dist";
const panel = "apps/panel/dist";
for (const dir of [web, panel]) {
  if (!existsSync(dir)) throw new Error(`Falta ${dir}. Ejecuta primero el build de ese paquete.`);
}

rmSync("deploy", { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(web, out, { recursive: true });
cpSync(panel, `${out}/panel`, { recursive: true });

// Cabeceras de seguridad para los archivos estaticos (el Worker aplica las suyas a /api y /panel/*).
let headers = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com https://www.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
`;
// Mientras el sitio muestre contenido PENDIENTE, no debe indexarse en buscadores.
if (process.env.PUBLIC_SHOW_PENDING === "true") {
  headers += `  X-Robots-Tag: noindex, nofollow\n`;
  console.log("PUBLIC_SHOW_PENDING=true: se agrega noindex (vista previa, no indexable).");
}
writeFileSync(`${out}/_headers`, headers);
console.log(`Listo: ${out}`);
