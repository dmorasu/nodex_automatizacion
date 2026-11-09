import Link from "next/link"
import { ArrowLeft, FileSpreadsheet } from "lucide-react"
import { z } from "zod"
import { requiereAcceso } from "@/src/auth/dal"
import { fetchApi } from "@/src/lib/api"
import { formatoMoneda } from "@/src/lib/formato"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel } from "@/components/ui/estilos"
import VistaPreviaCentro from "@/components/anticipos/VistaPreviaCentro"

const ValoresSchema = z.object({ cantidad: z.number(), base: z.number(), iva: z.number(), retencion: z.number().default(0), total: z.number() })
// Registros de cada centro, para la vista previa al pasar el mouse
const RegistroSchema = z.object({
  id: z.number(),
  codigo: z.string(),
  grupo: z.enum(["FACTURADO", "POR_FACTURAR", "ANTICIPOS"]),
  estado: z.string(),
  cliente: z.string().nullable(),
  fechaConsignacion: z.string(),
  identificacion: z.string().nullable(),
  base: z.number(),
  iva: z.number(),
  retencion: z.number().default(0),
  total: z.number(),
  factura: z.string().nullable()
})
const FilaSchema = z.object({
  centroCostos: z.string(),
  operaciones: z.array(z.string()),
  grupos: z.object({ FACTURADO: ValoresSchema, POR_FACTURAR: ValoresSchema, ANTICIPOS: ValoresSchema }),
  total: ValoresSchema,
  registros: z.array(RegistroSchema).optional()
})
const ReporteSchema = z.object({ centros: z.array(FilaSchema), totales: FilaSchema })

type Fila = z.infer<typeof FilaSchema>
type Valores = z.infer<typeof ValoresSchema>

const GRUPOS = [
  { clave: "FACTURADO", titulo: "Facturado" },
  { clave: "POR_FACTURAR", titulo: "Por facturar" },
  { clave: "ANTICIPOS", titulo: "Anticipos (no se facturan)" }
] as const

// Total pagado del grupo y, debajo, base, IVA, retención (si hay) y cuántos registros
function Celda({ valores, fuerte = false }: { valores: Valores, fuerte?: boolean }) {
  if (valores.cantidad === 0) return <td className="px-4 py-3 text-right text-slate-300">—</td>
  return (
    <td className="px-4 py-3 text-right whitespace-nowrap">
      <p className={fuerte ? "font-semibold text-slate-800" : "font-medium text-slate-700"}>{formatoMoneda(valores.total)}</p>
      <p className="text-[11px] text-slate-400">Base {formatoMoneda(valores.base)} · IVA {formatoMoneda(valores.iva)}</p>
      {valores.retencion > 0 && <p className="text-[11px] text-slate-400">Retención {formatoMoneda(valores.retencion)}</p>}
      <p className="text-[11px] text-slate-400">{valores.cantidad} registro(s)</p>
    </td>
  )
}

function FilaReporte({ fila, total = false }: { fila: Fila, total?: boolean }) {
  return (
    <tr className={total ? "bg-slate-50 font-semibold" : "align-top"}>
      <td className="px-4 py-3">
        {total || !fila.registros?.length ? (
          <>
            <p className="text-slate-800">{fila.centroCostos}</p>
            {fila.operaciones.length > 0 && <p className="text-[11px] font-normal text-slate-400">{fila.operaciones.join(", ")}</p>}
          </>
        ) : (
          <VistaPreviaCentro centro={fila.centroCostos} registros={fila.registros}>
            <p className="text-slate-800 underline decoration-slate-300 decoration-dotted underline-offset-4">{fila.centroCostos}</p>
            {fila.operaciones.length > 0 && <p className="text-[11px] font-normal text-slate-400">{fila.operaciones.join(", ")}</p>}
          </VistaPreviaCentro>
        )}
      </td>
      {GRUPOS.map(g => <Celda key={g.clave} valores={fila.grupos[g.clave]} />)}
      <Celda valores={fila.total} fuerte />
    </tr>
  )
}

// Reporte de anticipos y solicitudes de factura por centro de costos: lo facturado, lo que falta
// por facturar y los anticipos, con base, IVA y total. Lo ven todas las analistas, con todo
// lo de la empresa (decisión del usuario); también se descarga en Excel con el detalle
export default async function ReporteAnticiposPage(props: { searchParams: Promise<{ desde?: string, hasta?: string }> }) {
  const searchParams = await props.searchParams
  await requiereAcceso([])

  const consulta = new URLSearchParams()
  if (searchParams.desde) consulta.set("desde", searchParams.desde)
  if (searchParams.hasta) consulta.set("hasta", searchParams.hasta)

  const respuesta = await fetchApi(`/gastos/anticipos/reporte?${consulta}`)
  const reporte = respuesta.ok ? ReporteSchema.parse(await respuesta.json()) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/anticipos" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
            <ArrowLeft size={13} /> Anticipos
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-800">Reporte por centro de costos</h1>
        </div>
        <a href={`/descargas/reporte-anticipos?${consulta}`} className={claseBotonSecundario}>
          <FileSpreadsheet size={15} /> Descargar Excel
        </a>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block">
          <span className={claseLabel}>Consignado desde</span>
          <input type="date" name="desde" defaultValue={searchParams.desde} className={claseInput} />
        </label>
        <label className="block">
          <span className={claseLabel}>Hasta</span>
          <input type="date" name="hasta" defaultValue={searchParams.hasta} className={claseInput} />
        </label>
        <button type="submit" className={claseBotonPrimario}>Filtrar</button>
        {(searchParams.desde || searchParams.hasta) && <Link href="/anticipos/reporte" className={claseBotonSecundario}>Limpiar</Link>}
      </form>

      {!reporte ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">No se pudo consultar el reporte. Revise las fechas.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Centro de costos</th>
                {GRUPOS.map(g => <th key={g.clave} className="px-4 py-3 text-right font-semibold">{g.titulo}</th>)}
                <th className="px-4 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reporte.centros.map(fila => <FilaReporte key={fila.centroCostos} fila={fila} />)}
              {reporte.centros.length > 0 && <FilaReporte fila={reporte.totales} total />}
            </tbody>
          </table>
          {reporte.centros.length === 0 && <p className="py-14 text-center text-sm text-slate-400">No hay anticipos ni solicitudes de factura en esas fechas.</p>}
        </div>
      )}
    </div>
  )
}
