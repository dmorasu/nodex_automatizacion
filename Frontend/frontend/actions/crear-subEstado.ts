"use server"

import { revalidatePath } from "next/cache"
import { ErrorResponoseSchema } from "@/src/schemas"

type ActionStateType = {
  errors: string[]
  success: string
}

export default async function CrearSubEstado(
  solicitudTramiteId: number,
  prevState: ActionStateType,
  formData: FormData
): Promise<ActionStateType> {

  try {

    const subEstadoId = formData.get("subEstadoId")

    if (!subEstadoId) {
      return {
        errors: ["Debe seleccionar un SubEstado"],
        success: ""
      }
    }

    const url =
      `${process.env.API_URL}/solicitudTramites/${solicitudTramiteId}/subEstadosSolicitud`

    const req = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        subEstadoId: Number(subEstadoId)
      })
    })

    const json = await req.json()

    console.log("RESPUESTA SUBESTADO:", json)

    if (!req.ok) {

      const parsed = ErrorResponoseSchema.safeParse(json)

      return {
        errors: [
          parsed.success
            ? parsed.data.error
            : "Error al registrar SubEstado"
        ],
        success: ""
      }
    }

    revalidatePath(
      `/center/solicitudTramites/${solicitudTramiteId}`
    )

    return {
      errors: [],
      success: "SubEstado actualizado correctamente"
    }

  } catch (error) {

    console.error("ERROR SUBESTADO:", error)

    return {
      errors: ["Error inesperado al registrar SubEstado"],
      success: ""
    }
  }
}