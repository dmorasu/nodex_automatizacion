import { Metadata } from "next"
import Link from "next/link"
import { Route } from "lucide-react"
import { verificacionSesion } from "@/src/auth/dal"
import type { RutasDelDia, Sede } from "@/src/rutas"
import BarraRutas from "@/components/rutas/BarraRutas"
import GestionSedes from "@/components/rutas/GestionSedes"
import PanelRutas from "@/components/rutas/PanelRutas"

export const metadata: Metadata = {
  title: "Nodex - Rutas de mensajeros",
}

// Rutas del día de los mensajeros: un mapa con las rutas elegidas, orden editable y optimizable,
// y lo que confirmaron en campo desde su app
export default async function RutasPage({ searchParams }: { searchParams: { fecha?: string, sedeId?: string } }) {
  const { token } = await verificacionSesion()
  const encabezados = { Authorization: `Bearer ${token}` }

  const leer = async <T,>(ruta: string, vacio: T): Promise<T> => {
    try {
      const req = await fetch(`${process.env.API_URL}${ruta}`, { headers: encabezados, cache: "no-store" })
      return req.ok ? await req.json() : vacio
    } catch {
      return vacio
    }
  }

  const configuracion = await leer<{ googleDisponible: boolean, hoy: string }>("/mensajeria/configuracion", { googleDisponible: false, hoy: "" })
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.fecha ?? "") ? searchParams.fecha! : configuracion.hoy
  const consulta = new URLSearchParams({ fecha })
  if (searchParams.sedeId) consulta.set("sedeId", searchParams.sedeId)

  const [rutas, sedes] = await Promise.all([
    leer<RutasDelDia | null>(`/mensajeria/rutas?${consulta}`, null),
    leer<Sede[]>("/mensajeria/sedes", [])
  ])

  const sinUbicacion = rutas?.rutas.reduce((s, r) => s + r.resumen.sinUbicacion, 0) ?? 0
  const sedesActivas = sedes.filter(s => s.activo !== false)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-100 bg-sky-50">
              <Route size={19} className="text-sky-500" />
            </span>
            <h1 className="text-xl font-semibold text-slate-800">Rutas de mensajeros</h1>
          </div>
          <p className="mt-1 ml-11 text-xs text-slate-400">
            Diligencias del día de cada mensajero (por fecha de diligencia). Ordénelas, optimícelas y vea lo que confirmaron en campo.
          </p>
        </div>
        <GestionSedes sedes={sedes} googleDisponible={configuracion.googleDisponible} />
      </div>

      <BarraRutas fecha={fecha} hoy={configuracion.hoy} sedes={sedesActivas} sinUbicacion={sinUbicacion} googleDisponible={configuracion.googleDisponible} />

      {!configuracion.googleDisponible && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          La ubicación automática con Google no está configurada: las direcciones se ubican a mano en el mapa y &quot;Optimizar&quot; ordena por cercanía.
          Para activarla agregue <code className="font-mono">GOOGLE_MAPS_API_KEY</code> al backend.
        </p>
      )}

      {!rutas ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">No se pudieron cargar las rutas.</p>
      ) : rutas.rutas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-xs text-slate-500">
          No hay mensajeros{searchParams.sedeId ? " en esta sede" : ""}. Marque tramitadores como mensajeros y asígneles una sede en{" "}
          <Link href="/center/catalogos?pestana=tramitadores" className="font-semibold text-sky-600 hover:underline">Tramitadores</Link>.
        </div>
      ) : (
        <PanelRutas key={fecha} rutas={rutas.rutas} fecha={fecha} hoy={configuracion.hoy} googleDisponible={rutas.googleDisponible} />
      )}
    </div>
  )
}
