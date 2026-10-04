"use server"

import { revalidatePath } from "next/cache"
import { fetchApi, leerErrores } from "@/src/lib/api"

type Resultado = { ok: true } | { ok: false, errores: string[] }

// Confirma una visita (FormData: estado, observacion?, latitud?, longitud?, precision?, foto?)
export async function confirmarVisita(paradaId: number, datos: FormData): Promise<Resultado> {
  const req = await fetchApi(`/ruta/paradas/${paradaId}/confirmar`, { method: "POST", body: datos })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  revalidatePath("/ruta")
  return { ok: true }
}
