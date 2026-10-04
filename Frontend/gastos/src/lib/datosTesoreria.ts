import "server-only"
import { z } from "zod"
import { notFound } from "next/navigation"
import { fetchApi } from "./api"
import { BolsaSchema, ListadoLotesSchema, LoteDetalleSchema, MovimientosBolsaSchema } from "../schemas/gastos"

// Todas las bolsas con saldo (activas e inactivas)
export const obtenerBolsas = async () =>
  z.array(BolsaSchema).parse(await (await fetchApi("/gastos/bolsas")).json())

export const obtenerMovimientos = async (bolsaId: number, pagina: number) => {
  const req = await fetchApi(`/gastos/bolsas/${bolsaId}/movimientos?pagina=${pagina}`)
  if (req.status === 404) notFound()
  return MovimientosBolsaSchema.parse(await req.json())
}

export type FiltrosLotes = {
  pagina?: number
  // "pendiente" (sin número de egreso) | "registrado" | vacío (todos)
  egreso?: "pendiente" | "registrado"
  busqueda?: string
  bolsaId?: string
  desde?: string
  hasta?: string
}

export const obtenerLotes = async (filtros: FiltrosLotes) => {
  const consulta = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => v).map(([k, v]) => [k, String(v)])
  )
  return ListadoLotesSchema.parse(await (await fetchApi(`/gastos/lotes?${consulta}`)).json())
}

export const obtenerLote = async (id: number) => {
  const req = await fetchApi(`/gastos/lotes/${id}`)
  if (req.status === 404) notFound()
  return LoteDetalleSchema.parse(await req.json())
}
