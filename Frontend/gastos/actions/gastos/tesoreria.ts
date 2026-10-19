"use server"

import { revalidatePath } from "next/cache"
import { fetchApi, leerErrores } from "@/src/lib/api"
import { LoteDetalleSchema } from "@/src/schemas/gastos"

type Resultado<T = undefined> =
  | { ok: true, datos: T, advertencia?: string }
  | { ok: false, errores: string[] }

export type DatosProgramacion = {
  bolsaId: number
  fechaPago: string
  observacion: string
  gastos: { id: number, valorProgramado: number }[]
}

const refrescarTesoreria = () => revalidatePath("/tesoreria", "layout")

const refrescarPagos = () => {
  refrescarTesoreria()
  revalidatePath("/direccion", "layout")
  revalidatePath("/solicitudes")
}

// Programa el pago: crea el lote y los gastos quedan esperando la aprobación de Dirección de Negocio.
// La bolsa no se descuenta hasta confirmar el pago.
export async function programarPago(datos: DatosProgramacion): Promise<Resultado<{ loteId: number }>> {
  const req = await fetchApi("/gastos/lotes", { method: "POST", body: JSON.stringify(datos) })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  const { loteId } = await req.json()
  refrescarPagos()
  return { ok: true, datos: { loteId } }
}

export type DatosPagoDirecto = {
  bolsaId: number
  fechaPago: string
  observacion: string
  gastos: { id: number, valorRealmentePagado: number }[]
}

// Pago directo (certificados y gastos de anticipos, sin aprobación de Dirección), en un solo paso
// con los soportes: formData = datos (JSON DatosPagoDirecto) + soporte_<gastoId> por cada gasto
// (obligatorio) + archivos del banco para el lote (opcional). Si algo falla no se paga nada
export async function pagarCertificados(formData: FormData): Promise<Resultado<{ loteId: number }>> {
  const req = await fetchApi("/gastos/pagos", { method: "POST", body: formData })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  const { loteId } = await req.json()
  refrescarPagos()
  return { ok: true, datos: { loteId } }
}

// Gastos de los lotes a confirmar (para pedir el soporte de cada uno)
export async function gastosDeLotes(loteIds: number[]) {
  const lotes = await Promise.all(loteIds.map(async id => LoteDetalleSchema.parse(await (await fetchApi(`/gastos/lotes/${id}`)).json())))
  return lotes.flatMap(l => l.gastos.map(g => ({
    id: g.id,
    codigo: g.codigo,
    detalle: `Lote #${l.id} · ${g.beneficiario.nombre} · ${g.conceptoPago}`,
    valor: g.valorProgramado
  })))
}

// Tesorería saca gastos del lote antes de confirmar; vuelven a Por pagar
export async function quitarDelLote(loteId: number, gastoIds: number[], motivo: string): Promise<Resultado<{ estado: string }>> {
  const req = await fetchApi(`/gastos/lotes/${loteId}/quitar`, { method: "POST", body: JSON.stringify({ gastoIds, motivo }) })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  refrescarPagos()
  return { ok: true, datos: await req.json() }
}

// Confirma uno o varios lotes aprobados en un solo paso: cada gasto con su soporte de pago,
// descuenta las bolsas y los gastos quedan PAGADO.
// formData: datos (JSON con loteIds, fechaPago y observacion) + soporte_<gastoId> por gasto
// (obligatorio) + archivos[] del banco para los lotes (opcional)
export async function confirmarLotes(formData: FormData): Promise<Resultado<{ lotes: number, gastos: number }>> {
  const req = await fetchApi("/gastos/lotes/confirmar", { method: "POST", body: formData })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  refrescarPagos()
  return { ok: true, datos: await req.json() }
}

// Con el soporte del banco ya adjunto: descuenta la bolsa y los gastos quedan PAGADO
export async function confirmarPago(loteId: number, fechaPago: string, observacion: string): Promise<Resultado> {
  const req = await fetchApi(`/gastos/lotes/${loteId}/confirmar`, { method: "POST", body: JSON.stringify({ fechaPago, observacion }) })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  refrescarPagos()
  return { ok: true, datos: undefined }
}

export async function subirSoporteLote(loteId: number, soporte: FormData): Promise<Resultado> {
  const req = await fetchApi(`/gastos/lotes/${loteId}/documentos`, { method: "POST", body: soporte })

  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  refrescarTesoreria()
  return { ok: true, datos: undefined }
}

export async function eliminarSoporteLote(documentoId: number): Promise<Resultado> {
  const req = await fetchApi(`/gastos/documentos/${documentoId}`, { method: "DELETE" })

  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  refrescarTesoreria()
  return { ok: true, datos: undefined }
}

// tipo RECARGA (Tesorería, valor positivo) o AJUSTE (solo Admin, valor ±).
// En una bolsa de anticipos el ajuste es al saldo de un cliente (clienteId)
export async function moverSaldoBolsa(
  bolsaId: number,
  tipo: "RECARGA" | "AJUSTE",
  valor: number,
  observacion: string,
  clienteId?: number
): Promise<Resultado<{ saldo: number }>> {
  const req = await fetchApi(`/gastos/bolsas/${bolsaId}/${tipo === "RECARGA" ? "recargas" : "ajustes"}`, {
    method: "POST",
    body: JSON.stringify({ valor, observacion, clienteId })
  })

  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  refrescarTesoreria()
  revalidatePath(`/tesoreria/bolsas/${bolsaId}`)
  return { ok: true, datos: await req.json() }
}
