"use server"

import { revalidatePath } from "next/cache"
import { fetchApi, leerErrores } from "@/src/lib/api"

type Resultado = { ok: true } | { ok: false, errores: string[] }

const enviar = async (ruta: string, cuerpo?: unknown): Promise<Resultado> => {
  const req = await fetchApi(ruta, { method: ruta === "/firma" ? "PUT" : "POST", body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }
  revalidatePath("/cuentas-cobro", "layout")
  return { ok: true }
}

// Firma dibujada en la pantalla (PNG en base64)
export async function guardarFirma(imagen: string) {
  return enviar("/firma", { imagen })
}

export async function aprobarCuenta(id: number) {
  return enviar(`/cuentas-cobro/${id}/aprobar`)
}

export async function pedirCorreccion(id: number, comentario: string) {
  return enviar(`/cuentas-cobro/${id}/corregir`, { comentario })
}

// Adicional con soporte (FormData: solicitudTramiteId, concepto, fecha, valor, soporte)
export async function agregarAdicional(id: number, datos: FormData): Promise<Resultado> {
  const req = await fetchApi(`/cuentas-cobro/${id}/adicionales`, { method: "POST", body: datos })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }
  revalidatePath("/cuentas-cobro", "layout")
  return { ok: true }
}
