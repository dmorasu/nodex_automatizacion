"use server"

import { revalidatePath } from "next/cache"
import { encabezadosSesion } from "@/src/lib/sesionApi"

type Resultado = { ok: true } | { ok: false, error: string }

// Quien creó el trámite marca la novedad como subsanada, con la nueva fecha de entrega del
// resultado y qué se subsanó. El backend valida que sea el creador y que el trámite esté
// en espera por novedad, y avisa al analista por correo.
export async function subsanarNovedad(solicitudTramiteId: number, datos: { fechaEntregaResultado: string, observacion: string }): Promise<Resultado> {
  const req = await fetch(`${process.env.API_URL}/solicitudTramites/${solicitudTramiteId}/subsanar-novedad`, {
    method: "POST",
    headers: { ...(await encabezadosSesion()), "Content-Type": "application/json" },
    body: JSON.stringify(datos)
  })

  if (!req.ok) {
    const json = await req.json().catch(() => null)
    return { ok: false, error: json?.error ?? "No se pudo marcar la novedad como subsanada" }
  }

  revalidatePath(`/center/solicitudTramites/${solicitudTramiteId}`)
  revalidatePath("/center/dashboard")
  return { ok: true }
}
