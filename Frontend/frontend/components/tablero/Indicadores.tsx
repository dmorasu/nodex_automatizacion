import { AlertTriangle, CheckCircle2, Clock3, FolderOpen, PauseCircle, Timer } from "lucide-react"
import type { Tablero } from "@/src/tablero"

const numero = (valor: number) => valor.toLocaleString("es-CO")

function Tarjeta({ titulo, valor, detalle, Icono, alerta }: {
  titulo: string
  valor: string
  detalle: string
  Icono: typeof FolderOpen
  // Estado crítico: lleva ícono y texto, no solo color
  alerta?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{titulo}</p>
        <Icono size={16} className={alerta ? "text-red-500" : "text-slate-300"} aria-hidden="true" />
      </div>
      <p className="mt-1.5 text-2xl font-semibold text-slate-800">{valor}</p>
      <p className={`mt-0.5 text-[11px] ${alerta ? "font-medium text-red-600" : "text-slate-400"}`}>{detalle}</p>
    </div>
  )
}

// Fila de indicadores principales
export default function Indicadores({ tablero }: { tablero: Tablero }) {
  const i = tablero.indicadores
  const pctVencidos = i.abiertos ? Math.round((i.vencidos / i.abiertos) * 100) : 0

  return (
    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <Tarjeta titulo="Abiertos" valor={numero(i.abiertos)} detalle="Sin finalizar ni desistir" Icono={FolderOpen} />
      <Tarjeta
        titulo="Vencidos"
        valor={numero(i.vencidos)}
        detalle={i.vencidos ? `${pctVencidos} % de los abiertos` : "Ninguno vencido"}
        Icono={AlertTriangle}
        alerta={i.vencidos > 0}
      />
      <Tarjeta titulo="En novedad" valor={numero(i.enNovedad)} detalle="En espera por novedad" Icono={PauseCircle} />
      <Tarjeta titulo="Finalizados" valor={numero(i.finalizados)} detalle="En el período" Icono={CheckCircle2} />
      <Tarjeta
        titulo="A tiempo"
        valor={i.porcentajeATiempo === null ? "—" : `${i.porcentajeATiempo} %`}
        detalle={i.finalizadosConFecha ? `De ${numero(i.finalizadosConFecha)} con fecha programada` : "Sin finalizados con fecha"}
        Icono={Clock3}
      />
      <Tarjeta
        titulo="Ciclo promedio"
        valor={i.cicloPromedioDias === null ? "—" : `${i.cicloPromedioDias} días`}
        detalle="De la creación a la finalización"
        Icono={Timer}
      />
    </div>
  )
}
