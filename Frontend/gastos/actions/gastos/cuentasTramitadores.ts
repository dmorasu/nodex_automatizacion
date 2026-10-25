"use server"

import { revalidatePath } from "next/cache"
import { fetchApi, leerErrores } from "@/src/lib/api"

type Resultado = { ok: true } | { ok: false, errores: string[] }

// Marca pagada la cuenta de cobro de un tramitador (FormData: fechaPago, observacion?, soporte?)
export async function pagarCuentaTramitador(id: number, datos: FormData): Promise<Resultado> {
  const req = await fetchApi(`/gastos/cuentas-tramitadores/${id}/pagar`, { method: "POST", body: datos })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }
  revalidatePath("/tesoreria/cuentas-tramitadores", "layout")
  return { ok: true }
}
