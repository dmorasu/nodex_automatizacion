// Reglas de los documentos del trámite, las mismas del detalle (DocumentosSolicitud)
// y del backend (uploadDocumento): PDF o JPG, hasta 10 de 32 MB, nombre de 20 caracteres
export const MAXIMO_DOCUMENTOS = 10
export const TIPOS_DOCUMENTO = ["application/pdf", "image/jpeg", "image/jpg"]
const MAXIMO_BYTES = 32 * 1024 * 1024
const MAXIMO_NOMBRE = 20

// Primer problema que encuentre, o null si se pueden subir
export const validarDocumentos = (archivos: File[]): string | null => {
  if (archivos.length > MAXIMO_DOCUMENTOS) return `Puede seleccionar máximo ${MAXIMO_DOCUMENTOS} documentos.`

  for (const archivo of archivos) {
    if (!TIPOS_DOCUMENTO.includes(archivo.type)) {
      return `El archivo "${archivo.name}" no es un formato permitido. Solo se permiten PDF y JPG.`
    }
    if (archivo.size > MAXIMO_BYTES) return `El archivo "${archivo.name}" supera los 32 MB.`

    const punto = archivo.name.lastIndexOf(".")
    const nombre = punto !== -1 ? archivo.name.substring(0, punto) : archivo.name
    if (nombre.length > MAXIMO_NOMBRE) {
      return `El nombre "${archivo.name}" no puede tener más de ${MAXIMO_NOMBRE} caracteres.`
    }
  }

  return null
}

// Sube los documentos de un trámite ya creado (por el proxy, que agrega el token)
export const subirDocumentosTramite = async (solicitudTramiteId: number, archivos: File[]) => {
  const formData = new FormData()
  formData.append("solicitudTramiteId", String(solicitudTramiteId))
  archivos.forEach(archivo => formData.append("documentos", archivo))

  const respuesta = await fetch("/api/backend/documentos", { method: "POST", body: formData })
  const datos = await respuesta.json().catch(() => null)
  if (!respuesta.ok) throw new Error(datos?.error || datos?.detalle || "No se pudieron cargar los documentos")
}
