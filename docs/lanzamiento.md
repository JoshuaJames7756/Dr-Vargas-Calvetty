# Checklist de lanzamiento

Marca cada punto antes de entregar el sitio al Dr. Vargas Calvetty.

## Contenido (lo aporta el doctor)
- [ ] Foto profesional definitiva.
- [ ] Biografía y formación, solo lo que él confirme.
- [ ] Servicios de Mastología revisados por él.
- [ ] Respuestas médicas de las preguntas frecuentes revisadas por él.
- [ ] Horarios, dirección y teléfonos confirmados.

## Seguridad
- [ ] El asistente (segunda cuenta) no ve notas ni documentos y no edita la disponibilidad.
- [ ] Una cuenta sin fila en `staff_users` recibe "Tu cuenta no está autorizada".
- [ ] Sin secretos en el repositorio ni en variables públicas (solo las `VITE_` y `PUBLIC_` de claves públicas).
- [ ] Revisar la consola del navegador en el sitio y en el panel: los avisos de `Content-Security-Policy-Report-Only` indican qué bloquearía una política estricta. Si no hay avisos útiles tras una semana de uso real, se puede pasar a modo bloqueo.
- [ ] Los datos de prueba se borraron de Neon.
- [ ] Turnstile con claves de producción (no las de prueba).

## Dominio y publicación
- [ ] Dominio comprado y apuntado al Worker.
- [ ] `PUBLIC_SITE_URL` con el dominio final.
- [ ] `PUBLIC_SHOW_PENDING=false` (oculta contenido de muestra y quita el bloqueo a buscadores).
- [ ] Nuevo build en Cloudflare después de cambiar variables (solo aplican con un build nuevo).
- [ ] `ALLOWED_ORIGIN` con el dominio final.
- [ ] Dominio agregado en Clerk y en Turnstile.

## Calidad
- [ ] Probar sitio y panel en un celular real.
- [ ] Probar solicitar una cita de punta a punta y confirmarla desde el panel.
- [ ] Pruebas automáticas en verde (`pnpm -r typecheck`, pruebas de API, panel y e2e del sitio).

## Cuotas y cuentas
- [ ] Revisar los límites vigentes de Cloudflare Workers Free, Neon Free y Clerk Free.
- [ ] Definir qué ocurre si se agota una cuota y quién autoriza una ampliación.
- [ ] Cuentas de producción a nombre del doctor, o acuerdo escrito de quién las administra.
- [ ] Probar la restauración o exportación de datos de Neon.
