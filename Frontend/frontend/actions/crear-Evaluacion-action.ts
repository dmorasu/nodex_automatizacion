"use server"

import { cookies } from "next/headers"

type Respuesta = {
  preguntaId: number
  calificacion: number
}

export async function crearEvaluacion(
  solicitudId: number,
  respuestas: Respuesta[]
) {
  const cookieStore = await cookies()
  const token = cookieStore.get("TOKEN")?.value

  const url = `${process.env.API_URL}/solicitudes/${solicitudId}/evaluacion`

  const req = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ respuestas })
  })

  const json = await req.json()

  if (!req.ok) {
    return {
      error: json.error || json.message || "Error al crear evaluación"
    }
  }

  return json
}