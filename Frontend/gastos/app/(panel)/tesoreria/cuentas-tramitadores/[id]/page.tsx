import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, ExternalLink, FileDown } from "lucide-react"
import { TESORERIA_OPERATIVA } from "@/src/auth/permisos"
import { requiereAcceso } from "@/src/auth/dal"
import { fetchApi } from "@/src/lib/api"
import { formatoFecha, formatoFechaHora, formatoMoneda } from "@/src/lib/formato"
import { NOMBRE_LINEA, type DetalleCuentaTramitador } from "@/src/lib/cuentasTramitadores"
import Seccion from "@/components/ui/Seccion"
import Dato from "@/components/ui/Dato"
import { claseBotonSecundario } from "@/components/ui/estilos"
import PagarCuentaTramitador from "@/components/cuentasTramitadores/PagarCuentaTramitador"

// Cuenta de cobro de un tramitador: datos para el pago, trámites, distribución por centro de
// costos y el PDF completo; Tesorería la marca pagada
export default async function CuentaTramitadorPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  await requiereAcceso(TESORERIA_OPERATIVA)
  const req = await fetchApi(`/gastos/cuentas-tramitadores/${Number(params.id)}`)
  if (req.status === 404) notFound()
  if (!req.ok) throw new Error("No se pudo consultar la cuenta de cobro")
  const cuenta: DetalleCuentaTramitador = await req.json()
  const t = cuenta.tramitador
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

  return (
    <div className="space-y-5">
      <Link href="/tesoreria/cuentas-tramitadores" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">
        <ChevronLeft size={14} /> Cuentas de tramitadores
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{cuenta.numero} · {t.nombre}</h2>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-700">{formatoMoneda(cuenta.total / 100)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {cuenta.tieneSoportePago && (
            <a href={`/descargas/cuentas-tramitadores/${cuenta.id}?archivo=soporte`} target="_blank" rel="noreferrer" className={claseBotonSecundario}>
              <ExternalLink size={15} /> Soporte de pago
            </a>
          )}
          <a href={`/descargas/cuentas-tramitadores/${cuenta.id}`} target="_blank" rel="noreferrer" className={claseBotonSecundario}>
            <FileDown size={15} /> Cuenta, anexo y distribución (PDF)
          </a>
        </div>
      </div>

      {cuenta.estado === "EN_TESORERIA" && <PagarCuentaTramitador id={cuenta.id} hoy={hoy} />}

      <Seccion titulo="Datos para el pago">
        <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Dato etiqueta="Identificación" valor={t.identificacion} />
          <Dato etiqueta="Banco" valor={t.banco} />
          <Dato etiqueta="Tipo de cuenta" valor={t.tipoCuenta === "BILLETERA" ? "Billetera digital" : t.tipoCuenta?.toLowerCase()} />
          <Dato etiqueta="Número de cuenta" valor={t.numeroCuenta} />
          <Dato etiqueta="Ciudad" valor={t.ciudad} />
          <Dato etiqueta="Correo" valor={t.correo} />
          <Dato etiqueta="Visto bueno" valor={cuenta.vistoBuenoEn ? `${formatoFechaHora(cuenta.vistoBuenoEn)}${cuenta.vistoBuenoPor ? ` · ${cuenta.vistoBuenoPor}` : ""}` : null} />
          <Dato etiqueta="Pago" valor={cuenta.fechaPago ? `${formatoFecha(cuenta.fechaPago)}${cuenta.pagadaPor ? ` · ${cuenta.pagadaPor}` : ""}${cuenta.observacionPago ? ` · ${cuenta.observacionPago}` : ""}` : null} />
        </dl>
      </Seccion>

      <Seccion titulo="Distribución por centro de costos">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4 font-semibold">Centro de costos</th>
                <th className="py-2 pr-4 text-right font-semibold">%</th>
                <th className="py-2 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cuenta.distribucion.map(d => (
                <tr key={d.centroCostos}>
                  <td className="py-2 pr-4 text-slate-700">{d.centroCostos}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-600">{String(d.porcentaje).replace(".", ",")} %</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-slate-700">{formatoMoneda(d.valor / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Trámite</th>
              <th className="px-4 py-3 font-semibold">Detalle</th>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Centro de costos</th>
              <th className="px-4 py-3 text-right font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cuenta.tramites.flatMap(tr => tr.lineas.map((l, i) => (
              <tr key={l.id}>
                <td className="px-4 py-2.5 text-slate-700">{i === 0 && <>#{tr.tramiteId} <span className="text-slate-400">{tr.placa ?? ""}</span></>}</td>
                <td className="px-4 py-2.5 text-slate-700">{l.concepto}{l.tipo !== "TRAMITE" && <span className="text-[11px] text-slate-400"> · {NOMBRE_LINEA[l.tipo]}</span>}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{formatoFecha(l.fecha)}</td>
                <td className="px-4 py-2.5 text-[11px] text-slate-500">{l.centroCostos ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{formatoMoneda(l.valor / 100)}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
