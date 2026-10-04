import { Metadata } from "next"
import { HardHat } from "lucide-react"
import { encabezadosSesion } from "@/src/lib/sesionApi"
import GestionTramitadores, { type SedeOpcion, type Tramitador } from "@/components/tramitador/GestionTramitadores"

export const metadata: Metadata = {
  title: "Nodex - Tramitadores",
}

export default async function TramitadoresPage() {
  const [req, reqSedes] = await Promise.all([
    fetch(`${process.env.API_URL}/tramitador/tramitadores`, { headers: encabezadosSesion(), cache: "no-store" }),
    // Sedes de mensajería (para marcar mensajeros)
    fetch(`${process.env.API_URL}/mensajeria/sedes`, { headers: encabezadosSesion(), cache: "no-store" })
  ])
  const tramitadores: Tramitador[] = req.ok ? await req.json() : []
  const sedes: SedeOpcion[] = reqSedes.ok ? await reqSedes.json() : []

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-50">
          <HardHat className="text-sky-500" size={22} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Tramitadores</h1>
          <p className="text-xs text-slate-500">
            Cree, edite y active o desactive tramitadores. Los inactivos no se pueden asignar a trámites.
          </p>
        </div>
      </div>

      <GestionTramitadores tramitadores={tramitadores} sedes={sedes} />
    </div>
  )
}
