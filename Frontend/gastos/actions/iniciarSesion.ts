"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ErrorRespuestaSchema, InicioSesionSchema } from "@/src/schemas"
import { NOMBRE_COOKIE } from "@/src/auth/dal"

type EstadoFormulario = {
  errors: string[]
}

// Usa el mismo login del backend Nodex: las credenciales son las mismas del módulo de trámites
export async function iniciarSesion(estadoAnterior: EstadoFormulario, formData: FormData) {

  const credenciales = InicioSesionSchema.safeParse({
    correoUsuario: formData.get("correoUsuario"),
    contrasena: formData.get("contrasena")
  })

  if (!credenciales.success) {
    return {
      errors: credenciales.error.issues.map(issue => issue.message)
    }
  }

  const req = await fetch(`${process.env.API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credenciales.data)
  })

  const json = await req.json()

  if (!req.ok) {
    const { error } = ErrorRespuestaSchema.parse(json)
    return { errors: [error] }
  }

  cookies().set({
    name: NOMBRE_COOKIE,
    value: json,
    httpOnly: true,
    path: "/"
  })

  redirect("/inicio")
}
