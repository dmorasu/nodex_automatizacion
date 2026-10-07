import { obtenerClientesEmpresariales } from "@/src/lib/datosAnticipos"
import ClientesEmpresariales from "@/components/anticipos/ClientesEmpresariales"

export default async function ClientesEmpresarialesPage() {
  const clientes = await obtenerClientesEmpresariales(true)
  return <ClientesEmpresariales clientes={clientes} />
}
