import Link from "next/link"
import clsx from "clsx"
import { Settings2 } from "lucide-react"
import { obtenerSesion } from "@/src/auth/dal"
import { ROLES, tieneAcceso } from "@/src/auth/permisos"
import { obtenerCajas, obtenerGastosCaja, obtenerHistorialCaja, obtenerReembolsos } from "@/src/lib/datosCajaMenor"
import { ESTADOS_REEMBOLSO } from "@/src/schemas/gastos"
import HistorialCaja from "@/components/cajaMenor/HistorialCaja"
import TarjetasCaja from "@/components/cajaMenor/TarjetasCaja"
import TablaGastosCaja, { type VistaCaja } from "@/components/cajaMenor/TablaGastosCaja"
import TablaReembolsos from "@/components/cajaMenor/TablaReembolsos"
import Paginacion from "@/components/ui/Paginacion"
import { claseBotonSecundario } from "@/components/ui/estilos"

type Filtros = {
  caja?: string, vista?: string, pagina?: string
  // Reembolsos
  estadoReembolso?: string
  // Historial
  estado?: string, desde?: string, hasta?: string, quienLegaliza?: string, busqueda?: string
}

const ESTADO_DE_VISTA: Record<VistaCaja, string> = {
  "por-pagar": "SOLICITADO",
  "por-legalizar": "PAGADO_CAJA",
  pendientes: "PENDIENTE_REEMBOLSO"
}

const claseChip = (activo: boolean) => clsx(
  "rounded-full border px-3 py-1 text-xs font-semibold",
  activo ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
)

// Caja menor: saldo siempre visible y el trabajo de cada paso (pagar, legalizar, armar el
// reembolso y seguir los reembolsos). Tesorería ve todas las cajas; la auxiliar, solo la suya.
export default async function CajaMenorPage({ searchParams }: { searchParams: Filtros }) {
  const sesion = await obtenerSesion()
  const configura = tieneAcceso(sesion.roles, [ROLES.TESORERIA])
  const cajas = await obtenerCajas()
  const visibles = cajas.filter(c => c.activo)

  if (!visibles.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
        <p className="text-sm text-slate-500">{configura ? "No hay cajas menores activas." : "No tiene una caja menor asignada."}</p>
        {configura && (
          <Link href="/tesoreria/caja-menor/configuracion" className={`${claseBotonSecundario} mt-4`}>
            <Settings2 size={15} /> Configurar cajas
          </Link>
        )}
      </div>
    )
  }

  const caja = visibles.find(c => String(c.id) === searchParams.caja) ?? visibles[0]
  const vistas = ["por-pagar", "por-legalizar", "pendientes", "reembolsos", "historial"] as const
  const vista = vistas.find(v => v === searchParams.vista) ?? "por-pagar"
  const url = (cambios: Filtros) => `/tesoreria/caja-menor?${new URLSearchParams({ caja: String(caja.id), vista, ...cambios } as Record<string, string>)}`
  const estadoReembolso = searchParams.estadoReembolso && ESTADOS_REEMBOLSO[searchParams.estadoReembolso] ? searchParams.estadoReembolso : ""
  const filtrosHistorial = {
    estado: searchParams.estado, desde: searchParams.desde, hasta: searchParams.hasta,
    quienLegaliza: searchParams.quienLegaliza, busqueda: searchParams.busqueda, pagina: searchParams.pagina
  }
  const pagina = Math.max(1, Number(searchParams.pagina) || 1)

  const [gastos, reembolsos, historial] = await Promise.all([
    vista === "reembolsos" || vista === "historial" ? null : obtenerGastosCaja(caja.id, ESTADO_DE_VISTA[vista]),
    vista === "reembolsos" ? obtenerReembolsos({ bolsaId: caja.id, estado: estadoReembolso || undefined, pagina }) : null,
    vista === "historial" ? obtenerHistorialCaja(caja.id, filtrosHistorial) : null
  ])

  const conteo: Record<typeof vistas[number], string> = {
    "por-pagar": `Por pagar (${caja.porPagar.cantidad})`,
    "por-legalizar": `Por legalizar (${caja.sinLegalizar.cantidad})`,
    pendientes: `Pendientes por reembolso (${caja.pendienteReembolso.cantidad})`,
    reembolsos: "Reembolsos",
    historial: "Historial"
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {visibles.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {visibles.map(c => (
              <Link key={c.id} href={`/tesoreria/caja-menor?caja=${c.id}&vista=${vista}`} className={claseChip(c.id === caja.id)}>
                {c.nombre}{c.bajoTope && " ⚠"}
              </Link>
            ))}
          </div>
        ) : <h2 className="text-base font-semibold text-slate-800">{caja.nombre}</h2>}
        {configura && (
          <Link href="/tesoreria/caja-menor/configuracion" className={claseBotonSecundario}>
            <Settings2 size={15} /> Configurar cajas
          </Link>
        )}
      </div>

      <TarjetasCaja caja={caja} />

      <div className="flex flex-wrap gap-2">
        {vistas.map(v => <Link key={v} href={url({ vista: v })} className={claseChip(v === vista)}>{conteo[v]}</Link>)}
      </div>

      {gastos && <TablaGastosCaja bolsaId={caja.id} vista={vista as VistaCaja} gastos={gastos.registros} disponible={caja.saldo} />}
      {reembolsos && (
        <>
          <div className="flex flex-wrap gap-2">
            {[["", "Todos"], ...Object.entries(ESTADOS_REEMBOLSO)].map(([codigo, nombre]) => (
              <Link
                key={codigo}
                href={url({ estadoReembolso: codigo })}
                className={clsx("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                  estadoReembolso === codigo ? "border-slate-400 bg-slate-100 text-slate-700" : "border-slate-200 text-slate-400 hover:bg-slate-50")}
              >
                {nombre}
              </Link>
            ))}
          </div>
          <TablaReembolsos reembolsos={reembolsos.registros} base="/tesoreria/caja-menor/reembolsos" vacio={estadoReembolso ? "No hay reembolsos en este estado." : "Esta caja no tiene reembolsos."} />
          <Paginacion pagina={pagina} total={reembolsos.total} tamano={reembolsos.tamano} url={p => url({ estadoReembolso, pagina: String(p) })} />
        </>
      )}
      {historial && <HistorialCaja bolsaId={caja.id} filtros={filtrosHistorial} historial={historial} />}
    </div>
  )
}
