import "server-only"
import { z } from "zod"
import { encabezadosSesion } from "@/src/lib/sesionApi"

// Línea de tiempo del trámite: estados, programación, logística, asignaciones, documentos...
// con quién y cuándo (GET /solicitudTramites/:id/historial)

const EventoHistorialSchema = z.object({
  clave: z.string(),
  fecha: z.string(),
  tipo: z.string(),
  titulo: z.string(),
  detalle: z.string().nullable(),
  cambios: z.array(z.object({ campo: z.string(), antes: z.string().nullable(), despues: z.string().nullable() })),
  usuario: z.string().nullable(),
  origen: z.string().nullable(),
  esCreador: z.boolean()
})

export type EventoHistorial = z.infer<typeof EventoHistorialSchema>

// null = no se pudo cargar (distinto de un historial vacío)
export const obtenerHistorial = async (solicitudTramiteId: number): Promise<EventoHistorial[] | null> => {
  const req = await fetch(`${process.env.API_URL}/solicitudTramites/${solicitudTramiteId}/historial`, {
    headers: encabezadosSesion(),
    cache: "no-store"
  })
  if (!req.ok) return null
  const resultado = z.array(EventoHistorialSchema).safeParse(await req.json())
  return resultado.success ? resultado.data : null
}
