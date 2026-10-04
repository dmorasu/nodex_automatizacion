"use server"

import { revalidatePath } from "next/cache"
import { encabezadosSesion } from "@/src/lib/sesionApi"

type Resultado = { ok: true } | { ok: false, errores: string[] }

const enviar = async (ruta: string, cuerpo: object, porDefecto: string): Promise<Resultado> => {
  const req = await fetch(`${process.env.API_URL}/seguimiento-tramitador${ruta}`, {
    method: "POST",
    headers: { ...encabezadosSesion(), "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    cache: "no-store"
  })

  if (!req.ok) {
    const json = await req.json().catch(() => null)
    const errores: string[] = json?.error ? [json.error] : (json?.errors ?? []).map((e: { msg: string }) => e.msg)
    return { ok: false, errores: errores.length ? errores : [porDefecto] }
  }
  return { ok: true }
}

// Respuesta del equipo interno en la conversación con el tramitador
export async function comentarAlTramitador(solicitudTramiteId: number, comentario: string): Promise<Resultado> {
  const resultado = await enviar(`/tramites/${solicitudTramiteId}/comentarios`, { comentario }, "No se pudo enviar el comentario")
  if (resultado.ok) revalidatePath(`/center/solicitudTramites/${solicitudTramiteId}`)
  return resultado
}

// Marca como revisado un reporte de "realizado". El estado del trámite se cambia aparte
export async function revisarReporteRealizado(reporteId: number, solicitudTramiteId: number, nota: string): Promise<Resultado> {
  const resultado = await enviar(`/reportes-realizado/${reporteId}/revisar`, { nota }, "No se pudo marcar como revisado")
  if (resultado.ok) {
    revalidatePath(`/center/solicitudTramites/${solicitudTramiteId}`)
    revalidatePath("/center/reportesRealizado")
  }
  return resultado
}
