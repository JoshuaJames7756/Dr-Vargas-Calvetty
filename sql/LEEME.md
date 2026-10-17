# SQL para Neon, en orden

Se pegan en el SQL Editor de Neon (Branch correcta, base `neondb`) y se ejecutan completos.

| Orden | Archivo | Estado |
|---|---|---|
| 1 | `001_inicial.sql` | Ya aplicada en tu Neon. No repetir. |
| 2 | `002_restricciones.sql` | Ya aplicada en tu Neon. No repetir. |
| 3 | `003_pacientes_y_notas.sql` | Ya aplicada en tu Neon. No repetir. |
| 4 | `004_recordatorios.sql` | Ya aplicada en tu Neon. No repetir. |
| 5 | `005_documentos.sql` | **Nueva. Ejecutar una sola vez.** |

Las dos primeras estan solo como referencia, por si un dia hay que crear una base nueva desde cero (en ese caso se ejecutan en orden 001, 002, 003, 004, 005 y luego se cargan los servicios).

## Herramientas (se usan cuando haga falta)

- `herramientas/verificar-base.sql`: comprueba las protecciones. Muestra un "error" con los resultados: es lo esperado y no guarda nada.
- `herramientas/autorizar-staff.sql`: autoriza a una cuenta de Clerk para entrar al panel.
- `herramientas/limpiar-datos-de-prueba.sql`: borra las filas de prueba de la verificacion (leer las instrucciones dentro).

## Regla para el futuro

Cada cambio de base de datos nuevo llegara como el siguiente archivo numerado (`006_...`). Se ejecutan en orden, uno por uno, y nunca se edita un archivo ya aplicado.
