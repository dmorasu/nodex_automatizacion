import { fetchApi } from "@/src/lib/api"

// Abre un documento de gasto en el navegador. El backend exige el token,
// que vive en una cookie httpOnly, por eso el archivo pasa por aquí.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const respuesta = await fetchApi(`/gastos/documentos/${Number(params.id)}/ver`)

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
