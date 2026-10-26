import { fetchApi } from "@/src/lib/api"

// Cargue masivo de gastos: pasa por aquí porque el backend exige el token, que vive en una
// cookie httpOnly. GET plantilla → Excel; POST validar | cargar → JSON del backend.
const RUTA = "/gastos/cargue-masivo"

export async function GET(_req: Request, { params }: { params: Promise<{ accion: string }> }) {
  const { accion } = await params
  if (accion !== "plantilla") return new Response("No encontrado", { status: 404 })

  const respuesta = await fetchApi(`${RUTA}/plantilla`)

  if (!respuesta.ok) {
    const json = await respuesta.json().catch(() => null)
    return new Response(json?.error ?? "No se pudo generar la plantilla", {
      status: respuesta.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    })
  }

  return new Response(respuesta.body, {
    headers: {
      "Content-Type": respuesta.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": respuesta.headers.get("Content-Disposition") ?? 'attachment; filename="plantilla_gastos.xlsx"'
    }
  })
}

export async function POST(req: Request, { params }: { params: Promise<{ accion: string }> }) {
  const { accion } = await params
  if (accion !== "validar" && accion !== "cargar") return Response.json({ error: "No encontrado" }, { status: 404 })

  const respuesta = await fetchApi(`${RUTA}/${accion}`, { method: "POST", body: await req.formData() })
  const json = await respuesta.json().catch(() => ({ error: "No se pudo procesar el archivo" }))

  return Response.json(json, { status: respuesta.status })
}
