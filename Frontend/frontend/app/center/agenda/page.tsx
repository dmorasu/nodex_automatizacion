import { Metadata } from "next"
import { CalendarClock } from "lucide-react"
import { verificacionSesion } from "@/src/auth/dal"
import type { AgendaDelDia } from "@/src/agenda"
import type { Sede } from "@/src/rutas"
import PanelAgenda from "@/components/agenda/PanelAgenda"

export const metadata: Metadata = {
  title: "Nodex - Agenda de mensajeros",
}

// Agenda del día de cada mensajero (por fecha de diligencia): citas con su hora, trámites sin
// hora y espacios reservados. Gestión de activos aparta espacios; no cambia nada más.
export default async function AgendaPage(props: { searchParams: Promise<{ fecha?: string, sedeId?: string }> }) {
  const searchParams = await props.searchParams
  const { token, perfil, esAdmin } = await verificacionSesion()
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(searchParams.fecha ?? "")) consulta.set("fecha", searchParams.fecha!)
  if (searchParams.sedeId) consulta.set("sedeId", searchParams.sedeId)

  const esTorreControl = perfil === "TORRE_CONTROL" || esAdmin
  const [agenda, sedes] = await Promise.all([
    leer<AgendaDelDia | null>(`/agenda-mensajeros?${consulta}`, null),
    // Las sedes solo las lee Torre de control; sin ellas no hay filtro por sede
    esTorreControl ? leer<Sede[]>("/mensajeria/sedes", []) : Promise.resolve([] as Sede[])
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-100 bg-sky-50">
          <CalendarClock size={19} className="text-sky-500" />
        </span>
        <h1 className="text-xl font-semibold text-slate-800">Agenda de mensajeros</h1>
      </div>

      {!agenda ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">No se pudo cargar la agenda.</p>
      ) : (
        <PanelAgenda
          key={`${agenda.fecha}-${searchParams.sedeId ?? ""}`}
          agenda={agenda}
          sedes={sedes.filter(s => s.activo !== false)}
          esTorreControl={esTorreControl}
        />
      )}
    </div>
  )
}
