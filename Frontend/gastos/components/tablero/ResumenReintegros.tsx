import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { formatoMoneda } from "@/src/lib/formato"
import type { ResumenReintegros as Resumen } from "@/src/schemas/gastos"
import Indicador from "./Indicador"

// Mismo color que "Reintegro pendiente" en el gráfico de bolsas
const COLOR_PENDIENTE = "#1baf7a"

// Escala de un solo tono (claro → oscuro) para la antigüedad: lo más viejo pesa más a la vista
const ESCALA_ANTIGUEDAD = ["#8fdcbc", "#45c08f", "#1a9a6b", "#0e6b49"]
const colorAntiguedad = (i: number, total: number) =>
  ESCALA_ANTIGUEDAD[total <= 1 ? ESCALA_ANTIGUEDAD.length - 1 : Math.round((i * (ESCALA_ANTIGUEDAD.length - 1)) / (total - 1))]

type Barra = { clave: string, nombre: string, valor: number, detalle: string, color?: string }

// Barras horizontales de una sola serie con el valor escrito al lado (sin leyenda).
// En el celular el nombre y el valor van arriba y la barra ocupa todo el ancho debajo.
function Barras({ filas }: { filas: Barra[] }) {
  const maximo = Math.max(1, ...filas.map(f => f.valor))
  return (
    <ul className="space-y-3">
      {filas.map(f => (
        <li key={f.clave} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-xs sm:grid-cols-[minmax(110px,160px)_1fr_auto]">
          <span className="truncate font-medium text-slate-700" title={f.nombre}>{f.nombre}</span>
          <span className="text-right tabular-nums sm:col-start-3 sm:row-start-1">
            <b className="text-slate-800">{formatoMoneda(f.valor)}</b>
            <span className="block text-[11px] text-slate-400">{f.detalle}</span>
          </span>
          <span className="col-span-2 flex h-5 items-center sm:col-span-1 sm:col-start-2 sm:row-start-1" role="img" aria-label={`${f.nombre}: ${formatoMoneda(f.valor)}`}>
            {f.valor > 0 && (
              <span
                className="block h-4 rounded-r"
                style={{ width: `${(f.valor / maximo) * 100}%`, minWidth: 3, background: f.color ?? COLOR_PENDIENTE }}
              />
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

// Vista gerencial de los reintegros: saldo, recuperación, antigüedad y concentración
export default function ResumenReintegros({ resumen, rutaDetalle }: { resumen: Resumen, rutaDetalle: string | null }) {
  const porcentaje = (valor: number) => `${Math.round(valor * 100)}%`
  const concentracionTop = resumen.pendiente > 0
    ? resumen.principales.reduce((s, p) => s + p.valor, 0) / resumen.pendiente
    : 0

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          etiqueta="Por reintegrar"
          valor={formatoMoneda(resumen.pendiente)}
          detalle={`${resumen.cantidadPendientes} reintegro(s) pendiente(s)`}
          destacado
        />
        <Indicador
          etiqueta="Recuperado"
          valor={resumen.recuperacion === null ? "—" : porcentaje(resumen.recuperacion)}
          detalle={`${formatoMoneda(resumen.reintegrado)} ya volvieron a las bolsas`}
        />
        <Indicador
          etiqueta="Tramitadores con deuda"
          valor={String(resumen.tramitadoresConDeuda)}
          detalle={resumen.principales.length > 0 ? `Los ${resumen.principales.length} principales concentran ${porcentaje(concentracionTop)}` : "Nadie debe reintegros"}
        />
        <Indicador
          etiqueta="Antigüedad promedio"
          valor={`${resumen.diasPromedio} días`}
        />
      </div>

      {resumen.cantidadPendientes > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-semibold text-slate-600">Antigüedad de lo pendiente</p>
            <Barras filas={resumen.antiguedad.map((a, i) => ({
              clave: a.clave,
              nombre: a.nombre,
              valor: a.valor,
              detalle: `${a.cantidad} reintegro(s)`,
              color: colorAntiguedad(i, resumen.antiguedad.length)
            }))} />
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold text-slate-600">Quiénes concentran la deuda</p>
            <Barras filas={resumen.principales.map(p => ({
              clave: String(p.tramitadorId ?? "sin"),
              nombre: p.nombre ?? "Sin tramitador",
              valor: p.valor,
              detalle: `${p.cantidad} gasto(s) · ${porcentaje(p.valor / resumen.pendiente)}`
            }))} />
          </div>
        </div>
      )}

      {rutaDetalle && (
        <Link href={rutaDetalle} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">
          Ver el detalle por tramitador
          <ArrowRight size={13} />
        </Link>
      )}
    </div>
  )
}
