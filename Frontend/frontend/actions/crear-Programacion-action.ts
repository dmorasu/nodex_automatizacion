"use server"

import {
  ErrorResponoseSchema,
  SuccessSchema,
  ProgramacionSchema
} from "@/src/schemas"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

type ActionStateType = {
  errors: string[],
  success: string
}

export default async function CrearProgramacion(
  solicitudTramiteId: number,
  prevState: ActionStateType,
  formData: FormData
) {

  const programacionData = {
    solicitudTramiteId,

    fechaProbableEntrega: formData.get('fechaProbableEntrega'),

    valorTramite: formData.get('valorTramite'),
    valorViaticos: formData.get('valorViaticos'),

    conceptoViaticos: formData.get('conceptoViaticos'),
    conceptoHonorarios: formData.get('conceptoHonorarios'),

    requiereCita: formData.get('requiereCita') === 'true',

    fechaCita: formData.get('fechaCita'),
    horaCita: formData.get('horaCita')
  }

  console.log("PROGRAMACION DATA:", programacionData)

  const programacion = ProgramacionSchema.safeParse({
    fechaProbableEntrega: programacionData.fechaProbableEntrega,
    conceptoHonorarios: programacionData.conceptoHonorarios,
    valorTramite: programacionData.valorTramite
  })

  if (!programacion.success) {
    return {
      errors: programacion.error.issues.map(issue => issue.message),
      success: ''
    }
  }

  const token = cookies().get("TOKEN")?.value

  const url = `${process.env.API_URL}/solicitudTramites/${solicitudTramiteId}/programacion`

  const req = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      solicitudTramiteId,

      fechaProbableEntrega: programacionData.fechaProbableEntrega,

      valorTramite: programacionData.valorTramite,
      valorViaticos: programacionData.valorViaticos,

      conceptoHonorarios: programacionData.conceptoHonorarios,
      conceptoViaticos: programacionData.conceptoViaticos,

      requiereCita: programacionData.requiereCita,
      fechaCita: programacionData.fechaCita,
      horaCita: programacionData.horaCita
    })
  })

  const json = await req.json()

  console.log("RESPUESTA:", json)

  if (!req.ok) {

    const { error } = ErrorResponoseSchema.parse(json)

    return {
      errors: [error],
      success: ''
    }
  }

  revalidatePath(`/center/solicitudTramites/${solicitudTramiteId}`)

  const success = SuccessSchema.parse(json)

  return {
    errors: [],
    success
  }
}