import { formatoMoneda } from "@/src/lib/formato"
import type { Columna } from "./SeleccionGastos"

// Columnas que se repiten en las tablas de Tesorería, Legalización y Contabilidad (pedido del
// usuario, para ver de un vistazo quién hizo el trámite, a qué centro de costos va y cuánto se retuvo, cobró de 4x1000 y pagó).
// "—" cuando no aplica: retención solo en inmuebles; 4x1000 solo con la factura registrada

type ConTramitador = { tramitador?: { nombreTramitador: string } | null }
type ConOperacion = { operacion?: { centroDeCostos?: string | null } | null }
type ConValores = { retencionValor?: string | null, factura?: { cuatroXMil: string } | null, valorRealmentePagado?: string | number | null }

export const celdaTramitador = (g: ConTramitador) => g.tramitador?.nombreTramitador ?? "—"
// Centro de costos de la operación del gasto
export const celdaCentroCostos = (g: ConOperacion) => g.operacion?.centroDeCostos || "—"
export const celdaRetencion = (g: ConValores) => formatoMoneda(g.retencionValor)
export const celdaCuatroXMil = (g: ConValores) => formatoMoneda(g.factura?.cuatroXMil)

export const COLUMNA_TRAMITADOR: Columna = { titulo: "Tramitador", valor: celdaTramitador }
export const COLUMNA_CENTRO_COSTOS: Columna = { titulo: "Centro de costos", valor: celdaCentroCostos }
export const COLUMNA_RETENCION: Columna = { titulo: "Retención", alinearDerecha: true, valor: celdaRetencion }
export const COLUMNA_CUATRO_X_MIL: Columna = { titulo: "4x1000", alinearDerecha: true, valor: celdaCuatroXMil }
export const COLUMNA_VALOR_PAGADO: Columna = { titulo: "Valor pagado", alinearDerecha: true, valor: g => formatoMoneda(g.valorRealmentePagado) }
