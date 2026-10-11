import { Search } from "lucide-react"
import { fetchApi } from "@/src/lib/api"
import { obtenerBolsas } from "@/src/lib/datosTesoreria"
import { formatoMoneda } from "@/src/lib/formato"
import { ListadoGastosSchema } from "@/src/schemas/gastos"
import BandejaPagos from "@/components/tesoreria/BandejaPagos"
import { claseBotonSecundario, claseInput } from "@/components/ui/estilos"

// Máximo que permite el backend por página
const MAXIMO_BANDEJA = 100

// Gastos por pagar, en tres bandejas:
//  · general: se programan para aprobación de Dirección de Negocio;
//  · certificados (CTL y Cámara de Comercio) y anticipos (el cliente ya pagó): se pagan directo.
// Las compras de certificados (CTL y Cámara de Comercio) van en su propia
// bandeja (Tesorería - Certificados) y no salen en la general.
export default async function BandejaPorPagar({
  tipo,
  searchParams
}: {
  tipo: "general" | "certificados" | "anticipos"
  searchParams: { bolsaId?: string, busqueda?: string }
}) {
  const consulta = new URLSearchParams({
    alcance: "todos",
    estado: "SOLICITADO",
    tamano: String(MAXIMO_BANDEJA),
    ...(tipo === "anticipos" ? { anticipo: "si" } : { anticipo: "no", certificados: tipo === "certificados" ? "si" : "no" })
  })
  if (searchParams.bolsaId) consulta.set("bolsaId", searchParams.bolsaId)
  if (searchParams.busqueda) consulta.set("busqueda", searchParams.busqueda)

  const [bolsas, respuesta] = await Promise.all([
    obtenerBolsas(),
    fetchApi(`/gastos/solicitudes?${consulta}`)
  ])

  const { total, registros } = ListadoGastosSchema.parse(await respuesta.json())
  // Los gastos de anticipos se pagan de las bolsas de anticipos; los demás, de las generales
  const bolsasActivas = bolsas.filter(b => b.activo && b.tipo === (tipo === "anticipos" ? "ANTICIPOS" : "GENERAL"))

  return (
    <div className="space-y-4">

      {/* Saldos: la bandeja de certificados no los muestra */}
      {tipo !== "certificados" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {bolsasActivas.map(bolsa => (
            <div key={bolsa.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{bolsa.nombre}</p>
              <p className="mt-1 text-base font-semibold text-slate-800">{formatoMoneda(bolsa.saldoActual)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <form className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            name="busqueda"
            defaultValue={searchParams.busqueda}
            placeholder="Código, concepto, factura o beneficiario"
            className={`${claseInput} pl-9`}
            aria-label="Buscar"
          />
        </div>
        <select name="bolsaId" defaultValue={searchParams.bolsaId ?? ""} className={`${claseInput} w-auto`} aria-label="Bolsa">
          <option value="">Todas las bolsas</option>
          {bolsasActivas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
        </select>
        <button type="submit" className={claseBotonSecundario}>Filtrar</button>
      </form>

      {total > MAXIMO_BANDEJA && (
        <p className="text-xs text-amber-700">
          Se muestran los {MAXIMO_BANDEJA} más recientes de {total} pendientes. Use los filtros para ver los demás.
        </p>
      )}

      <BandejaPagos gastos={registros} bolsas={bolsasActivas} directo={tipo !== "general"} />
    </div>
  )
}
