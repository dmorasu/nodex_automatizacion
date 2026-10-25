"use server"

import { encabezadosSesion } from "@/src/lib/sesionApi"
import { ErrorResponoseSchema, SuccessSchema } from "@/src/schemas"

type ActionStateType = {
  errors: string[],
  success: string
}

export default async function AsignarTramitadorSolicitud(
  solicitudTramiteId: number,
  prevState: ActionStateType,
  formData: FormData
) {

  // 1. Obtener dato del formulario
  const tramitadorId = formData.get('tramitadorId')

  if (!tramitadorId) {
    return {
      errors: ['Debe seleccionar un tramitador'],
      success: ''
    }
  }

  // 2. Llamar API backend (UPDATE)
  const url = `${process.env.API_URL}/solicitudTramites/${solicitudTramiteId}/asignar-tramitador`

  const req = await fetch(url, {
    method: 'PATCH',
    headers: {
      ...(await encabezadosSesion()),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tramitadorId: Number(tramitadorId)
    })
  })

  const json = await req.json()

  // 3. Manejo de error API
  if (!req.ok) {
    const { error } = ErrorResponoseSchema.parse(json)
    return {
      errors:[error],
            success:''
    }
  }

  // 4. OK
  const success = SuccessSchema.parse(json)

  return {
    errors:[],
        success
  }
}
