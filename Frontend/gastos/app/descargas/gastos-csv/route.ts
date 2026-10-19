import { fetchApi } from "@/src/lib/api"

// Descarga en CSV (para Excel) el listado de gastos con los filtros recibidos. Pasa por aquí
// porque el backend exige el token, que vive en una cookie httpOnly.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const respuesta = await fetchApi(`/gastos/solicitudes/exportar?${searchParams}`)

  if (!respuesta.ok) {
    const json = await respuesta.json().catch(() => null)
    return new Response(json?.error ?? json?.errors?.[0]?.msg ?? "No se pudo generar el archivo", {
      status: respuesta.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    })
  }

  return new Response(respuesta.body, {
    headers: {
      "Content-Type": respuesta.headers.get("Content-Type") ?? "text/csv; charset=utf-8",
      "Content-Disposition": respuesta.headers.get("Content-Disposition") ?? 'attachment; filename="gastos.csv"'
    }
  })
}
