import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { formatoMoneda } from "@/src/lib/formato"
import type { ResumenReintegros as Resumen } from "@/src/schemas/gastos"
import Indicador from "./Indicador"

// Mismo color que "Reintegro pendiente" en el gráfico de bolsas
const COLOR_PENDIENTE = "#1baf7a"

type Barra = { clave: string, nombre: string, valor: number, detalle: string }

// Barras horizontales de una sola serie con el valor escrito al lado (sin leyenda)
function Barras({ filas }: { filas: Barra[] }) {
  const maximo = Math.max(1, ...filas.map(f => f.valor))
  return (
    <ul className="space-y-3">
      {filas.map(f => (
        <li key={f.clave} className="grid grid-cols-[minmax(110px,160px)_1fr_auto] items-center gap-3 text-xs">
          <span className="truncate font-medium text-slate-700" title={f.nombre}>{f.nombre}</span>
          <span className="h-3" role="img" aria-label={`${f.nombre}: ${formatoMoneda(f.valor)}`}>
            {f.valor > 0 && (
              <span
                className="block h-full rounded-r"
                style={{ width: `${(f.valor / maximo) * 100}%`, minWidth: 3, background: COLOR_PENDIENTE }}
              />
            )}
          </span>
          <span className="text-right tabular-nums">
            <b className="text-slate-800">{formatoMoneda(f.valor)}</b>
            <span className="block text-[11px] text-slate-400">{f.detalle}</span>
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
          detalle="Desde que se generó cada reintegro pendiente"
        />
      </div>

      {resumen.cantidadPendientes > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-semibold text-slate-600">Antigüedad de lo pendiente</p>
            <Barras filas={resumen.antiguedad.map(a => ({
              clave: a.clave,
              nombre: a.nombre,
              valor: a.valor,
              detalle: `${a.cantidad} reintegro(s)`
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
