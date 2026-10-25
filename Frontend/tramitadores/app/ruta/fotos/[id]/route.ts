import { fetchApi } from "@/src/lib/api"

// Foto de una visita del propio mensajero (el token vive en una cookie httpOnly)
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const respuesta = await fetchApi(`/ruta/paradas/${Number(params.id)}/foto`)

  if (!respuesta.ok) {
    return new Response("No se pudo abrir la foto", { status: respuesta.status })
  }

  return new Response(respuesta.body, {
    headers: { "Content-Type": respuesta.headers.get("Content-Type") ?? "image/jpeg" }
  })
}
