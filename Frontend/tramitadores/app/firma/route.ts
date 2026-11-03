import { fetchApi } from "@/src/lib/api"

// Firma guardada del tramitador en sesión (para mostrarla antes de aprobar)
export async function GET() {
  const respuesta = await fetchApi("/firma")

  if (!respuesta.ok) {
    return new Response("Sin firma", { status: respuesta.status })
  }

  return new Response(respuesta.body, {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" }
  })
}
