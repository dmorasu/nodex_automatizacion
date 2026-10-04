"use server"

import { revalidatePath } from "next/cache"
import { fetchApi, leerErrores } from "@/src/lib/api"

type Resultado = { ok: true, mensaje: string } | { ok: false, errores: string[] }

// Sube la factura o el comprobante de un reintegro (FormData: archivos[], tipo, reintegroId?, observacion?).
// Queda pendiente de revisión por Legalización.
export async function subirSoporte(gastoId: number, datos: FormData): Promise<Resultado> {
  const req = await fetchApi(`/gastos/${gastoId}/soportes`, { method: "POST", body: datos })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  revalidatePath(`/gastos/${gastoId}`)
  revalidatePath("/gastos")
  revalidatePath("/inicio")
  return { ok: true, mensaje: await req.json() }
}
