"use server"

import { revalidatePath } from "next/cache"
import { fetchApi, leerErrores } from "@/src/lib/api"

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

// Compras de certificados: se pagan directo (sin aprobación de Dirección) y luego se sube el
// soporte si se adjuntó. Si el pago queda pero el soporte falla, se mantiene el pago y se avisa.
export async function pagarCertificados(datos: DatosPagoDirecto, soporte: FormData | null): Promise<Resultado<{ loteId: number }>> {
  const req = await fetchApi("/gastos/pagos", { method: "POST", body: JSON.stringify(datos) })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  const { loteId } = await req.json()
  refrescarPagos()

  if (soporte && soporte.getAll("archivos").length > 0) {
    const reqSoporte = await fetchApi(`/gastos/lotes/${loteId}/documentos`, { method: "POST", body: soporte })
    if (!reqSoporte.ok) {
      const [error] = await leerErrores(reqSoporte)
      return {
        ok: true,
        datos: { loteId },
        advertencia: `El pago quedó registrado (lote #${loteId}), pero el soporte no se pudo subir: ${error}. Súbalo desde Pagos realizados.`
      }
    }
  }

  return { ok: true, datos: { loteId } }
}

// Tesorería saca gastos del lote antes de confirmar; vuelven a Por pagar
export async function quitarDelLote(loteId: number, gastoIds: number[], motivo: string): Promise<Resultado<{ estado: string }>> {
  const req = await fetchApi(`/gastos/lotes/${loteId}/quitar`, { method: "POST", body: JSON.stringify({ gastoIds, motivo }) })
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

// tipo RECARGA (Tesorería, valor positivo) o AJUSTE (solo Admin, valor ±)
export async function moverSaldoBolsa(
  bolsaId: number,
  tipo: "RECARGA" | "AJUSTE",
  valor: number,
  observacion: string
): Promise<Resultado<{ saldo: number }>> {
  const req = await fetchApi(`/gastos/bolsas/${bolsaId}/${tipo === "RECARGA" ? "recargas" : "ajustes"}`, {
    method: "POST",
    body: JSON.stringify({ valor, observacion })
  })

  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  refrescarTesoreria()
  return { ok: true, datos: await req.json() }
}
