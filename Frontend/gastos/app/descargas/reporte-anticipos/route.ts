import { fetchApi } from "@/src/lib/api"

// Excel del reporte de anticipos por centro de costos. Pasa por aquí porque el backend exige el
// token, que vive en una cookie httpOnly.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const respuesta = await fetchApi(`/gastos/anticipos/reporte/exportar?${searchParams}`)

  if (!respuesta.ok) {
    const json = await respuesta.json().catch(() => null)
    return new Response(json?.error ?? json?.errors?.[0]?.msg ?? "No se pudo generar el archivo", {
      status: respuesta.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    })
  }

  return new Response(respuesta.body, {
    headers: {
      "Content-Type": respuesta.headers.get("Content-Type") ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": respuesta.headers.get("Content-Disposition") ?? 'attachment; filename="anticipos-por-centro-de-costos.xlsx"'
    }
  })
}
