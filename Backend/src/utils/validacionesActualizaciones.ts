import SolicitudTramites from '../models/solicitudTramites'
import Estados from '../models/estados'
import Tramitador from '../models/tramitador'
import Transportadora from '../models/trasnportadora'
import { ESTADO_NOVEDAD_SUBSANADA, validarFechaEntrega } from '../services/estadoTramite'
import { excelDateToString } from './excelDate'

// ============================
// VALIDAR ESTADOS
// ============================
export const validarEstados = async (data: any[]) => {
  const columnasEsperadas = [
  'solicitudTramiteId',
  'estadoId'
]

const columnasArchivo = Object.keys(data[0] || {})

const esValido = columnasEsperadas.every(col => columnasArchivo.includes(col))

if (!esValido) {
  return [{
    fila: 1,
    columna: 'archivo',
    error: 'Plantilla incorrecta para este proceso'
  }]
}

  const errores: any[] = []

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const fila = i + 2

    if (!row.solicitudTramiteId) {
      errores.push({ fila, error: 'Falta solicitudTramiteId' })
      continue
    }

    if (!row.estadoId) {
      errores.push({ fila, error: 'Falta estadoId' })
      continue
    }

    const solicitud = await SolicitudTramites.findByPk(row.solicitudTramiteId)
    if (!solicitud) {
      errores.push({ fila, error: 'Solicitud no existe' })
    }

    const estado = await Estados.findByPk(row.estadoId)
    if (!estado) {
      errores.push({ fila, error: 'Estado no existe' })
    }

    // Novedad subsanada: exige la nueva fecha de entrega del resultado (columna fechaEntregaResultado)
    if (Number(row.estadoId) === ESTADO_NOVEDAD_SUBSANADA) {
      try {
        validarFechaEntrega(excelDateToString(row.fechaEntregaResultado))
      } catch (error: any) {
        errores.push({ fila, error: error.message })
      }
    }
  }

  return errores
}

// ============================
// VALIDAR LOGISTICA
// ============================
export const validarLogistica = async (data: any[]) => {

  const normalizar = (str: string) =>
    str.trim().toLowerCase().replace(/\s+/g, '')

  // 🔥 BUSCAR FILA VÁLIDA
  const filaValida = data.find(row => Object.keys(row).length > 0)

  if (!filaValida) {
    return [{
      fila: 1,
      columna: 'archivo',
      error: 'El archivo está vacío o mal estructurado'
    }]
  }

  const columnasArchivo = Object.keys(filaValida).map(normalizar)

  const columnasEsperadas = [
    'solicitudTramiteId',
    'numeroGuia',
    'destinatario',
    'valorEnvio',
    'fechaProgramacionLogistica',
    'fechaEntregaTransportadora',
    'transportadoraId'
  ].map(normalizar)

  const esValido = columnasEsperadas.every(col =>
    columnasArchivo.includes(col)
  )

  if (!esValido) {
    console.log('COLUMNAS ARCHIVO:', columnasArchivo)

    return [{
      fila: 1,
      columna: 'archivo',
      error: 'Plantilla incorrecta para este proceso'
    }]
  }

  const errores: any[] = []

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const fila = i + 2

    const solicitud = await SolicitudTramites.findByPk(row.solicitudTramiteId)
    if (!solicitud) {
      errores.push({ fila, columna: 'solicitudTramiteId', error: 'No existe' })
    }

    if (row.transportadoraId) {
      const t = await Transportadora.findByPk(row.transportadoraId)
      if (!t) {
        errores.push({ fila, columna: 'transportadoraId', error: 'No existe' })
      }
    }
  }

  return errores
}

// VALIDAR PROGRAMACION

export const validarProgramacion = async (data: any[]) => {
  const columnasEsperadas = [
  'solicitudTramiteId',

  
  'valorTramite',
  'valorViaticos',
  'conceptoHonorarios',
  'conceptoViaticos'
]

const columnasArchivo = Object.keys(data[0] || {})

const esValido = columnasEsperadas.every(col => columnasArchivo.includes(col))

if (!esValido) {
  return [{
    fila: 1,
    columna: 'archivo',
    error: 'Plantilla incorrecta para este proceso'
  }]
}

  const errores: any[] = []

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const fila = i + 2

    if (!row.solicitudTramiteId) {
      errores.push({ fila, error: 'Falta solicitudTramiteId' })
      continue
    }

    const solicitud = await SolicitudTramites.findByPk(row.solicitudTramiteId)

    if (!solicitud) {
      errores.push({ fila, error: 'Solicitud no existe' })
    }
  }

  return errores
}
export const validarTrazabilidad = async (data: any[]) => {
   const columnasEsperadas = [
  'solicitudTramiteId',

  
  'observacionTrazabilidad',
  'nombreUsuario',
  
]

const columnasArchivo = Object.keys(data[0] || {})

const esValido = columnasEsperadas.every(col => columnasArchivo.includes(col))

if (!esValido) {
  return [{
    fila: 1,
    columna: 'archivo',
    error: 'Plantilla incorrecta para este proceso'
  }]
}
  

  const errores: any[] = []

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const fila = i + 2

    if (!row.solicitudTramiteId) {
      errores.push({ fila, error: 'Falta solicitudTramiteId' })
      continue
    }

    if (!row.observacionTrazabilidad) {
      errores.push({ fila, error: 'Comentario requerido' })
      continue
    }

    if (!row.nombreUsuario) {
      errores.push({ fila, error: 'nombre de usuario  requerido' })
      continue
    }

    const solicitud = await SolicitudTramites.findByPk(row.solicitudTramiteId)

    if (!solicitud) {
      errores.push({ fila, error: 'Solicitud no existe' })
    }
  }

  return errores
}

// VALIDAR TRAMITADOR

export const validarTramitador = async (data: any[]) => {
   const columnasEsperadas = [
  'solicitudTramiteId',

  
  'tramitadorId',
  
]

const columnasArchivo = Object.keys(data[0] || {})

const esValido = columnasEsperadas.every(col => columnasArchivo.includes(col))

if (!esValido) {
  return [{
    fila: 1,
    columna: 'archivo',
    error: 'Plantilla incorrecta para este proceso'
  }]
}

  const errores: any[] = []

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const fila = i + 2

    if (!row.solicitudTramiteId) {
      errores.push({ fila, error: 'Falta solicitudTramiteId' })
      continue
    }

    if (!row.tramitadorId) {
      errores.push({ fila, error: 'Falta tramitadorId' })
      continue
    }

    const solicitud = await SolicitudTramites.findByPk(row.solicitudTramiteId)
    if (!solicitud) {
      errores.push({ fila, error: 'Solicitud no existe' })
    }

    const tramitador = await Tramitador.findByPk(row.tramitadorId)
    if (!tramitador) {
      errores.push({ fila, error: 'Tramitador no existe' })
    }
  }

  return errores
}