"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { NOMBRE_COOKIE } from "@/src/auth/dal"

export async function cerrarSesion() {
  cookies().delete(NOMBRE_COOKIE)
  redirect("/auth/login")
}
