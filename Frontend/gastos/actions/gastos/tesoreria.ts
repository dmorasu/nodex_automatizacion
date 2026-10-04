"use server"

import { revalidatePath } from "next/cache"
import { fetchApi, leerErrores } from "@/src/lib/api"

type Resultado<T = undefined> =
  | { ok: true, datos: T, advertencia?: string }
  | { ok: false, errores: string[] }

export type DatosPago = {
  bolsaId: number
  fechaPago: string
  observacion: string
  gastos: { id: number, valorRealmentePagado: number }[]
}

const refrescarTesoreria = () => revalidatePath("/tesoreria", "layout")

// Paga los gastos en un lote y luego sube el soporte (si se adjuntó).
// Si el pago se registra pero el soporte falla, el pago se mantiene y se avisa.
export async function pagarGastos(datos: DatosPago, soporte: FormData | null): Promise<Resultado<{ loteId: number }>> {
  const req = await fetchApi("/gastos/pagos", {
    method: "POST",
    body: JSON.stringify(datos)
  })

  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  const { loteId } = await req.json()
  refrescarTesoreria()
  revalidatePath("/solicitudes")

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
