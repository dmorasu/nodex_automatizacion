import { cookies } from "next/headers"

// Proxy hacia el backend para las llamadas que se hacen desde el navegador.
// El token de sesión vive en una cookie httpOnly que el navegador no puede leer:
// esta ruta lo agrega como Authorization y reenvía la petición tal cual
// (método, parámetros, cuerpo JSON o archivos) y la respuesta (incluidas descargas).
//   /api/backend/solicitudTramites/filtrar?x=1  →  {API_URL}/solicitudTramites/filtrar?x=1

const ENCABEZADOS_RESPUESTA = ["content-type", "content-disposition", "content-length"]

async function reenviar(req: Request, { params }: { params: { ruta: string[] } }) {
  const { search } = new URL(req.url)
  const destino = `${process.env.API_URL}/${params.ruta.map(encodeURIComponent).join("/")}${search}`

  const token = cookies().get("TOKEN")?.value
  const encabezados: Record<string, string> = {}
  if (token) encabezados.Authorization = `Bearer ${token}`

  // Se conserva el Content-Type original (en archivos lleva el "boundary" del multipart)
  const tipo = req.headers.get("content-type")
  if (tipo) encabezados["Content-Type"] = tipo

  const conCuerpo = !["GET", "HEAD"].includes(req.method)

  const respuesta = await fetch(destino, {
    method: req.method,
    headers: encabezados,
    body: conCuerpo ? await req.arrayBuffer() : undefined,
    cache: "no-store"
  })

  const encabezadosRespuesta = new Headers()
  for (const nombre of ENCABEZADOS_RESPUESTA) {
    const valor = respuesta.headers.get(nombre)
    if (valor) encabezadosRespuesta.set(nombre, valor)
  }

  return new Response(respuesta.body, { status: respuesta.status, headers: encabezadosRespuesta })
}

export { reenviar as GET, reenviar as POST, reenviar as PUT, reenviar as PATCH, reenviar as DELETE }
