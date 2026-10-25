"use server"

import { revalidatePath } from "next/cache"
import { encabezadosSesion } from "@/src/lib/sesionApi"

// Asignación de analistas: solo Administrador de Torre de control (y Admin).
// El backend vuelve a validar el permiso.

type Resultado<T = undefined> = { ok: true, datos: T } | { ok: false, errores: string[] }

const leerErrores = async (req: Response, porDefecto: string) => {
  const json = await req.json().catch(() => null)
  const errores: string[] = json?.error ? [json.error] : (json?.errors ?? []).map((e: { msg: string }) => e.msg)
  return errores.length ? errores : [porDefecto]
}

const llamar = async (ruta: string, metodo: string, cuerpo: unknown) =>
  fetch(`${process.env.API_URL}/solicitudTramites${ruta}`, {
    method: metodo,
    headers: { ...(await encabezadosSesion()), "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    cache: "no-store"
  })

// Cambia el analista de un trámite (null = sin analista)
export async function asignarAnalista(solicitudId: number, analistaId: number | null): Promise<Resultado> {
  const req = await llamar(`/${solicitudId}/analista`, "PATCH", { analistaId })
  if (!req.ok) return { ok: false, errores: await leerErrores(req, "No se pudo asignar el analista") }

  revalidatePath(`/center/solicitudTramites/${solicitudId}`)
  return { ok: true, datos: undefined }
}

// Pasa todos los trámites abiertos de un analista a otro (null = sin analista)
export async function reasignarTramites(desdeId: number | null, haciaId: number | null): Promise<Resultado<{ actualizados: number }>> {
  const req = await llamar("/analistas/reasignar", "POST", { desdeId, haciaId })
  if (!req.ok) return { ok: false, errores: await leerErrores(req, "No se pudieron reasignar los trámites") }

  revalidatePath("/center/analistas")
  return { ok: true, datos: await req.json() }
}

// Analista por defecto de varios municipios (solo afecta a los trámites nuevos)
export async function asignarAnalistaMunicipios(municipioIds: number[], analistaId: number | null): Promise<Resultado<{ actualizados: number }>> {
  const req = await llamar("/analistas/municipios", "PUT", { municipioIds, analistaId })
  if (!req.ok) return { ok: false, errores: await leerErrores(req, "No se pudo actualizar el analista de los municipios") }

  revalidatePath("/center/analistas")
  return { ok: true, datos: await req.json() }
}
