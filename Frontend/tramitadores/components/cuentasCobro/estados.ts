import type { Tono } from "@/components/ui/Etiqueta"
import type { CuentaCobro } from "@/src/schemas"

// Nombre y color del estado de la cuenta de cobro, como lo ve el tramitador
export const ESTADOS_CUENTA: Record<CuentaCobro["estado"], { nombre: string, tono: Tono }> = {
  CON_TRAMITADOR: { nombre: "Por aprobar", tono: "ambar" },
  POR_CORREGIR: { nombre: "En corrección", tono: "gris" },
  APROBADA: { nombre: "Aprobada", tono: "indigo" },
  EN_TESORERIA: { nombre: "En pago", tono: "indigo" },
  PAGADA: { nombre: "Pagada", tono: "verde" }
}

export const NOMBRE_LINEA = { TRAMITE: "Trámite", VISITA_FALLIDA: "Visita fallida", ADICIONAL: "Adicional" } as const
