"use client"

import { anularGasto } from "@/actions/gastos/gastos"
import BotonConMotivo from "../ui/BotonConMotivo"

// Qué pasa al anular según el estado (fuera de Solicitado solo lo anula el Administrador de Gastos):
//  · caja menor sin reembolso legalizado: lo entregado vuelve a la caja;
//  · programado o aprobado: sale del lote de pago;
//  · en cuenta de cobro (borrador): sale de la cuenta y lo pagado vuelve a la bolsa;
//  · ya pagado, legalizado o contabilizado: lo pagado vuelve a la bolsa (menos lo que ya volvió al
//    legalizar su cuenta de cobro);
//  · caja menor con reembolso legalizado: queda anulado sin mover dinero (la caja ya se repuso).
const CAJA_SIN_REEMBOLSAR = ["PAGADO_CAJA", "PENDIENTE_REEMBOLSO", "EN_REEMBOLSO"]
const PAGADOS = ["PAGADO", "FACTURADO", "LEGALIZADO", "CONTABILIZADO"]

const descripcion = (estado: string, bolsa: string | null) => {
  if (CAJA_SIN_REEMBOLSAR.includes(estado)) return `El gasto queda anulado y lo entregado vuelve al saldo de ${bolsa ?? "la caja"}.`
  if (estado === "PROGRAMADO" || estado === "APROBADO_PAGO") return "El gasto sale del lote de pago y queda anulado."
  if (estado === "EN_CUENTA_COBRO") return "El gasto sale de la cuenta de cobro en borrador, queda anulado y lo pagado vuelve a la bolsa."
  if (PAGADOS.includes(estado)) return "El gasto queda anulado y lo pagado vuelve a la bolsa (si su cuenta de cobro ya se legalizó, esa parte ya había vuelto)."
  if (estado === "LEGALIZADO_CAJA") return "El gasto queda anulado. No se mueve dinero: el reembolso ya repuso la caja."
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
