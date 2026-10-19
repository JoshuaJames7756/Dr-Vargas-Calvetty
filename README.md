# Dr. Rolando Vargas Calvetty: sitio web y panel

Proyecto de Xion Technology. Sitio público (Astro), solicitud de citas sin cuenta, API en Cloudflare Workers (Hono) y, próximamente, panel privado del doctor (React + Vite).

## Estado actual

| Pieza | Estado |
|---|---|
| Monorepo pnpm (`apps/web`, `apps/api`, `packages/shared`) | Hecho |
| Sitio público: inicio, solicitud de cita, privacidad (borrador) | Hecho, con contenido pendiente marcado |
| API pública: servicios, disponibilidad, solicitud de cita, contacto | Escrita y probada **sin base de datos real** |
| API privada: listar citas, cambiar estado, reagendar | Escrita; autenticación probada solo en el rechazo (401/403) |
| Esquema Drizzle + restricción anti doble reserva | Escrito; migraciones generadas, **aún no aplicadas a Neon** |
| Panel del doctor (`apps/panel`) | **Pendiente** |
| Disponibilidad editable por el doctor | **Pendiente** (la API ya la calcula; falta la pantalla) |
| Historia clínica, documentos, blog, FAQ | Fases posteriores |

## Requisitos

- Node 20 o superior y pnpm 10.
- Cuentas propias: Cloudflare, Neon, Clerk (planes gratuitos). Verifica los límites vigentes antes de lanzar.

## Instalación

```bash
pnpm install
```

## Panel del consultorio (apps/panel)

Pantallas: Hoy, Solicitudes, Agenda y Disponibilidad. Las acciones salen de las mismas transiciones válidas que aplica el servidor.

1. Copia `apps/panel/.env.example` a `apps/panel/.env` y pega la clave pública de Clerk (`pk_...`).
2. En Clerk, desactiva el registro público (Restrictions) para que solo entren cuentas invitadas.
3. Entrar a Clerk no basta: el acceso lo da la tabla `staff_users`. Autoriza a una persona con `pnpm --filter @dr-vargas/api db:add-staff` (rol `doctor` o `assistant`).
4. Desarrollo: `pnpm --filter panel dev` (proxy de `/api` al Worker local en el puerto 8787).

## Pacientes y notas clínicas

- Pantalla Pacientes: búsqueda por nombre o teléfono, ficha, historial de citas. Desde una cita confirmada, «Crear ficha» crea el paciente (o reutiliza uno con el mismo teléfono).
- Las notas clínicas son solo del doctor (la asistente recibe 403 en el servidor). Cada lectura se registra en la auditoría sin copiar el contenido. Son de solo inserción: una corrección crea una nota nueva y conserva la anterior.
- Migración: archivo `sql/003_pacientes_y_notas.sql`, para pegar en el SQL Editor de Neon (ver `sql/LEEME.md`). Pruebas con Postgres real: `TEST_DATABASE_URL=... pnpm --filter @dr-vargas/api test` contra una base de pruebas vacía con las migraciones aplicadas, nunca la de producción.

## Diseño y movimiento

- Sitio: las secciones aparecen con una entrada suave al hacer scroll (`data-reveal`, script en `Base.astro`) y el hero al cargar (`.rise`). Todo se desactiva con «reducir movimiento» del sistema y sin JavaScript el contenido se ve completo.
- Contacto: mapa de Google incrustado (coordenadas y enlace en `CLINIC.maps`, `packages/shared/src/clinic.ts`) solo en inicio y `/contacto`, sobre fondo claro para distinguirse del pie; las demás páginas usan `CtaBand` y el pie muestra la dirección solo donde no hay sección de contacto.
- Menú «Servicios» del encabezado con ventana desplegable (`ServicesMenu.tsx`); `/servicios` tiene su propio encabezado y el inicio solo resume las tres áreas.
- Panel: menú lateral fijo por categorías, bienvenida con resumen del día en «Hoy», subida de documentos con zona de arrastre. `PageHeader` unifica los encabezados; hay acceso «Ver sitio web» en el menú, y el sitio enlaza «Acceso del consultorio» en el pie.

## SEO y página 404

- `robots.txt` se genera solo: con `PUBLIC_SHOW_PENDING=true` bloquea todo y las páginas llevan `noindex`; en producción permite el sitio, excluye `/panel/` y `/api/` e indica el sitemap con el dominio de `PUBLIC_SITE_URL`.
- Al comprar el dominio, cambiar `PUBLIC_SITE_URL` en las variables de build de Cloudflare y publicar con `PUBLIC_SHOW_PENDING=false`.
- `404.astro` es la página de error que sirve Cloudflare para rutas inexistentes del sitio.

## Documentos de pacientes

Estudios y recetas (PDF, JPG, PNG o WEBP) se guardan dentro de Neon, sin servicios extra ni tarjeta. Solo el doctor los sube, los ve y los elimina; la asistente no tiene acceso.

- Máximo 2 MB por archivo y 100 por paciente. Las fotos se reducen solas en el navegador. El servidor valida el tipo real por su contenido, no por la extensión.
- Eliminar solo oculta el documento: la copia se conserva y la acción queda en el registro de auditoría, igual que subir y abrir.
- Tope de seguridad de 350 MB en total (Neon Free ofrece 0,5 GB compartidos con el resto de datos). Al llegar, el servidor rechaza nuevas subidas con un aviso claro y no pierde nada.
- Si el volumen crece, la ruta de salida es Cloudflare R2 (contratado por el cliente) manteniendo en Neon solo los metadatos.
- Base de datos: `sql/005_documentos.sql`.

## Sitio público de demostración

- Páginas: inicio, `/servicios`, `/doctor`, `/preguntas`, `/contacto`, `/cita`, `/privacidad`.
- Los textos y fotos de ejemplo (biografía, formación, galería, servicios de Mastología, preguntas médicas) van dentro de recuadros «Ejemplo» (`Sample.astro`, `PhotoPlaceholder.astro`). Solo se ven con `PUBLIC_SHOW_PENDING=true`; en producción (`false`) no se publica ninguno.
- Datos reales editables en `packages/shared/src/clinic.ts` (teléfonos, dirección, horario provisional, Facebook), `apps/web/src/data/services.ts` y `apps/web/src/data/faq.ts`.

## Recordatorios por WhatsApp

- Pantalla **Recordatorios**: citas confirmadas de un día (por defecto mañana) con un botón que abre WhatsApp (`wa.me`) con el mensaje escrito. Abrirlo no envía nada: el personal decide.
- «Ya lo envié» guarda `reminder_sent_at` en la cita (migración `sql/004_recordatorios.sql`), queda en la auditoría y se muestra también en la tarjeta de la cita. Se puede desmarcar.
- Sin costo: no usa la API de WhatsApp Business ni envía mensajes automáticos.

## Variables de entorno

Los valores reales van en estos archivos locales (no hay `.env.example` en la raíz):

- **`apps/api/.dev.vars`** (local, ignorado por Git): `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `TURNSTILE_SECRET_KEY`, `ALLOWED_ORIGIN`, `CLINIC_TIMEZONE`.
- **`apps/web/.env`** (local): `PUBLIC_TURNSTILE_SITE_KEY`, `PUBLIC_API_URL=http://localhost:8787`, `PUBLIC_SHOW_PENDING=true`.
- En producción, los secretos van con `wrangler secret put NOMBRE`. **Nunca** en Git ni en el navegador.

Para probar sin cuenta de Turnstile, Cloudflare ofrece claves de prueba (site key `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`).

## Base de datos

```bash
export DATABASE_URL="postgresql://..."        # cadena de Neon (con -pooler)
pnpm db:migrate                               # aplica drizzle/0000 y 0001
pnpm db:seed                                  # servicios iniciales (duraciones provisionales)
pnpm --filter @dr-vargas/api db:add-staff -- user_XXXX "Dr. Rolando Vargas" doctor
```

`0001_constraints.sql` crea la restricción que impide dos citas CONFIRMED solapadas y vuelve de solo inserción a `audit_log` y al historial de estados.

## Desarrollo

```bash
pnpm dev:api     # Worker en http://localhost:8787
pnpm dev:web     # Sitio en http://localhost:4321
```

## Pruebas y verificación

```bash
pnpm typecheck
pnpm test                       # Vitest: shared (19) + api (15)
pnpm --filter @dr-vargas/web test:e2e   # Playwright + axe, escritorio y móvil
pnpm build
```

Las pruebas de la API no tocan una base de datos real. Falta una prueba de integración contra Neon (o un PostgreSQL local) para confirmar la restricción anti doble reserva y las transacciones.

## Decisiones de arquitectura

- **Astro para el sitio público, React para el panel:** mejor rendimiento y SEO en móvil para contenido informativo. Excepción aprobada al stack del prompt maestro.
- **Una sola conexión Neon por solicitud** (Pool por WebSocket) porque Workers no reutiliza conexiones y las transacciones lo requieren.
- **Una solicitud PENDING no bloquea el horario.** Solo CONFIRMED lo ocupa, y la garantía está en la base de datos.
- **Clerk identifica, la tabla `staff_users` autoriza.** Iniciar sesión sin estar en esa tabla no da acceso.
- **WhatsApp:** solo enlaces `wa.me`. Abrirlo no envía nada y la interfaz nunca dice "enviado".
- **Imágenes públicas:** optimizadas por Astro en el build. Documentos clínicos (Fase 4): R2 privado, a verificar.

## Contenido pendiente (marcado en el sitio con «PENDIENTE»)

Biografía y formación, significado de «R.B.S.P.B. San Pablo · Brasil», servicios de Mastología, horarios y duración de consultas, enlace de Facebook, retrato profesional (la foto actual es provisional), piso exacto del consultorio, textos legales revisados.

En producción esos avisos no se muestran (`PUBLIC_SHOW_PENDING=false`).

## Herramientas

- `tools/enhance_photo.py`: corrección conservadora de luz y color (no retoca el rostro).
- `tools/prepare_logo.py`: logo con transparencia e iconos desde el PNG original.

## Despliegue en Cloudflare (Workers + recursos estáticos)

Un solo Worker sirve el sitio en `/`, el panel en `/panel/` y la API en `/api/*`. Todo comparte origen, así que no hace falta CORS en producción.

1. Sube el repo a GitHub.
2. Cloudflare: Workers & Pages, Create, Import a repository. Raíz del repositorio como directorio.
   - Build command: `pnpm build:deploy`
   - Deploy command: `pnpm --filter @dr-vargas/api exec wrangler deploy`
3. Build variables (Settings, Build, Variables; son públicas, quedan dentro del sitio):
   - `VITE_CLERK_PUBLISHABLE_KEY` (pk_...)
   - `PUBLIC_TURNSTILE_SITE_KEY`
   - `PUBLIC_SHOW_PENDING=true` mientras haya contenido pendiente (agrega noindex automáticamente)
   - `PUBLIC_SITE_URL` (la URL final, por ejemplo https://dr-vargas.TU-SUBDOMINIO.workers.dev)
4. Runtime, Variables and Secrets (el deploy no las borra): secretos `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `TURNSTILE_SECRET_KEY`, y `ALLOWED_ORIGIN` con la URL exacta del Worker (https://..., sin barra final).
5. En Clerk, agrega esa URL a los dominios permitidos si lo pide.
6. Migraciones y alta de personal: `docs/verificar-base.sql` y `docs/autorizar-staff.sql` en el SQL Editor de Neon.

Las migraciones no se ejecutan en el despliegue ni en cada solicitud: se aplican a mano con `pnpm db:migrate`.

## Resumen (estadísticas)

Pantalla `/panel/resumen`: citas del mes, atendidas, inasistencias, porcentaje de asistencia, canceladas, y reparto por servicio y por día. Se calcula en el servidor con `GET /api/appointments/stats` (consultas agrupadas, sin datos de pacientes) y exige sesión del personal. No requiere migración SQL.

## Protección contra abuso y política de contenido

- Mensajes de contacto: máximo 3 por teléfono cada hora (`modules/contact/service.ts`), además de Turnstile. Solicitudes de cita: máximo 3 pendientes por teléfono.
- Política de contenido (CSP) en modo **solo reporte** en el sitio (`scripts/assemble.mjs`) y en el panel (`apps/api/src/index.ts`). No bloquea nada: avisa en la consola del navegador. Ver `docs/lanzamiento.md` para decidir cuándo pasar a modo bloqueo.
