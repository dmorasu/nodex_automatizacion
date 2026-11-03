import { fetchApi } from "@/src/lib/api"

// PDF de una cuenta de cobro del propio tramitador (el token vive en una cookie httpOnly)
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const respuesta = await fetchApi(`/cuentas-cobro/${Number(params.id)}/pdf`)

  if (!respuesta.ok) {
    return new Response("No se pudo abrir la cuenta de cobro", { status: respuesta.status })
  }

  return new Response(respuesta.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": respuesta.headers.get("Content-Disposition") ?? "inline"
    }
  })
}
