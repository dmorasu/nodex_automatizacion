import { requiereAcceso } from "@/src/auth/dal"
import { ROLES, tieneAcceso } from "@/src/auth/permisos"
import Pestanas from "@/components/ui/Pestanas"

// Tesorería general paga todo menos las compras de certificados; Tesorería - Certificados
// paga solo esas (CTL, Cámara de Comercio y RUNT); la Auxiliar de Tesorería - Caja menor solo maneja
// su caja. Cada uno ve sus pestañas.
export default async function TesoreriaLayout({ children }: { children: React.ReactNode }) {
  const sesion = await requiereAcceso([ROLES.TESORERIA, ROLES.TESORERIA_CERTIFICADOS, ROLES.AUXILIAR_TESORERIA_CAJA])
  const general = tieneAcceso(sesion.roles, [ROLES.TESORERIA])
  const certificados = tieneAcceso(sesion.roles, [ROLES.TESORERIA_CERTIFICADOS])
  const caja = general || sesion.roles.includes(ROLES.AUXILIAR_TESORERIA_CAJA)
  const pagos = general || certificados

  const pestanas = [
    ...(general ? [{ href: "/tesoreria", nombre: "Por pagar" }] : []),
    ...(certificados ? [{ href: "/tesoreria/certificados", nombre: "Certificados (CTL, Cámara y RUNT)" }] : []),
    ...(general ? [{ href: "/tesoreria/anticipos", nombre: "Gastos de anticipos" }] : []),
    ...(caja ? [{ href: "/tesoreria/caja-menor", nombre: "Caja menor" }] : []),
    ...(general ? [{ href: "/tesoreria/programados", nombre: "Programados" }] : []),
    ...(general ? [{ href: "/tesoreria/bolsas", nombre: "Bolsas" }] : []),
    ...(pagos ? [{ href: "/tesoreria/lotes", nombre: "Pagos realizados" }] : []),
    ...(general ? [
      { href: "/tesoreria/cuentas", nombre: "Cuentas de cobro" },
      { href: "/tesoreria/reintegros-tramitador", nombre: "Reintegros por tramitador" }
    ] : [])
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Tesorería</h1>
      </div>

      <Pestanas pestanas={pestanas} />

      {children}
    </div>
  )
}
