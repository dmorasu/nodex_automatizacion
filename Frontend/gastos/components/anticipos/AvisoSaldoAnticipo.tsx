import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { formatoMoneda } from "@/src/lib/formato"

// En las bandejas de pago: de qué anticipo es el gasto y si los gastos por pagar del cliente
// (incluido este) superan su saldo en la bolsa. No bloquea: solo avisa.
export default function AvisoSaldoAnticipo({
  gasto
}: {
  gasto: {
    anticipo?: { id: number, codigo: string } | null
    saldoClienteAnticipo?: string | null
    comprometidoClienteAnticipo?: string | null
  }
}) {
  if (!gasto.anticipo) return null
  const saldo = Number(gasto.saldoClienteAnticipo ?? 0)
  const porPagar = Number(gasto.comprometidoClienteAnticipo ?? 0)
  const falta = porPagar - saldo

  return (
    <span className="mt-1 block text-[11px]">
      <Link href={`/anticipos/${gasto.anticipo.id}`} className="font-medium text-sky-700 hover:underline">{gasto.anticipo.codigo}</Link>
      {falta > 0 ? (
        <span className="mt-0.5 flex items-start gap-1 font-medium text-red-600" title={`Saldo del cliente ${formatoMoneda(saldo)} · por pagar ${formatoMoneda(porPagar)}`}>
          <AlertTriangle size={12} className="mt-px shrink-0" />
          Cliente sin saldo suficiente: faltan {formatoMoneda(falta)}
        </span>
      ) : (
        <span className="text-slate-400"> · saldo del cliente {formatoMoneda(saldo)}</span>
      )}
    </span>
  )
}
