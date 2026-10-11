"use client"

import { useEffect } from "react"
import { toast } from "react-toastify"

// Muestra los errores de un formulario (server action) como avisos, con el mismo diseño del resto
// de la app. Cada respuesta trae un arreglo nuevo, así que al volver a enviar se avisa de nuevo.
export default function AvisarErrores({ errores }: { errores: string[] }) {
  useEffect(() => {
    errores.forEach(error => toast.error(error))
  }, [errores])

  return null
}
