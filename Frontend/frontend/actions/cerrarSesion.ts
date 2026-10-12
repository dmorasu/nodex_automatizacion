"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { encabezadosSesion } from "@/src/lib/sesionApi"

export async function cerrarSesion() {
  // El backend invalida la sesión en todos los equipos (y en Nodex Gastos); si no responde,
  // igual se borra la cookie
  await fetch(`${process.env.API_URL}/auth/logout`, { method: "POST", headers: encabezadosSesion(), cache: "no-store" })
    .catch(() => undefined)
  cookies().delete("TOKEN")

  // 🔹 Invalida cualquier ruta que haya usado sesión previa
  revalidatePath("/center/dashboard")

  redirect("/auth/login")
}
