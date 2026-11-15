# Versiones del proyecto

El sitio tiene un solo código y se publica por etapas con la variable de build `PUBLIC_MODE`.

| Versión | Qué incluye | Cómo se activa |
| --- | --- | --- |
| **1 (lanzamiento)** | Sitio informativo con lo ya conocido. La cita se pide con un formulario que abre WhatsApp con el mensaje armado. Sin horarios ni textos por confirmar. | `PUBLIC_MODE=lite` (es el valor por defecto) y `PUBLIC_SHOW_PENDING=false` |
| **2 (contenido)** | Los mismos módulos, con la información que el doctor vaya enviando: foto, biografía, formación, Mastología, horarios, preguntas médicas. Solo se edita contenido. | Editar los archivos de la lista de abajo |
| **3 (panel)** | Solicitud con horarios libres, panel para confirmar citas, recordatorios, pacientes, documentos y resumen. Ya está construido y probado. | `PUBLIC_MODE=full` y las variables y secretos de abajo |

## Publicar la Versión 1

En Cloudflare, en Workers & Pages, en el proyecto, Settings, Build, Variables and secrets del build:

- `PUBLIC_SHOW_PENDING` = `false`
- `PUBLIC_MODE` = `lite` (opcional, es el valor por defecto)
- `PUBLIC_SITE_URL` = la dirección pública. Mientras no exista el dominio, usa `https://drvargascalvetty.jvsoft.workers.dev`; cuando lo compres, cámbiala por el dominio.
- Deja las demás variables como están.

Las variables de build solo se aplican en un build nuevo: haz un `git push` (o "Retry build") después de cambiarlas.

Con el dominio comprado: Settings, Domains and routes, Add custom domain. Luego actualiza `PUBLIC_SITE_URL` y vuelve a compilar.

En la Versión 1 el panel (`/panel/`) y la API siguen desplegados pero nada del sitio los enlaza; el panel pide inicio de sesión y solo entran las cuentas autorizadas.

## Qué editar en la Versión 2

| Contenido | Dónde |
| --- | --- |
| Foto del doctor | Reemplazar `apps/web/src/assets/doctor-provisional.jpg` (de frente, buena luz) |
| Biografía y formación | `apps/web/src/pages/doctor.astro` (hoy solo se muestran bloques de ejemplo en la demostración) |
| Servicios de Mastología | `apps/web/src/data/services.ts` (campo `items` del grupo `mastologia`, y quitar `pending: true`) |
| Horarios | `packages/shared/src/clinic.ts` (`hours.label`) y variable de build `PUBLIC_SHOW_HOURS=true` |
| Preguntas médicas | `apps/web/src/data/faq.ts` (`FAQ_CONSULTAS_EJEMPLO`, solo con respuestas del doctor) y mostrarlas en `preguntas.astro` |
| Fotos del consultorio | Galería en `doctor.astro` (solo con fotos autorizadas, sin pacientes) |

## Pasar a la Versión 3

1. `PUBLIC_MODE` = `full` y `PUBLIC_TURNSTILE_SITE_KEY` (clave de producción) en las variables de build, junto con `VITE_CLERK_PUBLISHABLE_KEY`.
2. Secretos del Worker: `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `TURNSTILE_SECRET_KEY`, `ALLOWED_ORIGIN` (el dominio final).
3. Base de datos: aplicar los archivos de `sql/` en orden y cargar disponibilidad desde el panel.
4. Autorizar al doctor y a su asistente (`sql/herramientas`).
5. Probar el recorrido completo (`docs/guion-demo.md`) y dejar a las cuentas de producción a nombre del doctor.

Las pruebas del sitio cubren ambos modos: `pnpm test:e2e` (Versión 1) y `pnpm test:e2e:full` (Versión 3).
