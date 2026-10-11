"use server"

import { revalidatePath } from "next/cache"
import { fetchApi, leerErrores } from "@/src/lib/api"
import { EstadoCuentaClienteSchema, type EstadoCuentaCliente } from "@/src/schemas/gastos"

type Resultado<T = undefined> =
  | { ok: true, datos: T }
  | { ok: false, errores: string[] }

const enviar = async (ruta: string, metodo: "POST" | "PUT", cuerpo: object): Promise<Resultado> => {
  const req = await fetchApi(ruta, { method: metodo, body: JSON.stringify(cuerpo) })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }
  revalidatePath("/anticipos")
  revalidatePath("/contabilidad/anticipos")
  revalidatePath("/contabilidad/facturas")
  return { ok: true, datos: undefined }
}

// Crea (sin id) o corrige (con id) un anticipo.
// formData: datos (JSON con los campos) + archivos[] (soporte de la consignación)
export async function guardarAnticipo(formData: FormData, id?: number): Promise<Resultado<{ id: number, reenviado: boolean }>> {
  const req = await fetchApi(id ? `/gastos/anticipos/${id}` : "/gastos/anticipos", {
    method: id ? "PUT" : "POST",
    body: formData
  })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  const json = await req.json()
  revalidatePath("/anticipos")
  if (id) revalidatePath(`/anticipos/${id}`)
  return { ok: true, datos: { id: json.id, reenviado: Boolean(json.reenviado) } }
}

export async function anularAnticipo(id: number, motivo: string) {
  const resultado = await enviar(`/gastos/anticipos/${id}/anular`, "POST", { motivo })
  revalidatePath(`/anticipos/${id}`)
  return resultado
}

// Quita un soporte mientras el anticipo se puede corregir
export async function eliminarSoporteAnticipo(documentoId: number, anticipoId: number): Promise<Resultado> {
  const req = await fetchApi(`/gastos/documentos/${documentoId}`, { method: "DELETE" })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }
  revalidatePath(`/anticipos/${anticipoId}`)
  return { ok: true, datos: undefined }
}

// ── Contabilidad ──

export async function marcarNovedadAnticipo(id: number, motivo: string) {
  const resultado = await enviar(`/gastos/anticipos/${id}/novedad`, "POST", { motivo })
  revalidatePath(`/anticipos/${id}`)
  return resultado
}

export type Confirmacion = { id: number, valorRecibido: number, reciboCaja: string, observacion?: string | null }

// Uno o varios a la vez (todos o ninguno)
export async function confirmarAnticipos(anticipos: Confirmacion[]) {
  const resultado = await enviar("/gastos/anticipos/confirmar", "POST", { anticipos })
  anticipos.forEach(a => revalidatePath(`/anticipos/${a.id}`))
  revalidatePath("/tesoreria/bolsas")
  return resultado
}

// Solicitudes de factura: confirma el pago y factura una o varias (todas o ninguna).
// formData: datos (JSON { solicitudes: [{ id, valorRecibido, numeroFactura, observacion }] }) + pdf_<id> y xml_<id>
export async function facturarSolicitudes(formData: FormData, ids: number[]): Promise<Resultado> {
  const req = await fetchApi("/gastos/anticipos/facturar", { method: "POST", body: formData })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }
  revalidatePath("/anticipos")
  revalidatePath("/contabilidad/facturas")
  ids.forEach(id => revalidatePath(`/anticipos/${id}`))
  revalidatePath("/tesoreria/bolsas")
  return { ok: true, datos: undefined }
}

// Estado de cuenta de un cliente en una bolsa de anticipos (panel del arqueo). Fechas YYYY-MM-DD
export async function consultarEstadoDeCuenta(bolsaId: number, clienteId: number, desde?: string, hasta?: string): Promise<Resultado<EstadoCuentaCliente>> {
  const params = new URLSearchParams()
  if (desde) params.set("desde", desde)
  if (hasta) params.set("hasta", hasta)
  const req = await fetchApi(`/gastos/bolsas/${bolsaId}/clientes/${clienteId}?${params}`)
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }
  return { ok: true, datos: EstadoCuentaClienteSchema.parse(await req.json()) }
}
