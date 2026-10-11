import clsx from "clsx"
import { AlertTriangle } from "lucide-react"
import { formatoMoneda } from "@/src/lib/formato"
import type { ResumenCaja } from "@/src/schemas/gastos"

function Tarjeta({ etiqueta, valor, detalle, destacada, alerta }: {
  etiqueta: string
  valor: number
  detalle?: string
  destacada?: boolean
  alerta?: boolean
}) {
  return (
    <div className={clsx(
      "rounded-xl border bg-white px-4 py-3 shadow-sm",
      alerta ? "border-red-200 bg-red-50/60" : destacada ? "border-emerald-200" : "border-slate-200"
    )}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{etiqueta}</p>
      <p className={clsx("mt-1 font-semibold", destacada ? "text-xl" : "text-base", alerta ? "text-red-700" : "text-slate-800")}>
        {formatoMoneda(valor)}
      </p>
      {detalle && <p className={clsx("mt-0.5 text-[11px]", alerta ? "text-red-600" : "text-slate-400")}>{detalle}</p>}
    </div>
  )
}

const cuantos = (n: number) => (n === 1 ? "1 gasto" : `${n} gastos`)

// Saldo de la caja siempre a la vista: disponible (en rojo si bajó del tope), fondo y lo que
// falta legalizar o reembolsar. Si el cuadre no da cero, se avisa.
export default function TarjetasCaja({ caja }: { caja: ResumenCaja }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tarjeta
          etiqueta="Disponible"
          valor={caja.saldo}
          detalle={caja.bajoTope ? `Por debajo del tope de ${formatoMoneda(caja.topeAlerta)}` : `Tope de alerta ${formatoMoneda(caja.topeAlerta)}`}
          destacada
          alerta={caja.bajoTope}
        />
        <Tarjeta etiqueta="Fondo asignado" valor={caja.fondo} />
        <Tarjeta etiqueta="Entregado sin legalizar" valor={caja.sinLegalizar.valor} detalle={cuantos(caja.sinLegalizar.cantidad)} />
        <Tarjeta etiqueta="Pendiente por reembolso" valor={caja.pendienteReembolso.valor} detalle={cuantos(caja.pendienteReembolso.cantidad)} />
        <Tarjeta etiqueta="En reembolso" valor={caja.enReembolso.valor} detalle={cuantos(caja.enReembolso.cantidad)} />
      </div>
      {caja.diferencia !== 0 && (
        <p className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle size={14} className="shrink-0" />
          La caja no cuadra: hay una diferencia de {formatoMoneda(caja.diferencia)} entre el fondo y lo que suman el disponible, lo entregado y lo pendiente.
        </p>
      )}
    </div>
  )
}
