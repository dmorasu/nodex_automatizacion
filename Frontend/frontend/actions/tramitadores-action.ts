"use server"

import { revalidatePath } from "next/cache"
import { encabezadosSesion } from "@/src/lib/sesionApi"

type Resultado = { ok: true } | { ok: false, errores: string[] }

export type DatosTramitador = {
  nombreTramitador: string
  identificacion: string
  correoTramitador: string
  numeroTramitador: string
  region: string
  activo: boolean
  // Mensajero: tiene ruta diaria; sale de la sede indicada
  esMensajero?: boolean
  sedeId?: number | null
  // Datos de la cuenta de cobro (salen en el PDF; se exigen al enviarla)
  direccion?: string | null
  ciudad?: string | null
  banco?: string | null
  tipoCuenta?: string | null
  numeroCuenta?: string | null
  declaracionArt383?: boolean
}

// Crea (sin id) o actualiza (con id) un tramitador. Solo Torre de control.
export async function guardarTramitador(datos: DatosTramitador, id?: number): Promise<Resultado> {
  const req = await fetch(`${process.env.API_URL}/tramitador${id ? `/${id}` : ""}`, {
    method: id ? "PUT" : "POST",
    headers: { ...(await encabezadosSesion()), "Content-Type": "application/json" },
    body: JSON.stringify(datos),
    cache: "no-store"
  })

  if (!req.ok) {
    const json = await req.json().catch(() => null)
    const errores: string[] = json?.error ? [json.error] : (json?.errors ?? []).map((e: { msg: string }) => e.msg)
    return { ok: false, errores: errores.length ? errores : ["No se pudo guardar el tramitador"] }
  }

  revalidatePath("/center/catalogos")
  return { ok: true }
}

const leerErrores = async (req: Response, porDefecto: string) => {
  const json = await req.json().catch(() => null)
  const errores: string[] = json?.error ? [json.error] : (json?.errors ?? []).map((e: { msg: string }) => e.msg)
  return errores.length ? errores : [porDefecto]
}

export type AccesoCreado = { usuario: string, contrasenaTemporal: string, restablecido: boolean }

// Crea el acceso a la app Nodex Tramitadores o restablece su contraseña.
// La contraseña temporal solo se recibe aquí: no se puede volver a consultar.
export async function crearAccesoApp(id: number): Promise<{ ok: true, datos: AccesoCreado } | { ok: false, errores: string[] }> {
  const req = await fetch(`${process.env.API_URL}/tramitador/${id}/acceso`, {
    method: "POST",
    headers: await encabezadosSesion(),
    cache: "no-store"
  })

  if (!req.ok) return { ok: false, errores: await leerErrores(req, "No se pudo crear el acceso") }

  revalidatePath("/center/catalogos")
  return { ok: true, datos: await req.json() }
}

// Quita el acceso a la app: sus sesiones abiertas se cierran
export async function quitarAccesoApp(id: number): Promise<Resultado> {
  const req = await fetch(`${process.env.API_URL}/tramitador/${id}/acceso`, {
    method: "DELETE",
    headers: await encabezadosSesion(),
    cache: "no-store"
  })

  if (!req.ok) return { ok: false, errores: await leerErrores(req, "No se pudo quitar el acceso") }

  revalidatePath("/center/catalogos")
  return { ok: true }
}
