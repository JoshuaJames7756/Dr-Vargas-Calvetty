-- Autoriza a una cuenta de Clerk para entrar al panel. Pegar en el SQL Editor de Neon.
-- 1) Cambia el ID (lo ves en Clerk, seccion Users, empieza con user_) y el nombre.
-- 2) Rol: 'doctor' (edita todo) o 'assistant' (gestiona citas, no edita disponibilidad).
INSERT INTO staff_users (clerk_user_id, display_name, role)
VALUES ('user_PEGA_AQUI_TU_ID', 'Tu nombre', 'doctor')
ON CONFLICT (clerk_user_id) DO UPDATE SET display_name = EXCLUDED.display_name, role = EXCLUDED.role, active = true;
