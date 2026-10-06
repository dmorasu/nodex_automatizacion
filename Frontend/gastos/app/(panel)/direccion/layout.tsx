import { requiereAcceso } from "@/src/auth/dal"
import { ROLES } from "@/src/auth/permisos"
import Pestanas from "@/components/ui/Pestanas"

// Dirección de Negocio aprueba en Nodex los pagos que programa Tesorería (después los
// aprueba en la plataforma del banco y Tesorería confirma el pago con el soporte)
export default async function DireccionLayout({ children }: { children: React.ReactNode }) {
  await requiereAcceso([ROLES.DIRECCION_NEGOCIO])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Aprobación de pagos</h1>
        <p className="mt-1 text-sm text-slate-400">
          Revise los pagos que programó Tesorería: apruebe los que deben pagarse y rechace los demás con el motivo.
        </p>
      </div>

      <Pestanas pestanas={[
        { href: "/direccion", nombre: "Por aprobar" },
        { href: "/direccion/historial", nombre: "Historial" }
      ]} />

      {children}
    </div>
  )
}
