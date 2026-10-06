"use server"

import { revalidatePath } from "next/cache"
import { fetchApi, leerErrores } from "@/src/lib/api"

type Resultado<T = undefined> =
  | { ok: true, datos: T }
  | { ok: false, errores: string[] }

const refrescar = () => {
  revalidatePath("/direccion", "layout")
  revalidatePath("/tesoreria", "layout")
}

// Dirección de Negocio aprueba gastos del lote (sin lista: todos los pendientes)
export async function aprobarGastosLote(loteId: number, gastoIds: number[] | null): Promise<Resultado<{ estado: string }>> {
  const req = await fetchApi(`/gastos/lotes/${loteId}/aprobar`, { method: "POST", body: JSON.stringify({ gastoIds }) })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  refrescar()
  return { ok: true, datos: await req.json() }
}

// Rechaza gastos del lote con el motivo; vuelven a Por pagar en Tesorería
export async function rechazarGastosLote(loteId: number, gastoIds: number[], motivo: string): Promise<Resultado<{ estado: string }>> {
  const req = await fetchApi(`/gastos/lotes/${loteId}/rechazar`, { method: "POST", body: JSON.stringify({ gastoIds, motivo }) })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  refrescar()
  return { ok: true, datos: await req.json() }
}
