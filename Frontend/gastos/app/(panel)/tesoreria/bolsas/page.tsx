import { obtenerSesion, requiereAcceso } from "@/src/auth/dal"
import { ROLES } from "@/src/auth/permisos"
import { obtenerBolsas } from "@/src/lib/datosTesoreria"
import GestionBolsas from "@/components/tesoreria/GestionBolsas"
import Seccion from "@/components/ui/Seccion"

export default async function BolsasPage() {
  // Solo Tesorería general (Tesorería - Certificados solo ve su bandeja y sus pagos)
  await requiereAcceso([ROLES.TESORERIA])

  const [sesion, bolsas] = await Promise.all([obtenerSesion(), obtenerBolsas()])

  return (
    <Seccion
      titulo="Bolsas"
      descripcion="Cada gasto se asocia a una bolsa. El saldo solo cambia con recargas, pagos y ajustes del administrador."
    >
      <GestionBolsas bolsas={bolsas} esAdmin={sesion.roles.includes(ROLES.ADMIN)} />
    </Seccion>
  )
}
