"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { fetchApi, leerErrores } from "@/src/lib/api"
import { TerceroSchema, TramiteApoyoSchema, type DatosGasto } from "@/src/schemas/gastos"
import type { ProgramacionPago } from "@/components/gastos/avisoProgramacion"

type Resultado<T = undefined> =
  | { ok: true, datos: T }
  | { ok: false, errores: string[] }

// Crea (sin id) o actualiza (con id) un gasto
// avisoSaldo: el gasto de un anticipo supera lo que le queda al cliente (se crea igual)
// programacion: al crear, cuándo lo programa Tesorería para pago (null en caja menor)
export async function guardarGasto(datos: DatosGasto, id?: number): Promise<Resultado<{ id: number, codigo: string, avisoSaldo: string | null, programacion: ProgramacionPago | null }>> {
  const req = await fetchApi(id ? `/gastos/solicitudes/${id}` : "/gastos/solicitudes", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(datos)
  })

  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  const json = await req.json()
  revalidatePath("/solicitudes")
  if (datos.anticipoId) revalidatePath(`/anticipos/${datos.anticipoId}`)

  return { ok: true, datos: { id: json.id, codigo: json.codigo, avisoSaldo: json.avisoSaldo ?? null, programacion: json.programacion ?? null } }
}

export async function anularGasto(id: number, motivo: string): Promise<Resultado> {
  const req = await fetchApi(`/gastos/solicitudes/${id}/anular`, {
    method: "POST",
    body: JSON.stringify({ motivo })
  })

  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  revalidatePath(`/solicitudes/${id}`)
  return { ok: true, datos: undefined }
}

// Administrador de Gastos: corrige el valor de un gasto pagado; el backend ajusta la bolsa por la diferencia
export async function corregirValorPagado(id: number, datos: { valorSolicitado: number, valorPagado: number, motivo: string }): Promise<Resultado> {
  const req = await fetchApi(`/gastos/solicitudes/${id}/valor-pagado`, {
    method: "PUT",
    body: JSON.stringify(datos)
  })

  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  revalidatePath(`/solicitudes/${id}`)
  return { ok: true, datos: undefined }
}

export async function buscarTerceros(busqueda: string) {
  if (busqueda.trim().length < 3) return []

  const req = await fetchApi(`/gastos/terceros?busqueda=${encodeURIComponent(busqueda.trim())}`)
  if (!req.ok) return []

  return z.array(TerceroSchema).parse(await req.json())
}

export async function consultarTramite(id: number): Promise<Resultado<z.infer<typeof TramiteApoyoSchema>>> {
  const req = await fetchApi(`/gastos/apoyo/tramites/${id}`)

  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  return { ok: true, datos: TramiteApoyoSchema.parse(await req.json()) }
}

// ── Documentos ─────────────────────────────

// formData: archivos (varios) + tipoDocumentoId
export async function subirDocumentos(gastoId: number, formData: FormData): Promise<Resultado> {
  const req = await fetchApi(`/gastos/solicitudes/${gastoId}/documentos`, {
    method: "POST",
    body: formData
  })

  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  revalidatePath(`/solicitudes/${gastoId}`)
  return { ok: true, datos: undefined }
}

export async function eliminarDocumento(documentoId: number, gastoId: number): Promise<Resultado> {
  const req = await fetchApi(`/gastos/documentos/${documentoId}`, { method: "DELETE" })

  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  revalidatePath(`/solicitudes/${gastoId}`)
  return { ok: true, datos: undefined }
}
