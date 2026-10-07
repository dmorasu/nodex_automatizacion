"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, FilePlus2, Pencil } from "lucide-react"
import { anularAnticipo, marcarNovedadAnticipo } from "@/actions/gastos/anticipos"
import type { AnticipoDetalle } from "@/src/schemas/gastos"
import BotonConMotivo from "../ui/BotonConMotivo"
import { claseBotonPrimario, claseBotonSecundario } from "../ui/estilos"
import ModalConfirmarAnticipos from "./ModalConfirmarAnticipos"

// Botones del detalle del anticipo según los permisos que manda el backend
export default function AccionesAnticipo({ anticipo }: { anticipo: AnticipoDetalle }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const { permisos } = anticipo

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
          descripcion="El anticipo queda anulado y no pasa a Contabilidad."
          mensajeExito="Anticipo anulado"
          onConfirmar={motivo => anularAnticipo(anticipo.id, motivo)}
        />
      )}
      {permisos.revisar && (
        <>
          <BotonConMotivo
            etiqueta="Marcar novedad"
            titulo={`Novedad en ${anticipo.codigo}`}
            descripcion="El anticipo se devuelve a quien lo registró para que lo corrija. Explique qué encontró."
            mensajeExito="Anticipo devuelto con la novedad"
            onConfirmar={motivo => marcarNovedadAnticipo(anticipo.id, motivo)}
          />
          <button type="button" onClick={() => setConfirmando(true)} className={claseBotonPrimario}>
            <CheckCircle2 size={15} />
            Confirmar pago recibido
          </button>
        </>
      )}

      {confirmando && (
        <ModalConfirmarAnticipos
          anticipos={[anticipo]}
          onCerrar={() => setConfirmando(false)}
          onConfirmados={() => router.refresh()}
        />
      )}
    </div>
  )
}
