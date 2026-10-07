import { fetchApi } from "@/src/lib/api"

// Excel del arqueo de una bolsa de anticipos (?bolsaId=&busqueda=&filtro=&orden=) o del estado de
// cuenta de un cliente (?bolsaId=&clienteId=&desde=&hasta=). Pasa por aquí porque el backend
// exige el token, que vive en una cookie httpOnly.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const bolsaId = Number(params.get("bolsaId"))
  const clienteId = Number(params.get("clienteId"))
  params.delete("bolsaId")
  params.delete("clienteId")

  const ruta = clienteId
    ? `/gastos/bolsas/${bolsaId}/clientes/${clienteId}/exportar?${params}`
    : `/gastos/bolsas/${bolsaId}/clientes/exportar?${params}`
  const respuesta = await fetchApi(ruta)

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
      "Content-Disposition": respuesta.headers.get("Content-Disposition") ?? 'attachment; filename="arqueo.xlsx"'
    }
  })
}
