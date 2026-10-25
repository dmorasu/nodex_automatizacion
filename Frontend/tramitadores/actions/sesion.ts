"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { CambioContrasenaSchema, ErrorRespuestaSchema, InicioSesionSchema, RespuestaLoginSchema } from "@/src/schemas"
import { DURACION_COOKIE, NOMBRE_COOKIE } from "@/src/auth/sesion"
import { fetchApi, leerErrores } from "@/src/lib/api"

type EstadoFormulario = { errors: string[] }

const guardarToken = async (token: string) =>
  (await cookies()).set({
    name: NOMBRE_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACION_COOKIE
  })

// Usuario = identificación del tramitador. Torre de control entrega la contraseña temporal.
export async function iniciarSesion(_estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const credenciales = InicioSesionSchema.safeParse({
    identificacion: formData.get("identificacion"),
    contrasena: formData.get("contrasena")
  })
  if (!credenciales.success) return { errors: credenciales.error.issues.map(issue => issue.message) }

  const req = await fetch(`${process.env.API_URL}/app-tramitadores/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credenciales.data),
    cache: "no-store"
  })
  const json = await req.json().catch(() => null)

  if (!req.ok) {
    const error = ErrorRespuestaSchema.safeParse(json)
    return { errors: [error.success ? error.data.error : "No se pudo iniciar sesión, intente de nuevo"] }
  }

  const { token, debeCambiarContrasena } = RespuestaLoginSchema.parse(json)
  await guardarToken(token)
  redirect(debeCambiarContrasena ? "/cambiar-contrasena" : "/inicio")
}

export async function cerrarSesion() {
  (await cookies()).delete(NOMBRE_COOKIE)
  redirect("/auth/login")
}

// Obligatorio con la contraseña temporal; el backend devuelve un token nuevo
export async function cambiarContrasena(_estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const datos = CambioContrasenaSchema.safeParse({
    contrasenaActual: formData.get("contrasenaActual"),
    contrasena: formData.get("contrasena"),
    confirmacion: formData.get("confirmacion")
  })
  if (!datos.success) return { errors: datos.error.issues.map(issue => issue.message) }

  const req = await fetchApi("/auth/cambiar-contrasena", {
    method: "POST",
    body: JSON.stringify({ contrasenaActual: datos.data.contrasenaActual, contrasena: datos.data.contrasena })
  })
  // 401 aquí puede ser la contraseña actual incorrecta o la sesión vencida: el mensaje lo dice
  if (!req.ok) return { errors: await leerErrores(req) }

  const { token } = await req.json() as { token: string }
  await guardarToken(token)
  redirect("/inicio?bienvenida=1")
}
