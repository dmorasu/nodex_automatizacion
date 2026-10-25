import { Metadata } from "next"
import { Download, Radar } from "lucide-react"
import { verificacionSesion } from "@/src/auth/dal"
import type { OpcionFiltro, Tablero } from "@/src/tablero"
import FiltrosTablero from "@/components/tablero/FiltrosTablero"
import Indicadores from "@/components/tablero/Indicadores"
import RequiereAtencion from "@/components/tablero/RequiereAtencion"
import TablaAnalistas from "@/components/tablero/TablaAnalistas"
import TendenciaSemanal from "@/components/tablero/TendenciaSemanal"
import Antiguedad from "@/components/tablero/Antiguedad"
import TablaTramitadores from "@/components/tablero/TablaTramitadores"
import TablaOperaciones from "@/components/tablero/TablaOperaciones"
import CausasNovedad from "@/components/tablero/CausasNovedad"
import MapaMunicipios from "@/components/tablero/MapaMunicipios"

export const metadata: Metadata = {
  title: "Nodex - Tablero de gestión",
}

// valorDesde/valorHasta: rango propio de "Valor por operación" (lo maneja esa ficha)
const FILTROS = ["desde", "hasta", "analistaId", "tramitadorId", "operacionId", "tramiteId", "estadoId", "valorDesde", "valorHasta"] as const

// Tablero de gestión de Torre de control. El Administrador de Torre de control y Admin ven
// todos los trámites (y la carga por analista); cada analista ve solo los suyos.
export default async function TableroGestionPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams
  const { token, esAnalista } = await verificacionSesion()
  const encabezados = { Authorization: `Bearer ${token}` }

  const leer = async <T,>(ruta: string, vacio: T): Promise<T> => {
    try {
      const req = await fetch(`${process.env.API_URL}${ruta}`, { headers: encabezados, cache: "no-store" })
      return req.ok ? await req.json() : vacio
    } catch {
      return vacio
    }
  }

  const consulta = new URLSearchParams()
  for (const clave of FILTROS) {
    const valor = searchParams[clave]
    if (valor) consulta.set(clave, valor)
  }

  const [tablero, analistas, tramitadores, operaciones, tramites, estados] = await Promise.all([
    leer<Tablero | null>(`/solicitudTramites/tablero?${consulta}`, null),
    esAnalista ? Promise.resolve([]) : leer<{ id: number, nombreUsuario: string }[]>("/solicitudTramites/analistas", []),
    leer<{ id: number, nombreTramitador: string }[]>("/tramitador/tramitadores", []),
    leer<{ id: number, nombreOperacion: string }[]>("/operaciones", []),
    leer<{ id: number, nombreTramite: string }[]>("/tramites", []),
    leer<{ id: number, nombreEstado: string }[]>("/estados", [])
  ])

  const opciones = <T,>(lista: T[], nombre: (x: T) => string, id: (x: T) => number): OpcionFiltro[] =>
    (Array.isArray(lista) ? lista : [])
      .map(x => ({ id: id(x), nombre: (nombre(x) ?? "").trim() }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-100 bg-sky-50">
            <Radar size={19} className="text-sky-500" />
          </span>
          <h1 className="text-xl font-semibold text-slate-800">{esAnalista ? "Mi tablero" : "Tablero de gestión"}</h1>
        </div>
        <p className="mt-1 ml-11 text-xs text-slate-400">
          {esAnalista
            ? "Tus trámites asignados: lo que requiere atención y cómo vas."
            : "Qué requiere atención hoy y cómo va el equipo."}
        </p>
      </div>

        {/* Mismos filtros, listas completas (pasa por el proxy con la sesión) */}
        {tablero && (
          <a
            href={`/api/backend/solicitudTramites/tablero/exportar?${consulta}`}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <Download size={15} />
            Exportar a Excel
          </a>
        )}
      </div>

      {!tablero ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">No se pudo cargar el tablero. Intente de nuevo.</p>
      ) : (
        <>
          <FiltrosTablero
            hoy={tablero.hoy}
            desde={tablero.filtros.desde}
            hasta={tablero.filtros.hasta}
            analistas={opciones(analistas, a => a.nombreUsuario, a => a.id)}
            tramitadores={opciones(tramitadores, t => t.nombreTramitador, t => t.id)}
            operaciones={opciones(operaciones, o => o.nombreOperacion, o => o.id)}
            tramites={opciones(tramites, t => t.nombreTramite, t => t.id)}
            // En el orden del proceso (Sin Iniciar, En Curso, novedad...), no alfabético
            estados={(Array.isArray(estados) ? estados : []).map(e => ({ id: e.id, nombre: e.nombreEstado })).sort((a, b) => a.id - b.id)}
            mostrarAnalista={!esAnalista}
          />

          <Indicadores tablero={tablero} />

          <RequiereAtencion tablero={tablero} mostrarSinAnalista={!esAnalista} />

          {!esAnalista && <TablaAnalistas filas={tablero.porAnalista} />}

          <TablaTramitadores filas={tablero.porTramitador} reintegrosDisponibles={tablero.reintegrosDisponibles} />

          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <TendenciaSemanal tendencia={tablero.tendencia} />
            <Antiguedad antiguedad={tablero.antiguedad} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <CausasNovedad causas={tablero.causasNovedad} />
            <TablaOperaciones datos={tablero.valorPorOperacion} hoy={tablero.hoy} />
          </div>

          <MapaMunicipios municipios={tablero.porMunicipio} />

          <p className="text-[11px] text-slate-400">
            Vencido: más de {tablero.diasGracia} días desde la fecha de programación sin finalizar (los que están en espera por novedad no cuentan; se ven en su propia lista). A tiempo: finalizado a más tardar {tablero.diasGracia} días
            después de la fecha programada. Finalizados, % a tiempo, ciclo, valor y causas de novedad se calculan en el período elegido; abiertos, vencidos,
            alertas y mapa son a hoy.
          </p>
        </>
      )}
    </div>
  )
}
