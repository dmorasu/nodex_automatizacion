import { fetchApi } from "@/src/lib/api"

// Abre un documento de un trámite del tramitador. El token vive en una cookie
// httpOnly, por eso el archivo pasa por aquí (el backend valida que el trámite sea suyo).
export async function GET(_req: Request, { params }: { params: { tramiteId: string, documentoId: string } }) {
  const respuesta = await fetchApi(`/tramites/${Number(params.tramiteId)}/documentos/${Number(params.documentoId)}/ver`)

  if (!respuesta.ok) {
    return new Response("No se pudo abrir el documento", { status: respuesta.status })
  }

  return new Response(respuesta.body, {
    headers: {
      "Content-Type": respuesta.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": respuesta.headers.get("Content-Disposition") ?? "inline"
    }
  })
}
