"use server"

import { revalidatePath } from "next/cache"
import { fetchApi, leerErrores } from "@/src/lib/api"

type Resultado = { ok: true } | { ok: false, errores: string[] }

const refrescar = () => {
  revalidatePath("/tesoreria/caja-menor", "layout")
  revalidatePath("/direccion/caja-menor", "layout")
  revalidatePath("/inicio")
}

// JSON o multipart (FormData con datos + archivos)
const enviar = async (ruta: string, cuerpo?: object | FormData, metodo: "POST" | "PUT" = "POST"): Promise<Resultado> => {
  const req = await fetchApi(`/gastos/caja-menor/${ruta}`, {
    method: metodo,
    ...(cuerpo ? { body: cuerpo instanceof FormData ? cuerpo : JSON.stringify(cuerpo) } : {})
  })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }
  refrescar()
  return { ok: true }
}

// ── Cajas y usuarios (Tesorería) ──

export async function guardarCaja(datos: { nombre?: string, fondo?: number, topeAlerta?: number, activo?: boolean }, id?: number) {
  const resultado = await enviar(id ? `cajas/${id}` : "cajas", datos, id ? "PUT" : "POST")
  revalidatePath("/tesoreria/bolsas")
  return resultado
}

export async function asignarCaja(usuarioId: number, bolsaId: number | null) {
  return enviar(`usuarios/${usuarioId}`, { bolsaId }, "PUT")
}

// ── Gastos ──

export async function pagarConCaja(datos: { bolsaId: number, fechaPago: string, observacion?: string | null, gastos: { id: number, valorEntregado: number }[] }) {
  return enviar("pagar", datos)
}

// formData: datos (JSON con la factura) + archivos[] (soporte obligatorio)
export async function legalizarGastoCaja(gastoId: number, formData: FormData) {
  const resultado = await enviar(`gastos/${gastoId}/legalizar`, formData)
  revalidatePath(`/solicitudes/${gastoId}`)
  return resultado
}

export async function deshacerLegalizacionCaja(gastoId: number) {
  const resultado = await enviar(`gastos/${gastoId}/deshacer`)
  revalidatePath(`/solicitudes/${gastoId}`)
  return resultado
}

// ── Reembolsos ──

export async function crearReembolso(datos: { bolsaId: number, gastoIds: number[], observacion?: string | null }): Promise<{ ok: true, id: number } | { ok: false, errores: string[] }> {
  const req = await fetchApi("/gastos/caja-menor/reembolsos", { method: "POST", body: JSON.stringify(datos) })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }
  refrescar()
  return { ok: true, id: (await req.json()).id }
}

export async function quitarDelReembolso(id: number, gastoIds: number[]) {
  return enviar(`reembolsos/${id}/quitar`, { gastoIds })
}

export async function enviarReembolso(id: number) {
  return enviar(`reembolsos/${id}/enviar`)
}

export async function anularReembolso(id: number) {
  return enviar(`reembolsos/${id}/anular`)
}

export async function aprobarReembolso(id: number) {
  return enviar(`reembolsos/${id}/aprobar`)
}

export async function rechazarReembolso(id: number, motivo: string) {
  return enviar(`reembolsos/${id}/rechazar`, { motivo })
}

// formData: datos ({ fechaLegalizacion, observacion }) + archivos[] (soporte obligatorio)
export async function legalizarReembolso(id: number, formData: FormData) {
  return enviar(`reembolsos/${id}/legalizar`, formData)
}
