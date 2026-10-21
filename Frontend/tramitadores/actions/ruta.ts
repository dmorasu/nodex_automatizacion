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

// Posición del mensajero mientras tiene la ruta iniciada (sin revalidar: no cambia la pantalla)
export async function enviarUbicacion(latitud: number, longitud: number, precision: number | null): Promise<Resultado> {
  const req = await fetchApi("/ruta/ubicacion", { method: "POST", body: JSON.stringify({ latitud, longitud, precision }) })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }
  return { ok: true }
}

type Gps = { latitud?: number, longitud?: number }

const accionRuta = async (ruta: string, cuerpo: object = {}): Promise<Resultado> => {
  const req = await fetchApi(ruta, { method: "POST", body: JSON.stringify(cuerpo) })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }
  revalidatePath("/ruta")
  return { ok: true }
}

// Rutas del día (PESV): inicio y fin de la ruta, almuerzo e inicio de cada diligencia
export const iniciarJornada = async (gps: Gps) => accionRuta("/ruta/jornada/iniciar", gps)
export const finalizarJornada = async (gps: Gps) => accionRuta("/ruta/jornada/finalizar", gps)
export const marcarAlmuerzo = async (accion: "iniciar" | "terminar") => accionRuta(`/ruta/jornada/almuerzo/${accion}`)
export const iniciarDiligencia = async (paradaId: number, gps: Gps) => accionRuta(`/ruta/paradas/${paradaId}/iniciar`, gps)
