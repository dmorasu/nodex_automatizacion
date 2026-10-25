import { fetchApi } from "@/src/lib/api"

// Abre un archivo que subió el propio tramitador. El token vive en una cookie
// httpOnly, por eso el archivo pasa por aquí (el backend valida que sea suyo).
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const respuesta = await fetchApi(`/soportes/archivos/${Number(params.id)}/ver`)

  if (!respuesta.ok) {
    return new Response("No se pudo abrir el archivo", { status: respuesta.status })
  }

  return new Response(respuesta.body, {
    headers: {
      "Content-Type": respuesta.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": respuesta.headers.get("Content-Disposition") ?? "inline"
    }
  })
}
