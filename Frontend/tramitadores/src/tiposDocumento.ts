// Tipos de documento que el tramitador elige antes de subir archivos.
// El backend le pone al nombre del archivo el prefijo del tipo (ej: "Factura - IMG_2031.jpg").

// Documentos del trámite (se ven en Nodex Trámites → Documentos)
export const TIPOS_DOCUMENTO = [
  { codigo: "SOPORTE", nombre: "Soporte", ayuda: "Radicado, recibo, certificado o resultado" },
  { codigo: "FACTURA", nombre: "Factura", ayuda: "Factura de un pago del trámite" },
  { codigo: "BOLETA_REINTEGRO", nombre: "Boleta de reintegro", ayuda: "Boleta de la consignación de un reintegro" },
  { codigo: "INGRESO", nombre: "Ingreso", ayuda: "Comprobante de ingreso" },
  { codigo: "OTRO", nombre: "Otro", ayuda: "Cualquier otro documento" }
] as const

export type TipoDocumento = typeof TIPOS_DOCUMENTO[number]["codigo"]

export const nombreTipoDocumento = (codigo: string) =>
  TIPOS_DOCUMENTO.find(t => t.codigo === codigo)?.nombre ?? codigo

// Soportes de los gastos (los revisa Legalización)
export const TIPOS_SOPORTE = [
  { codigo: "REINTEGRO", nombre: "Reintegro", ayuda: "Comprobante de la consignación de lo que debe devolver" },
  { codigo: "FACTURA", nombre: "Factura", ayuda: "Factura del pago" },
  { codigo: "OTRO", nombre: "Otro", ayuda: "Cualquier otro documento del gasto" }
] as const

export type TipoSoporte = typeof TIPOS_SOPORTE[number]["codigo"]

export const nombreTipoSoporte = (codigo: string) =>
  codigo === "REINTEGRO" ? "Comprobante de reintegro" : TIPOS_SOPORTE.find(t => t.codigo === codigo)?.nombre ?? codigo
