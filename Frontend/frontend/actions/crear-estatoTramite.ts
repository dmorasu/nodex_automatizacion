"use server"

import { ErrorResponoseSchema, EstadoTramitesSchema } from "@/src/schemas"

type ActionStateType = {
  errors: string[]
  success: string
  requiereEvaluacion?: boolean
}

export default async function CrearEstadoTramite(
  solicitudTramitesId: number,
  prevState: ActionStateType,
  formData: FormData
): Promise<ActionStateType> {

  try {

    const estadoTramiteData = {
      estadoId: Number(formData.get("estadoId")),
      tipoRechazoId: formData.get("tipoRechazoId")
        ? Number(formData.get("tipoRechazoId"))
        : null,
      solicitudTramitesId
    }

    const estadoTramite = EstadoTramitesSchema.safeParse({
      estadoId: estadoTramiteData.estadoId,
      solicitudTramitesId
    })

    if (!estadoTramite.success) {
      return {
        errors: estadoTramite.error.issues.map(issue => issue.message),
        success: "",
        requiereEvaluacion: false
      }
    }

    const url = `${process.env.API_URL}/solicitudTramites/${solicitudTramitesId}/estadosTramites`
    

    const req = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        estadoId: estadoTramiteData.estadoId,
        tipoRechazoId: estadoTramiteData.tipoRechazoId,
        solicitudTramiteId: solicitudTramitesId
      })
    })

    const json = await req.json()

    console.log("RESPUESTA BACKEND:", json)
    console.log("STATUS:", req.status)

    if (!req.ok) {

      const { error } = ErrorResponoseSchema.parse(json)

      return {
        errors: [error],
        success: "",
        requiereEvaluacion: false
      }
    }

    return {
      errors: [],
      success: "Estado actualizado correctamente",
      requiereEvaluacion: json.requiereEvaluacion ?? false
    }

  } catch (error) {

    console.error(error)

    return {
      errors: ["Error inesperado al actualizar estado"],
      success: "",
      requiereEvaluacion: false
    }
  }
}