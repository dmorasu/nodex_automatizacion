"use server"

import { revalidatePath } from "next/cache"
import { fetchApi } from "@/src/lib/api"

type Resultado = { ok: true } | { ok: false, error: string }

export async function asignarRoles(usuarioId: number, roles: string[]): Promise<Resultado> {
  const req = await fetchApi(`/gastos/admin/usuarios/${usuarioId}/roles`, {
    method: "PUT",
    // Solo los perfiles de Gastos: el backend no toca los de Trámites
    body: JSON.stringify({ modulo: "GASTOS", roles })
  })

  if (!req.ok) {
    const json = await req.json().catch(() => ({}))
    return { ok: false, error: json.error ?? "No se pudieron guardar los roles" }
  }

  revalidatePath("/usuarios")
  return { ok: true }
}
