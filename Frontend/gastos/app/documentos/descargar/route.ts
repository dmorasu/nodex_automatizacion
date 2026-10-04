import { fetchApi } from "@/src/lib/api"

// Descarga masiva: ZIP con los documentos de los gastos seleccionados.
// El token vive en una cookie httpOnly, por eso la petición pasa por aquí.
export async function POST(req: Request) {
  const respuesta = await fetchApi("/gastos/documentos/descargar", {
    method: "POST",
    body: JSON.stringify(await req.json())
  })

  if (!respuesta.ok) {
    const json = await respuesta.json().catch(() => null)
    const error = json?.error ?? json?.errors?.[0]?.msg ?? "No se pudieron descargar los documentos"
    return Response.json({ error }, { status: respuesta.status })
  }

  const encabezados = new Headers({
    "Content-Type": "application/zip",
    "Content-Disposition": respuesta.headers.get("Content-Disposition") ?? 'attachment; filename="documentos.zip"'
  })
  for (const nombre of ["X-Gastos", "X-Archivos", "X-Faltantes"]) {
    const valor = respuesta.headers.get(nombre)
    if (valor) encabezados.set(nombre, valor)
  }

  return new Response(respuesta.body, { headers: encabezados })
}
