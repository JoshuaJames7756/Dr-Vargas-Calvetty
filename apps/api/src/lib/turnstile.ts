/** Verifica el token de Cloudflare Turnstile en el servidor. */
export async function verifyTurnstile(secret: string, token: string, ip?: string | null): Promise<boolean> {
  try {
    const body = new FormData();
    body.append("secret", secret);
    body.append("response", token);
    if (ip) body.append("remoteip", ip);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Fallo cerrado: si no podemos verificar, no aceptamos la solicitud.
    return false;
  }
}
