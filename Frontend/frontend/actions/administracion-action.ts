"use server"

import { revalidatePath } from "next/cache"
import { encabezadosSesion } from "@/src/lib/sesionApi"

// Administración de usuarios (solo Admin). Usa los endpoints de Administración de Nodex
// Gastos: los usuarios y perfiles son los mismos para trámites y gastos.

type Resultado = { ok: true } | { ok: false, errores: string[] }

export type DatosUsuario = {
  nombreUsuario: string
  correoUsuario: string
  area: string
}

const llamar = async (ruta: string, metodo: string, cuerpo: unknown): Promise<Resultado> => {
  const req = await fetch(`${process.env.API_URL}/gastos/admin${ruta}`, {
    method: metodo,
    headers: { ...encabezadosSesion(), "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    cache: "no-store"
  })

  if (!req.ok) {
    const json = await req.json().catch(() => null)
    const errores: string[] = json?.error ? [json.error] : (json?.errors ?? []).map((e: { msg: string }) => e.msg)
    return { ok: false, errores: errores.length ? errores : ["No se pudo completar la operación"] }
  }

  revalidatePath("/center/admin")
  return { ok: true }
}

export const crearUsuario = async (datos: DatosUsuario & { contrasena: string, roles: string[] }) =>
  llamar("/usuarios", "POST", datos)

export const actualizarUsuario = async (id: number, datos: DatosUsuario) =>
  llamar(`/usuarios/${id}`, "PUT", datos)

export const restablecerContrasena = async (id: number, contrasena: string) =>
  llamar(`/usuarios/${id}/contrasena`, "PUT", { contrasena })

export const asignarPerfiles = async (id: number, roles: string[]) =>
  llamar(`/usuarios/${id}/roles`, "PUT", { roles })

// Quita el bloqueo por intentos fallidos en el login
export const desbloquearUsuario = async (id: number) =>
  llamar(`/usuarios/${id}/desbloquear`, "POST", {})
