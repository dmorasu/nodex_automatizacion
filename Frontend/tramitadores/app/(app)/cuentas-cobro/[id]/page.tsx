import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, FileDown } from "lucide-react"
import { obtenerDatos } from "@/src/lib/api"
import { formatoFecha, formatoFechaHora, formatoMoneda } from "@/src/lib/formato"
import { DetalleCuentaCobroSchema } from "@/src/schemas"
import Etiqueta from "@/components/ui/Etiqueta"
import { claseBotonSecundario } from "@/components/ui/estilos"
import { ESTADOS_CUENTA, NOMBRE_LINEA } from "@/components/cuentasCobro/estados"
import AccionesCuenta from "@/components/cuentasCobro/AccionesCuenta"

// Detalle de la cuenta de cobro: trámites y valores, el PDF y, si está por aprobar,
// aprobarla con la firma o pedir corrección
export default async function CuentaCobroPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const cuenta = await obtenerDatos(`/cuentas-cobro/${Number(params.id)}`, DetalleCuentaCobroSchema)
  if (!cuenta) notFound()

  const fechas = [
    cuenta.enviadaEn && `Recibida ${formatoFechaHora(cuenta.enviadaEn)}`,
    cuenta.aprobadaEn && `Aprobada ${formatoFechaHora(cuenta.aprobadaEn)}`,
    cuenta.fechaRadicacion && `Radicada ${formatoFecha(cuenta.fechaRadicacion)}`,
    cuenta.fechaPago && `Pagada ${formatoFecha(cuenta.fechaPago)}`
  ].filter(Boolean)

  return (
    <div className="space-y-4">
      <Link href="/cuentas-cobro" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600">
        <ChevronLeft size={16} /> Cuentas de cobro
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-slate-800">{cuenta.numero}</h1>
          <Etiqueta tono={ESTADOS_CUENTA[cuenta.estado].tono}>{ESTADOS_CUENTA[cuenta.estado].nombre}</Etiqueta>
        </div>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-800">{formatoMoneda(cuenta.total / 100)}</p>
        {fechas.length > 0 && <p className="mt-1 text-xs text-slate-500">{fechas.join(" · ")}</p>}
        <a href={`/cuentas-cobro-pdf/${cuenta.id}`} target="_blank" rel="noreferrer" className={`${claseBotonSecundario} mt-3 w-full`}>
          <FileDown size={17} /> Descargar PDF
        </a>
      </div>

      <AccionesCuenta
        id={cuenta.id}
        numero={cuenta.numero}
        total={cuenta.total}
        estado={cuenta.estado}
        tieneFirma={cuenta.tieneFirma}
        tramites={cuenta.tramites.map(t => ({ tramiteId: t.tramiteId, placa: t.placa }))}
        hoy={new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">{cuenta.tramites.length} trámite(s)</h2>
        {cuenta.tramites.map(t => (
          <div key={t.tramiteId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-baseline justify-between gap-3">
              <Link href={`/tramites/${t.tramiteId}`} className="text-sm font-semibold text-indigo-600">Trámite #{t.tramiteId}</Link>
              <span className="text-sm font-semibold tabular-nums text-slate-800">{formatoMoneda(t.total / 100)}</span>
            </div>
            {t.placa && <p className="text-xs text-slate-500">{t.placa}</p>}
            <ul className="mt-2 divide-y divide-slate-100">
              {t.lineas.map(l => (
                <li key={l.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-slate-700">{l.concepto}</p>
                    <p className="text-xs text-slate-400">{l.tipo !== "TRAMITE" && `${NOMBRE_LINEA[l.tipo]} · `}{formatoFecha(l.fecha)}</p>
                  </div>
                  <span className="shrink-0 tabular-nums text-slate-600">{formatoMoneda(l.valor / 100)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  )
}
