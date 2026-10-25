"use server"

import { encabezadosSesion } from "@/src/lib/sesionApi"
import { 
  ErrorResponoseSchema,
  SuccessSchema, 

  cuentaCobroSchema
} from "@/src/schemas"

import { revalidatePath } from "next/cache"
import { sumarDiasHabilesColombia } from "@/src/ultis/fechasHabiles"

type ActionStateType = {
  errors: string[],
  success: string
}

function toDateOnly(date: Date) {
  return date.toISOString().split("T")[0]
}

export default async function CrearCuentaCobro(
  solicitudTramitesId: number,
  prevState: ActionStateType,
  formData: FormData
) {

  // 🔹 Generadas automáticamente
  const ahora = new Date()
  const fechaMaxPago = sumarDiasHabilesColombia(ahora, 10)

  const cuentaCobroData = {
    solicitudTramitesId,

    fechaRadicacionCuentaCobro: toDateOnly(ahora),
    fechaMaximaPagoCuentaCobro: toDateOnly(fechaMaxPago),

    numeroCuentaCobro: formData.get("numeroCuentaCobro"),
    valorCuentaCobro: formData.get("valorCuentaCobro"),
    fechaRecibidaCuentaCobroTramitador: formData.get("fechaRecibidaCuentaCobroTramitador"),
    fechaPagoCuentaCobro: formData.get("fechaPagoCuentaCobro")
  }

  // ✅ Validación flexible
  const parsed = cuentaCobroSchema.safeParse(cuentaCobroData)

  if (!parsed.success) {
    return {
      errors: parsed.error.issues.map(issue => issue.message),
      success: ""
    }
  }

  // ✅ Enviar al backend
  
  const url= `${process.env.API_URL}/solicitudTramites/${solicitudTramitesId}/cuentaCobro`



  const req = await fetch(url, {
    method: "POST",
    headers: {
      ...(await encabezadosSesion()), "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data)
  })

  const json = await req.json()

  if (!req.ok) {
    const { error } = ErrorResponoseSchema.parse(json)
    return {
      errors: [error],
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
