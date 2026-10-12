"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { NOMBRE_COOKIE } from "@/src/auth/dal"
import { fetchApi } from "@/src/lib/api"

export async function cerrarSesion() {
  // El backend invalida la sesión en todos los equipos (y en Nodex Trámites); si no responde,
  // igual se borra la cookie
  await fetchApi("/auth/logout", { method: "POST" }).catch(() => undefined)
  cookies().delete(NOMBRE_COOKIE)
  redirect("/auth/login")
}
