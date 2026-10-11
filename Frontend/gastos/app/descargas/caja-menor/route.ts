import { fetchApi } from "@/src/lib/api"

// Excel del historial de una caja menor (?bolsaId=&estado=&desde=&hasta=&quienLegaliza=&busqueda=).
// Pasa por aquí porque el backend exige el token, que vive en una cookie httpOnly.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const bolsaId = Number(params.get("bolsaId"))
  params.delete("bolsaId")

  const respuesta = await fetchApi(`/gastos/caja-menor/cajas/${bolsaId}/historial/exportar?${params}`)

  if (!respuesta.ok) {
    const json = await respuesta.json().catch(() => null)
    return new Response(json?.error ?? json?.errors?.[0]?.msg ?? "No se pudo generar el Excel", {
      status: respuesta.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    })
  }

  return new Response(respuesta.body, {
    headers: {
      "Content-Type": respuesta.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": respuesta.headers.get("Content-Disposition") ?? 'attachment; filename="historial-caja.xlsx"'
    }
  })
}
