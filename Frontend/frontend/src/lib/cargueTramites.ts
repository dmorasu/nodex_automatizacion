// Lógica del cargue masivo de trámites en pantalla (sin React): tipos, lectura de lo pegado
// desde Excel y resolución de nombres contra los catálogos.

export type Item = { id: number, nombre: string }
export type Municipio = Item & { departamento: string | null }

export type Catalogos = {
  operaciones: Item[]
  entidades: Item[]
  tramites: Item[]
  municipios: Municipio[]
  gastos: { bolsas: Item[], tiposGasto: (Item & { codigo: string })[], formasPago: Item[] } | null
}

export type Gasto = {
  tipoGastoId: number | null
  conceptoPago: string
  valor: string
  bolsaId: number | null
  formaPagoId: number | null
  beneficiarioIdentificacion: string
  beneficiarioNombre: string
  transito: string
  reembolsable: boolean | null
}

export type Fila = {
  clave: string
  identificador: string                 // placa o matrícula
  tipoIdentificador: "placa" | "matricula"
  detalle: string
  direccion: string
  municipioId: number | null
  municipioTexto: string                // lo pegado que no se encontró
  clienteId: number | null
  clienteNombre: string
  clienteTexto: string                  // identificación o nombre pegado (se resuelve al validar)
  tramiteId: number | null
  operacionId: number | null
  entidadId: number | null
  fechaEntrega: string
  documentosAportados: string
  conGasto: boolean
  gasto: Gasto
  // Resultado de la última validación (null = cambió o no se ha validado)
  resultado: { errores: string[], avisos: string[] } | null
}

// Valores que se eligen una vez y aplican a todas las filas que no los cambien
export type Comunes = {
  clienteId: number | null
  clienteNombre: string
  tramiteId: number | null
  operacionId: number | null
  entidadId: number | null
  municipioId: number | null
  fechaEntrega: string
  documentosAportados: string
  gasto: Omit<Gasto, "tipoGastoId" | "valor">
}

export const GASTO_VACIO: Gasto = {
  tipoGastoId: null, conceptoPago: "", valor: "", bolsaId: null, formaPagoId: null,
  beneficiarioIdentificacion: "", beneficiarioNombre: "", transito: "", reembolsable: null
}

let consecutivo = 0
export const filaVacia = (): Fila => ({
  clave: `f${Date.now()}-${consecutivo++}`,
  identificador: "", tipoIdentificador: "placa", detalle: "", direccion: "",
  municipioId: null, municipioTexto: "", clienteId: null, clienteNombre: "", clienteTexto: "",
  tramiteId: null, operacionId: null, entidadId: null, fechaEntrega: "", documentosAportados: "",
  conGasto: false, gasto: { ...GASTO_VACIO }, resultado: null
})

export const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase()

// Placa colombiana: ABC123 (carro) o ABC12D (moto). Lo demás se toma como matrícula inmobiliaria
export const parecePlaca = (texto: string) => /^[A-Z]{3}\s?-?\d{2}[A-Z0-9]$/.test(texto.trim().toUpperCase())

// Busca por nombre (sin tildes ni mayúsculas) o por id si es un número
export const buscarEn = <T extends Item>(lista: T[], texto: string): T | null => {
  const t = normalizar(texto)
  if (!t) return null
  if (/^\d+$/.test(t)) {
    const porId = lista.find(x => x.id === Number(t))
    if (porId) return porId
  }
  return lista.find(x => normalizar(x.nombre) === t) ?? null
}

// "Medellín", "Medellín - Antioquia" o "Medellín, Antioquia". Si el nombre se repite en varios
// departamentos y no se indica cuál, no se elige ninguno (se deja para que el usuario lo escoja)
export const buscarMunicipio = (municipios: Municipio[], texto: string): Municipio | null => {
  const t = normalizar(texto)
  if (!t) return null
  if (/^\d+$/.test(t)) return municipios.find(m => m.id === Number(t)) ?? null
  const [nombre, departamento] = t.split(/\s*[-,]\s*/)
  const candidatos = municipios.filter(m => normalizar(m.nombre) === nombre)
  if (departamento) return candidatos.find(m => normalizar(m.departamento ?? "") === departamento) ?? null
  // "Bogotá" → "BOGOTÁ, D.C."
  if (!candidatos.length) return municipios.find(m => normalizar(m.nombre).startsWith(`${t},`)) ?? null
  return candidatos.length === 1 ? candidatos[0] : null
}

// dd/mm/aaaa o aaaa-mm-dd → aaaa-mm-dd
export const fechaDeTexto = (texto: string) => {
  const t = texto.trim()
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : ""
}

// Columnas que se pueden pegar desde Excel, en este orden
export const COLUMNAS_PEGADO = [
  "Placa o matrícula", "Detalle", "Dirección", "Municipio", "Tipo de trámite", "Cliente (identificación o nombre)",
  "Fecha de entrega", "Gasto: concepto", "Gasto: valor", "Gasto: beneficiario (identificación)", "Gasto: tránsito"
] as const

export type DatosCrudos = {
  placa?: string, matricula?: string, identificador?: string, detalle?: string, direccion?: string, municipio?: string,
  tramite?: string, cliente?: string, operacion?: string, entidad?: string, fechaEntregaResultado?: string,
  documentosAportados?: string, gastoConcepto?: string, gastoValor?: string, gastoBeneficiario?: string, gastoTransito?: string
}

// Texto pegado (columnas separadas por tabulador, como copia Excel) → datos crudos por fila.
// Se salta la primera línea si parece encabezado.
export const leerPegado = (texto: string): DatosCrudos[] => {
  const lineas = texto.replace(/\r/g, "").split("\n").filter(l => l.trim())
  if (lineas.length && /placa|matr[ií]cula|detalle/i.test(lineas[0])) lineas.shift()
  return lineas.map(linea => {
    const c = linea.split("\t").map(x => x.trim())
    return {
      identificador: c[0], detalle: c[1], direccion: c[2], municipio: c[3], tramite: c[4], cliente: c[5],
      fechaEntregaResultado: c[6], gastoConcepto: c[7], gastoValor: c[8], gastoBeneficiario: c[9], gastoTransito: c[10]
    }
  })
}

// Datos crudos (pegados o del Excel) → fila de la pantalla, resolviendo los nombres
export const filaDeDatos = (d: DatosCrudos, catalogos: Catalogos): Fila => {
  const fila = filaVacia()
  const identificador = (d.identificador ?? d.placa ?? "") || (d.matricula ?? "")
  const esPlaca = d.placa ? true : d.matricula ? false : parecePlaca(identificador)
  const municipio = buscarMunicipio(catalogos.municipios, d.municipio ?? "")
  const conGasto = Boolean(d.gastoConcepto || d.gastoValor)
  const tipoGasto = catalogos.gastos?.tiposGasto.find(t => t.codigo === (esPlaca ? "VEHICULO" : "INMUEBLE"))

  return {
    ...fila,
    identificador: esPlaca ? identificador.toUpperCase().replace(/[\s-]/g, "") : identificador,
    tipoIdentificador: esPlaca ? "placa" : "matricula",
    detalle: d.detalle ?? "",
    direccion: d.direccion ?? "",
    municipioId: municipio?.id ?? null,
    municipioTexto: municipio ? "" : (d.municipio ?? ""),
    clienteTexto: d.cliente ?? "",
    tramiteId: buscarEn(catalogos.tramites, d.tramite ?? "")?.id ?? null,
    operacionId: buscarEn(catalogos.operaciones, d.operacion ?? "")?.id ?? null,
    entidadId: buscarEn(catalogos.entidades, d.entidad ?? "")?.id ?? null,
    fechaEntrega: fechaDeTexto(d.fechaEntregaResultado ?? ""),
    documentosAportados: /^s[ií]$/i.test(d.documentosAportados ?? "") ? "Si" : /^no$/i.test(d.documentosAportados ?? "") ? "No" : "",
    conGasto,
    gasto: {
      ...GASTO_VACIO,
      tipoGastoId: conGasto ? tipoGasto?.id ?? null : null,
      conceptoPago: d.gastoConcepto ?? "",
      valor: (d.gastoValor ?? "").replace(/[^\d]/g, ""),
      beneficiarioIdentificacion: d.gastoBeneficiario ?? "",
      transito: d.gastoTransito ?? ""
    }
  }
}

// Fila de la pantalla + valores comunes → lo que recibe el backend
export const paraEnviar = (f: Fila, c: Comunes) => {
  const valor = <T,>(propio: T | null | "", comun: T | null | "") => (propio === null || propio === "" ? comun : propio) || null
  return {
    clienteId: f.clienteId ?? (f.clienteTexto ? null : c.clienteId),
    clienteTexto: f.clienteId ? null : f.clienteTexto || null,
    municipioId: valor(f.municipioId, c.municipioId),
    operacionId: valor(f.operacionId, c.operacionId),
    entidadId: valor(f.entidadId, c.entidadId),
    tramiteId: valor(f.tramiteId, c.tramiteId),
    detalle: f.detalle,
    direccion: f.direccion,
    placa: f.tipoIdentificador === "placa" ? f.identificador : null,
    matricula: f.tipoIdentificador === "matricula" ? f.identificador : null,
    fechaEntregaResultado: valor(f.fechaEntrega, c.fechaEntrega),
    documentosAportados: valor(f.documentosAportados, c.documentosAportados) ?? "No",
    gasto: f.conGasto ? {
      tipoGastoId: f.gasto.tipoGastoId,
      conceptoPago: f.gasto.conceptoPago || c.gasto.conceptoPago,
      valorSolicitado: f.gasto.valor,
      bolsaId: f.gasto.bolsaId ?? c.gasto.bolsaId,
      formaPagoId: f.gasto.formaPagoId ?? c.gasto.formaPagoId,
      transito: f.gasto.transito || c.gasto.transito || null,
      reembolsable: f.gasto.reembolsable ?? c.gasto.reembolsable ?? true,
      beneficiario: {
        identificacion: f.gasto.beneficiarioIdentificacion || c.gasto.beneficiarioIdentificacion,
        nombre: f.gasto.beneficiarioIdentificacion ? f.gasto.beneficiarioNombre : c.gasto.beneficiarioNombre
      }
    } : null
  }
}
