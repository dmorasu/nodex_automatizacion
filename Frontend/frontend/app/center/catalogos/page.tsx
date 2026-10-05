import Link from "next/link"
import { Metadata } from "next"
import clsx from "clsx"
import { Ban, BriefcaseBusiness, FileText, HardHat } from "lucide-react"
import { requierePerfil } from "@/src/auth/dal"
import { encabezadosSesion } from "@/src/lib/sesionApi"
import AdministrarCatalogos, { type PestanaCatalogo } from "@/components/catalogos/AdministrarCatalogos"
import GestionTramitadores, { type SedeOpcion, type Tramitador } from "@/components/tramitador/GestionTramitadores"

export const metadata: Metadata = {
  title: "Nodex - Catálogos",
}

type Pestana = "tramitadores" | PestanaCatalogo

const PESTANAS: { id: Pestana, nombre: string, icono: typeof HardHat, descripcion: string, soloAdministradores?: boolean }[] = [
  { id: "tramitadores", nombre: "Tramitadores", icono: HardHat, descripcion: "Cree, edite y active o desactive tramitadores. Los inactivos no se pueden asignar a trámites." },
  { id: "tramites", nombre: "Tipos de trámite", icono: FileText, descripcion: "Tipos de trámite y sus subestados.", soloAdministradores: true },
  { id: "operaciones", nombre: "Operaciones", icono: BriefcaseBusiness, descripcion: "Operaciones y su centro de costos (también las usa Nodex Gastos).", soloAdministradores: true },
  { id: "rechazos", nombre: "Tipos de rechazo", icono: Ban, descripcion: "Causas que se eligen al pasar un trámite a novedad.", soloAdministradores: true }
]

// Catálogos de Nodex Trámites. Tramitadores: Torre de control (como antes en su propia página).
// Tipos de trámite, operaciones y rechazos: Administrador de Torre de control o Admin
// (el backend revisa el mismo permiso).
export default async function CatalogosPage({ searchParams }: { searchParams: { pestana?: string } }) {
  const { puedeAsignarAnalistas } = await requierePerfil(["TORRE_CONTROL"])

  const disponibles = PESTANAS.filter(p => !p.soloAdministradores || puedeAsignarAnalistas)
  const actual = disponibles.find(p => p.id === searchParams.pestana) ?? disponibles[0]

  let tramitadores: Tramitador[] = []
  let sedes: SedeOpcion[] = []
  if (actual.id === "tramitadores") {
    const [req, reqSedes] = await Promise.all([
      fetch(`${process.env.API_URL}/tramitador/tramitadores`, { headers: encabezadosSesion(), cache: "no-store" }),
      // Sedes de mensajería (para marcar mensajeros)
      fetch(`${process.env.API_URL}/mensajeria/sedes`, { headers: encabezadosSesion(), cache: "no-store" })
    ])
    tramitadores = req.ok ? await req.json() : []
    sedes = reqSedes.ok ? await reqSedes.json() : []
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Catálogos</h1>
        <p className="mt-1 text-sm text-slate-400">{actual.descripcion}</p>
      </div>

      {disponibles.length > 1 && (
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Catálogos">
          {disponibles.map(({ id, nombre, icono: Icono }) => (
            <Link
              key={id}
              href={`/center/catalogos?pestana=${id}`}
              aria-current={actual.id === id ? "page" : undefined}
              className={clsx(
                "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition",
                actual.id === id ? "border-sky-500 text-sky-700" : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              <Icono size={14} /> {nombre}
            </Link>
          ))}
        </nav>
      )}

      {actual.id === "tramitadores"
        ? <GestionTramitadores tramitadores={tramitadores} sedes={sedes} />
        : <AdministrarCatalogos key={actual.id} pestana={actual.id} />}
    </div>
  )
}
