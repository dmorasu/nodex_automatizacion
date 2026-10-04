"use client"

import { useState } from "react"
import { toast } from "react-toastify"
import { Download, Loader2 } from "lucide-react"
import { claseBotonPrimario } from "../ui/estilos"

export const MAXIMO_DESCARGA = 50

// Descarga en un ZIP los documentos de los gastos indicados (una carpeta por gasto)
export default function BotonDescargarDocumentos({
  gastoIds,
  texto = "Descargar documentos",
  alTerminar
}: {
  gastoIds: number[]
  texto?: string
  alTerminar?: () => void
}) {
  const [descargando, setDescargando] = useState(false)

  const descargar = async () => {
    if (gastoIds.length === 0) return toast.error("Seleccione al menos un gasto")
    if (gastoIds.length > MAXIMO_DESCARGA) return toast.error(`Puede descargar máximo ${MAXIMO_DESCARGA} gastos a la vez`)

    setDescargando(true)
    try {
      const respuesta = await fetch("/documentos/descargar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gastoIds })
      })

      if (!respuesta.ok) {
        const json = await respuesta.json().catch(() => null)
        toast.error(json?.error ?? "No se pudieron descargar los documentos")
        return
      }

      // Guarda el ZIP con el nombre que da el servidor
      const nombre = respuesta.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "documentos.zip"
      const url = URL.createObjectURL(await respuesta.blob())
      const enlace = document.createElement("a")
      enlace.href = url
      enlace.download = nombre
      enlace.click()
      URL.revokeObjectURL(url)

      const archivos = Number(respuesta.headers.get("X-Archivos") ?? 0)
      const faltantes = Number(respuesta.headers.get("X-Faltantes") ?? 0)
      toast.success(`${archivos} documento(s) de ${gastoIds.length} gasto(s) descargados`)
      if (faltantes > 0) toast.warning(`${faltantes} archivo(s) no se pudieron leer: revise "LEEME" dentro del ZIP`, { autoClose: false })
      alTerminar?.()
    } catch {
      toast.error("No se pudieron descargar los documentos")
    } finally {
      setDescargando(false)
    }
  }

  return (
    <button type="button" onClick={descargar} disabled={descargando || gastoIds.length === 0} className={claseBotonPrimario}>
      {descargando ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
      {descargando ? "Preparando ZIP..." : texto}
    </button>
  )
}
