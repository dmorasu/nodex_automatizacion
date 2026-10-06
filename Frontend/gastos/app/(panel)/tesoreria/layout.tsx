import { requiereAcceso } from "@/src/auth/dal"
import { ROLES, tieneAcceso } from "@/src/auth/permisos"
import Pestanas from "@/components/ui/Pestanas"

// Tesorería general paga todo menos las compras de certificados; Tesorería - Certificados
// paga solo esas (CTL y Cámara de Comercio). Cada uno ve sus pestañas.
export default async function TesoreriaLayout({ children }: { children: React.ReactNode }) {
  const sesion = await requiereAcceso([ROLES.TESORERIA, ROLES.TESORERIA_CERTIFICADOS])
  const general = tieneAcceso(sesion.roles, [ROLES.TESORERIA])
  const certificados = tieneAcceso(sesion.roles, [ROLES.TESORERIA_CERTIFICADOS])

  const pestanas = [
    ...(general ? [{ href: "/tesoreria", nombre: "Por pagar" }] : []),
    ...(certificados ? [{ href: "/tesoreria/certificados", nombre: "Certificados (CTL y Cámara)" }] : []),
    ...(general ? [{ href: "/tesoreria/programados", nombre: "Programados" }] : []),
    ...(general ? [{ href: "/tesoreria/bolsas", nombre: "Bolsas" }] : []),
    { href: "/tesoreria/lotes", nombre: "Pagos realizados" },
    ...(general ? [
      { href: "/tesoreria/cuentas", nombre: "Cuentas de cobro" },
      { href: "/tesoreria/reintegros-tramitador", nombre: "Reintegros por tramitador" }
    ] : [])
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Tesorería</h1>
        <p className="mt-1 text-sm text-slate-400">
          {general
            ? "Programa los pagos, confirma los aprobados por Dirección de Negocio con el soporte del banco y controla las bolsas."
            : "Pago de las compras de CTL y certificados de Cámara de Comercio."}
        </p>
      </div>

      <Pestanas pestanas={pestanas} />

      {children}
    </div>
  )
}
