import Link from "next/link"
import { X } from "lucide-react"
import { obtenerLotes } from "@/src/lib/datosTesoreria"
import { obtenerBolsasActivas } from "@/src/lib/datosGastos"
import TablaEgresos from "@/components/contabilidad/TablaEgresos"
import Paginacion from "@/components/ui/Paginacion"
import SelectBuscable from "@/components/ui/SelectBuscable"
import { claseBotonSecundario, claseInput } from "@/components/ui/estilos"

const FILTROS = [
  ["pendiente", "Sin número de egreso"],
  ["registrado", "Con número de egreso"]
] as const

// Filtros por columna de la tabla (pedido del usuario, 2026-11-18)
const CAMPOS = ["lote", "desde", "hasta", "bolsaId", "gasto", "creadoPor", "valor", "numeroEgreso"] as const
type Filtros = Partial<Record<typeof CAMPOS[number], string>>

// "1.234.567,50" o "$ 1.234.567" → "1234567.50" (como lo escriben al copiarlo del banco)
const valorNumerico = (texto?: string) => {
  const limpio = (texto ?? "").replace(/[^\d,.]/g, "")
  if (!limpio) return undefined
  const normal = limpio.includes(",") ? limpio.replace(/\./g, "").replace(",", ".") : limpio.replace(/\.(?=\d{3}(\D|$))/g, "")
  return Number.isFinite(Number(normal)) ? normal : undefined
}

// Pagos de Tesorería (lotes) para registrarles el número de egreso contable
export default async function EgresosPage(props: { searchParams: Promise<Filtros & { egreso?: string, pagina?: string }> }) {
  const searchParams = await props.searchParams
  const egreso = searchParams.egreso === "registrado" ? "registrado" : "pendiente"
  const pagina = Math.max(1, Number(searchParams.pagina) || 1)

  const filtros: Filtros = Object.fromEntries(
    CAMPOS.map(campo => [campo, searchParams[campo]?.trim() || undefined]).filter(([, v]) => v)
  )
  // Un número de lote mal escrito ("#12", "lote 12") se deja en sus dígitos
  if (filtros.lote) filtros.lote = filtros.lote.replace(/\D/g, "") || undefined

  const [{ total, tamano, registros, pagadores }, bolsas] = await Promise.all([
    obtenerLotes({ ...filtros, valor: valorNumerico(filtros.valor), pagina, egreso }),
    obtenerBolsasActivas()
  ])

  const hayFiltros = Object.values(filtros).some(Boolean)

  // Enlaces (pestañas y paginación) conservando los filtros
  const url = (cambios: Record<string, string | number>) => {
    const parametros = new URLSearchParams(
      Object.entries({ ...filtros, egreso, ...cambios }).filter(([, v]) => v) as [string, string][]
    )
    return `/contabilidad?${parametros}`
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 text-xs">
        {FILTROS.map(([codigo, nombre]) => (
          <Link
            key={codigo}
            href={url({ egreso: codigo })}
            className={`rounded-full border px-3 py-1 font-semibold ${egreso === codigo ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
          >
            {nombre}
          </Link>
        ))}
      </div>

      {/* FILTROS: los mismos de las columnas de la tabla */}
      <form className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="egreso" value={egreso} />
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Pago (lote)</span>
          <input name="lote" defaultValue={filtros.lote} inputMode="numeric" placeholder="N°" className={`${claseInput} w-24`} />
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Fecha de pago desde</span>
          <input type="date" name="desde" defaultValue={filtros.desde} className={claseInput} />
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Hasta</span>
          <input type="date" name="hasta" defaultValue={filtros.hasta} className={claseInput} />
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Bolsa</span>
          <SelectBuscable name="bolsaId" defaultValue={filtros.bolsaId ?? ""} className={`${claseInput} w-44`}>
            <option value="">Todas</option>
            {bolsas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </SelectBuscable>
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Gastos</span>
          <input name="gasto" defaultValue={filtros.gasto} placeholder="Código, concepto o beneficiario" className={`${claseInput} w-56`} />
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Pagado por</span>
          <SelectBuscable name="creadoPor" defaultValue={filtros.creadoPor ?? ""} className={`${claseInput} w-44`}>
            <option value="">Todos</option>
            {(pagadores ?? []).map(u => <option key={u.id} value={u.id}>{u.nombreUsuario}</option>)}
          </SelectBuscable>
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Valor</span>
          <input name="valor" defaultValue={filtros.valor} inputMode="decimal" placeholder="Total o de un gasto" className={`${claseInput} w-36`} />
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Egreso</span>
          <input name="numeroEgreso" defaultValue={filtros.numeroEgreso} placeholder="N° de egreso" className={`${claseInput} w-32`} />
        </label>
        <button type="submit" className={claseBotonSecundario}>Filtrar</button>
        {hayFiltros && (
          <Link href={`/contabilidad?egreso=${egreso}`} className="inline-flex items-center gap-1 h-10 px-2 text-xs text-slate-500 hover:text-slate-700">
            <X size={14} />
            Limpiar
          </Link>
        )}
      </form>

      <p className="text-xs text-slate-500">{total} pago(s) encontrado(s)</p>

      <TablaEgresos
        registros={registros}
        vacio={hayFiltros
          ? "No hay pagos con estos filtros."
          : egreso === "pendiente" ? "Todos los pagos tienen número de egreso." : "Aún no hay pagos con número de egreso."}
      />

      <Paginacion pagina={pagina} total={total} tamano={tamano} url={p => url({ pagina: p })} />
    </div>
  )
}
