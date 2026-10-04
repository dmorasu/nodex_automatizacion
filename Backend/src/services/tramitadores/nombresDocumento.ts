// Tipos de documento que elige el tramitador en la app y el prefijo que se le pone
// al nombre del archivo para saber qué es (ej: "Factura - IMG_2031.jpg")

// Documentos del trámite (van a Nodex Trámites → Documentos)
export const TIPOS_DOCUMENTO_TRAMITE = {
  SOPORTE: 'Soporte',
  FACTURA: 'Factura',
  BOLETA_REINTEGRO: 'Boleta de reintegro',
  INGRESO: 'Ingreso',
  OTRO: 'Otro'
} as const

export type TipoDocumentoTramite = keyof typeof TIPOS_DOCUMENTO_TRAMITE

// Soportes de los gastos (los revisa Legalización)
export const NOMBRES_TIPO_SOPORTE = {
  FACTURA: 'Factura',
  REINTEGRO: 'Reintegro',
  OTRO: 'Otro'
} as const

// "IMG_2031.jpg" + "Factura" → "Factura - IMG_2031.jpg" (sin repetir el prefijo y dentro de 255 caracteres)
export const conPrefijo = (prefijo: string, nombreOriginal: string) => {
  const inicio = `${prefijo} - `
  const nombre = nombreOriginal.toLowerCase().startsWith(inicio.toLowerCase()) ? nombreOriginal : `${inicio}${nombreOriginal}`
  return nombre.length > 255 ? `${nombre.slice(0, 240)}${nombre.slice(nombre.lastIndexOf('.'))}` : nombre
}
