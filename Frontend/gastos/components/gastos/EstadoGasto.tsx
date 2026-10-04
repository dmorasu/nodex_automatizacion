import clsx from "clsx"

const AMARILLO = "bg-amber-50 text-amber-700 border-amber-200"
const VERDE = "bg-emerald-50 text-emerald-700 border-emerald-200"
const GRIS = "bg-slate-100 text-slate-700 border-slate-300"
const ROJO = "bg-red-50 text-red-600 border-red-200"

// Colores por código de estado (gastos, cuentas de cobro y reintegros)
const COLORES: Record<string, string> = {
  SOLICITADO: AMARILLO,
  PAGADO: "bg-sky-50 text-sky-700 border-sky-200",
  EN_CUENTA_COBRO: "bg-violet-50 text-violet-700 border-violet-200",
  LEGALIZADO: VERDE,
  CONTABILIZADO: GRIS,
  ANULADO: ROJO,
  BORRADOR: AMARILLO,
  LEGALIZADA: VERDE,
  CONTABILIZADA: GRIS,
  ANULADA: ROJO,
  PENDIENTE: AMARILLO,
  REINTEGRADO: VERDE
}

// Indicador de estado; sirve para gastos, cuentas de cobro y reintegros
export default function EstadoGasto({ codigo, nombre }: { codigo: string, nombre: string }) {
  return (
    <span className={clsx(
      "inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap",
      COLORES[codigo] ?? "bg-slate-50 text-slate-600 border-slate-200"
    )}>
      {nombre}
    </span>
  )
}
