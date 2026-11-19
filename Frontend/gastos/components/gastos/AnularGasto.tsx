"use client"

import { anularGasto } from "@/actions/gastos/gastos"
import BotonConMotivo from "../ui/BotonConMotivo"

// Qué pasa al anular según el estado (fuera de Solicitado solo lo anula el Administrador de Gastos):
//  · caja menor sin reembolso legalizado: lo entregado vuelve a la caja;
//  · programado o aprobado: sale del lote de pago;
//  · en cuenta de cobro (borrador): sale de la cuenta;
//  · ya pagado, legalizado o contabilizado: queda anulado sin mover dinero.
const CAJA_SIN_REEMBOLSAR = ["PAGADO_CAJA", "PENDIENTE_REEMBOLSO", "EN_REEMBOLSO"]
const SIN_MOVER_DINERO = ["PAGADO", "FACTURADO", "LEGALIZADO", "CONTABILIZADO", "LEGALIZADO_CAJA"]

const descripcion = (estado: string, bolsa: string | null) => {
  if (CAJA_SIN_REEMBOLSAR.includes(estado)) return `El gasto queda anulado y lo entregado vuelve al saldo de ${bolsa ?? "la caja"}.`
  if (estado === "PROGRAMADO" || estado === "APROBADO_PAGO") return "El gasto sale del lote de pago y queda anulado."
  if (estado === "EN_CUENTA_COBRO") return "El gasto sale de la cuenta de cobro en borrador y queda anulado."
  if (SIN_MOVER_DINERO.includes(estado)) return "El gasto queda anulado. No se mueve dinero: lo pagado no vuelve a la bolsa."
  return "El gasto queda anulado y no podrá pagarse."
}

export default function AnularGasto({ gastoId, codigo, estado, bolsa = null }: { gastoId: number, codigo: string, estado: string, bolsa?: string | null }) {
  return (
    <BotonConMotivo
      etiqueta="Anular"
      titulo={`Anular gasto ${codigo}`}
      descripcion={`${descripcion(estado, bolsa)} Esta acción no se puede deshacer.`}
      mensajeExito={`Gasto ${codigo} anulado`}
      onConfirmar={motivo => anularGasto(gastoId, motivo)}
    />
  )
}
