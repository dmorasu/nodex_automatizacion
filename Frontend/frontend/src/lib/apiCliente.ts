// Llamadas al backend desde el navegador, por el proxy /api/backend (agrega la sesión).
// Devuelve { ok, datos } o { ok: false, error } con el mensaje del backend.
export async function llamarApi<T = unknown>(ruta: string, metodo = "GET", cuerpo?: unknown):
  Promise<{ ok: true, datos: T } | { ok: false, error: string }> {
  try {
    const res = await fetch(`/api/backend${ruta}`, {
      method: metodo,
      headers: cuerpo === undefined ? undefined : { "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      const error = json?.error ?? json?.errors?.[0]?.msg ?? "No se pudo completar la operación"
      return { ok: false, error }
    }
    return { ok: true, datos: json as T }
  } catch {
    return { ok: false, error: "No hay conexión con el servidor" }
  }
}
