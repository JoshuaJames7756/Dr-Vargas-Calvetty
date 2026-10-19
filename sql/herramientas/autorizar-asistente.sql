-- Autoriza a una SEGUNDA cuenta como ASISTENTE para probar que no ve notas ni documentos. Pegar en el SQL Editor de Neon.
--
-- Pasos antes de ejecutarlo:
--  1) Cierra sesion del panel y entra con OTRO correo en https://drvargascalvetty.jvsoft.workers.dev/panel/
--     (crea la cuenta con "Sign up" si no existe). Veras "Tu cuenta no esta autorizada": es lo esperado.
--  2) En Clerk, seccion Users, abre esa cuenta y copia su ID (empieza con user_).
--  3) Reemplaza el ID de abajo y ejecuta.
--  4) Vuelve al panel con esa cuenta y recarga la pagina.
INSERT INTO staff_users (clerk_user_id, display_name, role)
VALUES ('user_PEGA_AQUI_EL_ID_DE_LA_SEGUNDA_CUENTA', 'Asistente de prueba', 'assistant')
ON CONFLICT (clerk_user_id) DO UPDATE SET display_name = EXCLUDED.display_name, role = 'assistant', active = true;

-- Para comprobar que quedaron los dos (doctor y asistente):
SELECT display_name, role, active FROM staff_users ORDER BY created_at;

-- Cuando termines la prueba puedes desactivar al asistente (no se borra, queda el historial):
-- UPDATE staff_users SET active = false WHERE role = 'assistant' AND display_name = 'Asistente de prueba';
