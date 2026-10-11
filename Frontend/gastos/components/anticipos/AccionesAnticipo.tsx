"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, FileCheck2, FilePlus2, Pencil } from "lucide-react"
import { anularAnticipo, marcarNovedadAnticipo } from "@/actions/gastos/anticipos"
import type { AnticipoDetalle } from "@/src/schemas/gastos"
import BotonConMotivo from "../ui/BotonConMotivo"
import { claseBotonPrimario, claseBotonSecundario } from "../ui/estilos"
import ModalConfirmarAnticipos from "./ModalConfirmarAnticipos"
import ModalFacturarSolicitudes from "./ModalFacturarSolicitudes"

// Botones del detalle del anticipo (o de la solicitud de factura) según los permisos que manda el backend
export default function AccionesAnticipo({ anticipo }: { anticipo: AnticipoDetalle }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const { permisos } = anticipo
  const esFactura = anticipo.clase === "FACTURA"

  return (
    <div className="flex flex-wrap gap-3">
      {permisos.crearGasto && (
        <Link href={`/solicitudes/nuevo?anticipo=${anticipo.id}`} className={claseBotonPrimario}>
          <FilePlus2 size={15} />
          Crear gasto
        </Link>
      )}
      {permisos.editar && (
        <Link href={`/anticipos/${anticipo.id}/editar`} className={claseBotonSecundario}>
          <Pencil size={15} />
          {anticipo.estado === "NOVEDAD" ? "Corregir" : "Editar"}
        </Link>
      )}
      {permisos.anular && (
        <BotonConMotivo
          etiqueta="Anular"
          titulo={`Anular ${anticipo.codigo}`}
          descripcion={esFactura ? "La solicitud queda anulada y no pasa a Contabilidad." : "El anticipo queda anulado y no pasa a Contabilidad."}
          mensajeExito={esFactura ? "Solicitud anulada" : "Anticipo anulado"}
          onConfirmar={motivo => anularAnticipo(anticipo.id, motivo)}
        />
      )}
      {permisos.revisar && (
        <>
          <BotonConMotivo
            etiqueta={esFactura ? "Novedad / no pagado" : "Marcar novedad"}
            titulo={`Novedad en ${anticipo.codigo}`}
            descripcion={esFactura
              ? "La solicitud se devuelve a quien la registró para que la corrija (por ejemplo, el pago no entró o el soporte no corresponde). Explique qué encontró."
              : "El anticipo se devuelve a quien lo registró para que lo corrija. Explique qué encontró."}
            mensajeExito={esFactura ? "Solicitud devuelta con la novedad" : "Anticipo devuelto con la novedad"}
            onConfirmar={motivo => marcarNovedadAnticipo(anticipo.id, motivo)}
          />
          <button type="button" onClick={() => setConfirmando(true)} className={claseBotonPrimario}>
            {esFactura ? <FileCheck2 size={15} /> : <CheckCircle2 size={15} />}
            {esFactura ? "Confirmar y facturar" : "Confirmar pago recibido"}
          </button>
        </>
      )}

      {confirmando && esFactura && (
        <ModalFacturarSolicitudes
          solicitudes={[anticipo]}
          onCerrar={() => setConfirmando(false)}
          onFacturadas={() => router.refresh()}
        />
      )}
      {confirmando && !esFactura && (
        <ModalConfirmarAnticipos
          anticipos={[anticipo]}
          onCerrar={() => setConfirmando(false)}
          onConfirmados={() => router.refresh()}
        />
      )}
    </div>
  )
}
