import { fetchApi } from "@/src/lib/api"

// Descarga el Excel detallado de los gastos con los filtros de la bandeja. Pasa por aquí
// porque el backend exige el token, que vive en una cookie httpOnly.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const respuesta = await fetchApi(`/gastos/solicitudes/exportar-excel?${searchParams}`)

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
      "Content-Disposition": respuesta.headers.get("Content-Disposition") ?? 'attachment; filename="gastos.xlsx"'
    }
  })
}
