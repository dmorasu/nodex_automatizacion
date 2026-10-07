import Link from "next/link"
import { ChevronRight, ClipboardList, Receipt, Wallet } from "lucide-react"
import { requiereSesion } from "@/src/auth/sesion"
import { obtenerDatos } from "@/src/lib/api"
import { formatoMoneda } from "@/src/lib/formato"
import { ClavePushSchema, ListadoGastosSchema, ListadoTramitesSchema } from "@/src/schemas"
import TarjetaTramite from "@/components/tramites/TarjetaTramite"
import ActivarNotificaciones from "@/components/notificaciones/ActivarNotificaciones"

// Pantalla de inicio: lo que tiene pendiente hoy
export default async function InicioPage({ searchParams }: { searchParams: { bienvenida?: string } }) {
  const [sesion, tramites, gastos, push] = await Promise.all([
    requiereSesion(),
    obtenerDatos("/tramites?filtro=activos", ListadoTramitesSchema),
    obtenerDatos("/gastos", ListadoGastosSchema),
    // Si falla, el inicio carga igual (solo no ofrece activar las notificaciones)
    obtenerDatos("/notificaciones/clave", ClavePushSchema).catch(() => null)
  ])

  const primerNombre = sesion.nombre.split(" ")[0]
  const resumen = gastos!.resumen
  const proximos = tramites!.registros.slice(0, 3)

  const indicadores = [
    { href: "/tramites", Icono: ClipboardList, valor: String(tramites!.total), texto: "Trámites activos", alerta: false },
    { href: "/tramites?filtro=sinFactura", Icono: Receipt, valor: String(resumen.gastosSinFactura), texto: "Facturas por subir", alerta: resumen.gastosSinFactura > 0 },
    { href: "/gastos", Icono: Wallet, valor: formatoMoneda(resumen.porReintegrar), texto: "Por reintegrar", alerta: resumen.porReintegrar > 0 }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Hola, {primerNombre}</h1>
        <p className="text-sm text-slate-500">
          {searchParams.bienvenida ? "Su contraseña quedó guardada. ¡Bienvenido!" : "Esto es lo que tiene pendiente."}
        </p>
      </div>

      {push?.clavePublica && <ActivarNotificaciones clavePublica={push.clavePublica} />}

      <div className="grid grid-cols-2 gap-3">
        {indicadores.map(({ href, Icono, valor, texto, alerta }, i) => (
          <Link
            key={texto}
            href={href}
            className={`rounded-xl border p-4 shadow-sm active:opacity-80 ${i === 0 ? "col-span-2" : ""} ${alerta ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}
          >
            <Icono size={20} className={alerta ? "text-amber-600" : "text-indigo-500"} />
            <p className={`mt-2 text-2xl font-semibold tabular-nums ${alerta ? "text-amber-900" : "text-slate-800"}`}>{valor}</p>
            <p className={`text-xs ${alerta ? "text-amber-800" : "text-slate-500"}`}>{texto}</p>
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Próximos trámites</h2>
          <Link href="/tramites" className="flex items-center text-xs font-semibold text-indigo-600">
            Ver todos <ChevronRight size={14} />
          </Link>
        </div>
        {proximos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white py-8 text-center text-sm text-slate-400">No tiene trámites activos.</p>
        ) : (
          proximos.map(tramite => <TarjetaTramite key={tramite.id} tramite={tramite} />)
        )}
      </section>
    </div>
  )
}
