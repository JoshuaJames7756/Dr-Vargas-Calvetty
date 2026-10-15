-- Verificacion de las protecciones de la base. Pegar completo en el SQL Editor de Neon y ejecutar.
-- Muestra un "error" con los resultados: es intencional, asi se revierte todo y no se guarda nada.
DO $$
DECLARE
  sid uuid;
  r text := '';
BEGIN
  SELECT id INTO sid FROM services LIMIT 1;
  IF sid IS NULL THEN RAISE EXCEPTION 'No hay servicios cargados'; END IF;

  INSERT INTO appointments (service_id, requester_name, requester_phone, starts_at, ends_at, status)
  VALUES (sid, 'Prueba', '70000000', '2099-01-05T14:00:00Z', '2099-01-05T14:30:00Z', 'CONFIRMED');
  r := r || E'\nOK    Se puede crear una cita confirmada';

  BEGIN
    INSERT INTO appointments (service_id, requester_name, requester_phone, starts_at, ends_at, status)
    VALUES (sid, 'Prueba', '70000000', '2099-01-05T14:15:00Z', '2099-01-05T14:45:00Z', 'CONFIRMED');
    r := r || E'\nFALLA Se permitio una cita confirmada solapada';
  EXCEPTION WHEN exclusion_violation THEN
    r := r || E'\nOK    Una cita CONFIRMADA solapada es rechazada';
  END;

  BEGIN
    INSERT INTO appointments (service_id, requester_name, requester_phone, starts_at, ends_at, status)
    VALUES (sid, 'Prueba', '70000000', '2099-01-05T14:30:00Z', '2099-01-05T15:00:00Z', 'CONFIRMED');
    r := r || E'\nOK    Una cita confirmada pegada al final de otra es permitida';
  EXCEPTION WHEN OTHERS THEN
    r := r || E'\nFALLA Se rechazo una cita contigua';
  END;

  BEGIN
    INSERT INTO appointments (service_id, requester_name, requester_phone, starts_at, ends_at, status)
    VALUES (sid, 'Prueba', '70000000', '2099-01-05T14:15:00Z', '2099-01-05T14:45:00Z', 'PENDING');
    r := r || E'\nOK    Una solicitud PENDIENTE en el mismo horario es permitida';
  EXCEPTION WHEN OTHERS THEN
    r := r || E'\nFALLA Se rechazo una solicitud pendiente';
  END;

  BEGIN
    INSERT INTO appointments (service_id, requester_name, requester_phone, starts_at, ends_at, status)
    VALUES (sid, 'Prueba', '70000000', '2099-01-05T16:00:00Z', '2099-01-05T15:00:00Z', 'PENDING');
    r := r || E'\nFALLA Se permitio una cita que termina antes de empezar';
  EXCEPTION WHEN check_violation THEN
    r := r || E'\nOK    Una cita que termina antes de empezar es rechazada';
  END;

  INSERT INTO appointment_status_history (appointment_id, to_status)
  SELECT id, 'CONFIRMED' FROM appointments WHERE starts_at = '2099-01-05T14:00:00Z' AND status = 'CONFIRMED' LIMIT 1;

  BEGIN
    UPDATE appointment_status_history SET note = 'x';
    r := r || E'\nFALLA El historial se pudo modificar';
  EXCEPTION WHEN OTHERS THEN
    r := r || E'\nOK    El historial de estados no se puede modificar';
  END;

  BEGIN
    DELETE FROM appointment_status_history;
    r := r || E'\nFALLA El historial se pudo borrar';
  EXCEPTION WHEN OTHERS THEN
    r := r || E'\nOK    El historial de estados no se puede borrar';
  END;

  RAISE EXCEPTION E'RESULTADOS (no se guardo ningun dato):%', r;
END $$;
