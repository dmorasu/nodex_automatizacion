"use server"

import { revalidatePath } from "next/cache"
import { fetchApi, leerErrores } from "@/src/lib/api"

type Resultado = { ok: true } | { ok: false, errores: string[] }

const refrescar = () => {
  revalidatePath("/contabilidad", "layout")
  revalidatePath("/tesoreria", "layout")
  revalidatePath("/legalizacion", "layout")
  revalidatePath("/solicitudes", "layout")
}

// Número de egreso de un pago (lote): queda en el lote y en sus gastos
export async function registrarEgreso(loteId: number, numeroEgreso: string): Promise<Resultado> {
  const req = await fetchApi(`/gastos/lotes/${loteId}/egreso`, {
    method: "PUT",
    body: JSON.stringify({ numeroEgreso })
  })

  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  refrescar()
  return { ok: true }
}

// Contabiliza una o varias cuentas de cobro legalizadas, cada una con su documento contable
export async function contabilizarCuentas(
  cuentas: { id: number, documentoContable: string }[],
  fechaContabilizacion: string
): Promise<Resultado> {
  const req = await fetchApi("/gastos/contabilidad/contabilizar", {
    method: "POST",
    body: JSON.stringify({ cuentas, fechaContabilizacion })
  })

  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  refrescar()
  return { ok: true }
}

// Contabiliza gastos NO reembolsables legalizados (no pasan por cuenta de cobro)
export async function contabilizarGastos(
  gastos: { id: number, documentoContable: string }[],
  fechaContabilizacion: string
): Promise<Resultado> {
  const req = await fetchApi("/gastos/contabilidad/contabilizar-gastos", {
    method: "POST",
    body: JSON.stringify({ gastos, fechaContabilizacion })
  })

  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  refrescar()
  return { ok: true }
}
