import "server-only"
import { z } from "zod"
import { encabezadosSesion } from "@/src/lib/sesionApi"

// Comentarios con el tramitador y reportes de "realizado" (app Nodex Tramitadores)

const ComentarioSchema = z.object({
  id: z.number(),
  comentario: z.string(),
  fecha: z.string(),
  autor: z.object({
    tipo: z.enum(["TRAMITADOR", "USUARIO"]),
    id: z.number().nullable(),
    nombre: z.string()
  })
})

const ReporteSchema = z.object({
  id: z.number(),
  observacion: z.string(),
  estado: z.enum(["PENDIENTE", "REVISADO"]),
  fecha: z.string(),
  tramitador: z.string().nullable(),
  revisor: z.string().nullable(),
  fechaRevision: z.string().nullable(),
  notaRevision: z.string().nullable()
})

export const SeguimientoSchema = z.object({
  comentarios: z.array(ComentarioSchema),
  reportes: z.array(ReporteSchema)
})

const ReporteBandejaSchema = ReporteSchema.extend({
  tramite: z.object({
    id: z.number(),
    placa: z.string().nullable(),
    matriculaInmobiliaria: z.string().nullable(),
    detalleSolicitud: z.string().nullable(),
    estado: z.string(),
    cliente: z.string().nullable(),
    tipo: z.string().nullable()
  })
})

export type Seguimiento = z.infer<typeof SeguimientoSchema>
export type ReporteBandeja = z.infer<typeof ReporteBandejaSchema>

const SIN_SEGUIMIENTO: Seguimiento = { comentarios: [], reportes: [] }

export const obtenerSeguimiento = async (solicitudTramiteId: number): Promise<Seguimiento> => {
  const req = await fetch(`${process.env.API_URL}/seguimiento-tramitador/tramites/${solicitudTramiteId}`, {
    headers: encabezadosSesion(),
    cache: "no-store"
  })
  if (!req.ok) return SIN_SEGUIMIENTO
  const resultado = SeguimientoSchema.safeParse(await req.json())
  return resultado.success ? resultado.data : SIN_SEGUIMIENTO
}

export const obtenerReportes = async (estado: "PENDIENTE" | "REVISADO"): Promise<ReporteBandeja[]> => {
  const req = await fetch(`${process.env.API_URL}/seguimiento-tramitador/reportes-realizado?estado=${estado}`, {
    headers: encabezadosSesion(),
    cache: "no-store"
  })
  if (!req.ok) return []
  return z.array(ReporteBandejaSchema).parse(await req.json())
}
