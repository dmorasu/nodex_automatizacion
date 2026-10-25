import { fetchApi } from "@/src/lib/api"

// PDF de la cuenta de cobro de un tramitador (cuenta, anexo y distribución) o su soporte de pago.
// El backend exige el token, que vive en una cookie httpOnly, por eso pasa por aquí.
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const archivo = new URL(req.url).searchParams.get("archivo") === "soporte" ? "soporte-pago" : "pdf"
  const respuesta = await fetchApi(`/gastos/cuentas-tramitadores/${Number(params.id)}/${archivo}`)

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
