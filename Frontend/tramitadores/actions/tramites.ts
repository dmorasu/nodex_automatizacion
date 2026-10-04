"use server"

import { revalidatePath } from "next/cache"
import { fetchApi, leerErrores } from "@/src/lib/api"

type Resultado = { ok: true, mensaje: string } | { ok: false, errores: string[] }

const enviar = async (ruta: string, cuerpo: object, tramiteId: number): Promise<Resultado> => {
  const req = await fetchApi(ruta, { method: "POST", body: JSON.stringify(cuerpo) })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  revalidatePath(`/tramites/${tramiteId}`)
  revalidatePath("/tramites")
  return { ok: true, mensaje: await req.json() }
}

// Comentario para el equipo (Gestión de activos / Torre de control)
export const comentarTramite = async (tramiteId: number, comentario: string) =>
  enviar(`/tramites/${tramiteId}/comentarios`, { comentario }, tramiteId)

// Documentos soporte del trámite (FormData: archivos[]). Se ven también en Nodex Trámites
export async function subirDocumentosTramite(tramiteId: number, datos: FormData): Promise<Resultado> {
  const req = await fetchApi(`/tramites/${tramiteId}/documentos`, { method: "POST", body: datos })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  revalidatePath(`/tramites/${tramiteId}`)
  return { ok: true, mensaje: await req.json() }
}

// Reporta el trámite como realizado. No cambia el estado: el equipo lo revisa
export const reportarRealizado = async (tramiteId: number, observacion: string) =>
  enviar(`/tramites/${tramiteId}/realizado`, { observacion }, tramiteId)
