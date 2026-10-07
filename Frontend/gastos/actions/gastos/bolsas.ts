"use server"

import { revalidatePath } from "next/cache"
import { fetchApi, leerErrores } from "@/src/lib/api"

type Resultado = { ok: true } | { ok: false, errores: string[] }

type DatosBolsa = {
  nombre?: string
  lineaNegocio?: string | null
  // Solo al crear: GENERAL | ANTICIPOS
  tipo?: string
  activo?: boolean
}

// Crea (sin id) o actualiza (con id) una bolsa
export async function guardarBolsa(datos: DatosBolsa, id?: number): Promise<Resultado> {
  const req = await fetchApi(id ? `/gastos/bolsas/${id}` : "/gastos/bolsas", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(datos)
  })

  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  revalidatePath("/tesoreria")
  return { ok: true }
}
