"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { ExternalLink, MapPin, MapPinOff } from "lucide-react"
import { llamarApi } from "@/src/lib/apiCliente"
import ModalUbicacion from "./ModalUbicacion"

// Ubicación de la dirección del trámite (para las rutas de mensajeros): ver y corregir
export default function UbicacionTramite({ tramiteId, direccion, latitud, longitud, precisa, fuente, puedeEditar }: {
  tramiteId: number
  direccion: string | null
  latitud: number | null
  longitud: number | null
  precisa: boolean | null
  fuente: string | null
  puedeEditar: boolean
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const ubicada = latitud !== null && longitud !== null

  return (
    <div className="space-y-2 text-xs">
      {ubicada ? (
        <p className={`flex items-center gap-1.5 ${precisa === false ? "text-amber-700" : "text-slate-600"}`}>
          <MapPin size={14} />
          {precisa === false ? "Ubicación aproximada: conviene verificarla" : fuente === "MANUAL" ? "Ubicada a mano en el mapa" : "Ubicada automáticamente"}
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-amber-700"><MapPinOff size={14} /> Sin ubicar</p>
      )}

      <div className="flex flex-wrap gap-3">
        {ubicada && (
          <a href={`https://www.google.com/maps/search/?api=1&query=${latitud},${longitud}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-sky-600 hover:underline">
            Ver en Google Maps <ExternalLink size={11} />
          </a>
        )}
        {puedeEditar && (
          <button type="button" onClick={() => setAbierto(true)} className="font-medium text-sky-600 hover:underline">
            {ubicada ? "Corregir" : "Ubicar en el mapa"}
          </button>
        )}
      </div>

      {abierto && (
        <ModalUbicacion
          titulo={`Ubicación del trámite #${tramiteId}`}
          direccion={direccion}
          puntoInicial={ubicada ? { latitud: latitud!, longitud: longitud! } : null}
          onGuardar={async punto => {
            const r = await llamarApi(`/mensajeria/tramites/${tramiteId}/ubicacion`, "PUT", punto)
            if (!r.ok) { toast.error(r.error); return false }
            toast.success("Ubicación guardada")
            router.refresh()
            return true
          }}
          onBuscarGoogle={async () => {
            const r = await llamarApi<{ latitud: number, longitud: number, ubicacionPrecisa: boolean }>(`/mensajeria/tramites/${tramiteId}/ubicar`, "POST")
            if (!r.ok) { toast.error(r.error); return null }
            if (!r.datos.ubicacionPrecisa) toast.warning("Google la ubicó de forma aproximada: verifique el punto")
            return { latitud: r.datos.latitud, longitud: r.datos.longitud }
          }}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </div>
  )
}
