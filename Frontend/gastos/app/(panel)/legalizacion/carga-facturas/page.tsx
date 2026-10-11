import { fetchApi } from "@/src/lib/api"
import { obtenerCatalogos, obtenerTasas } from "@/src/lib/datosGastos"
import { ListadoGastosSchema } from "@/src/schemas/gastos"
import CargaMasivaFacturas from "@/components/legalizacion/CargaMasivaFacturas"

// Varias facturas de distintos gastos en una sola pasada (gastos reembolsables pagados sin factura registrada)
export default async function CargaFacturasPage() {
  const consulta = new URLSearchParams({ alcance: "todos", estado: "PAGADO", reembolsable: "si", tamano: "100", orden: "antiguos" })

  const [respuesta, tasas, catalogos] = await Promise.all([
    fetchApi(`/gastos/solicitudes?${consulta}`),
    obtenerTasas(),
    obtenerCatalogos()
  ])
  const { total, registros } = ListadoGastosSchema.parse(await respuesta.json())

  return (
    <div className="space-y-4">
      {total > 100 && <p className="text-xs text-amber-700">Hay {total} gastos sin factura; en la lista aparecen los 100 más antiguos.</p>}

      {registros.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-400">
          No hay gastos pagados pendientes de factura.
        </p>
      ) : (
        <CargaMasivaFacturas
          gastos={registros}
          tasas={tasas}
          tipoDocumentoFacturaId={catalogos.tiposDocumento.find(t => t.codigo === "FACTURA")?.id ?? null}
        />
      )}
    </div>
  )
}
