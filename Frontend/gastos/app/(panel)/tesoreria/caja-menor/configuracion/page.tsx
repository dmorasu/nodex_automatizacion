import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { requiereAcceso } from "@/src/auth/dal"
import { ROLES } from "@/src/auth/permisos"
import { obtenerCajas, obtenerUsuariosCaja } from "@/src/lib/datosCajaMenor"
import ConfiguracionCajas from "@/components/cajaMenor/ConfiguracionCajas"

// Solo Tesorería (y el administrador): la auxiliar de caja no configura
export default async function ConfiguracionCajasPage() {
  await requiereAcceso([ROLES.TESORERIA])
  const [cajas, usuarios] = await Promise.all([obtenerCajas(), obtenerUsuariosCaja()])

  return (
    <div className="space-y-4">
      <Link href="/tesoreria/caja-menor" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
        <ArrowLeft size={14} /> Volver a caja menor
      </Link>
      <ConfiguracionCajas cajas={cajas} usuarios={usuarios} />
    </div>
  )
}
