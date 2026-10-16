-- Borra SOLO los datos que dejo mi prueba de verificacion: citas a nombre de "Prueba", telefono 70000000,
-- en el anio 2099. No toca ninguna cita real.
--
-- El historial de estados esta protegido contra borrado a proposito. Este script lo desprotege solo durante
-- esta limpieza, dentro de una transaccion (si algo falla, todo vuelve a como estaba).
--
-- PASO 1: ejecuta solo este SELECT para ver que se borraria. Deben ser filas de "Prueba" en 2099.
--   SELECT id, requester_name, requester_phone, status, starts_at FROM appointments
--   WHERE requester_name = 'Prueba' AND requester_phone = '70000000' AND starts_at >= '2099-01-01';
--
-- PASO 2: si todo se ve bien, ejecuta desde BEGIN hasta COMMIT.

BEGIN;

ALTER TABLE appointment_status_history DISABLE TRIGGER appointment_history_immutable_rows;

DELETE FROM appointment_status_history
WHERE appointment_id IN (
  SELECT id FROM appointments
  WHERE requester_name = 'Prueba' AND requester_phone = '70000000' AND starts_at >= '2099-01-01'
);

DELETE FROM appointments
WHERE requester_name = 'Prueba' AND requester_phone = '70000000' AND starts_at >= '2099-01-01';

ALTER TABLE appointment_status_history ENABLE TRIGGER appointment_history_immutable_rows;

COMMIT;
