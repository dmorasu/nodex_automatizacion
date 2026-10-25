"use server"

import { SuccessSchema, logisticaSchema } from "@/src/schemas"
import { mensajesDeError } from "@/src/lib/erroresBackend"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

type ActionStateType = {
  errors: string[],
  success: string
}

export default async function CrearLogistica(
  solicitudTramitesId: number,
  prevState: ActionStateType,
  formData: FormData
) {

  // Normalización de datos
  const numeroGuia = (formData.get("numeroGuia") as string) || null
  const valorEnvio = formData.get("valorEnvio") ? Number(formData.get("valorEnvio")) : null
  const destinatario = (formData.get("destinatario") as string) || null
  const transportadoraId = formData.get("transportadoraId")
    ? Number(formData.get("transportadoraId"))
    : null
  const fechaProgramacionLogistica = (formData.get("fechaProgramacionLogistica") as string) || null
  const fechaEntregaTransportadora = (formData.get("fechaEntregaTransportadora") as string) || null

  const logisticaData = {
    solicitudTramitesId,
    numeroGuia,
    valorEnvio,
    destinatario,
    transportadoraId,
    fechaProgramacionLogistica,
    fechaEntregaTransportadora
  }

  const logistica = logisticaSchema.safeParse(logisticaData)

  if (!logistica.success) {
    return {
      errors: logistica.error.issues.map(issue => issue.message),
      success: ""
    }
  }

  const token = (await cookies()).get("TOKEN")?.value

  const url = `${process.env.API_URL}/solicitudTramites/${solicitudTramitesId}/logistica`

  const req = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(logisticaData)
  })

  const json = await req.json().catch(() => null)

  if (!req.ok) {
    return {
      errors: mensajesDeError(json, "No se pudo guardar la logística"),
      success: ""
    }
  }

  revalidatePath(`/center/solicitudTramites/${solicitudTramitesId}`)

  const success = SuccessSchema.parse(json)

  return {
    errors: [],
    success
  }
}