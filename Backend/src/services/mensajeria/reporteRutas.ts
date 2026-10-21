import XLSX from 'xlsx'
import { QueryTypes } from 'sequelize'
import { db } from '../../config/db'
import Tramitador from '../../models/tramitador'
import SedeMensajeria from '../../models/mensajeria/sedeMensajeria'
import { resumenJornadas } from './jornadas'

// =====================================
// EXCEL DE TIEMPOS Y KILÓMETROS DE LOS MENSAJEROS (PESV, 2026-10-21)
// Por día, por ruta y por diligencia, en un rango de fechas. Tiempos en minutos (se pueden sumar)
// y horas de Colombia. Km por el GPS de la app (aproximado: solo con la app abierta).
// =====================================

const MAXIMO_DIAS = 366

const hora = (iso: string | null) => (iso
  ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' })
  : '')

const metrosEntre = (a: [number, number], b: [number, number]) => {
  const rad = (g: number) => (g * Math.PI) / 180
  const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)))
}

const hoja = (filas: Record<string, unknown>[]) => {
  const ws = XLSX.utils.json_to_sheet(filas.length ? filas : [{ 'Sin datos': '' }])
  const encabezados = Object.keys(filas[0] ?? { 'Sin datos': '' })
  ws['!cols'] = encabezados.map(e => ({ wch: Math.min(45, Math.max(e.length, ...filas.map(f => String(f[e] ?? '').length)) + 2) }))
  ws['!autofilter'] = { ref: ws['!ref']! }
  return ws
}

type FilaDiligencia = {
  fecha: string
  tramitadorId: number
  jornadaId: number | null
  orden: number
  estado: string
  inicio: string | null
  fin: string | null
  observacion: string | null
  latitudConfirmacion: number | null
  longitudConfirmacion: number | null
  tramiteId: number
  tipo: string | null
  cliente: string | null
  placa: string | null
  direccion: string | null
  municipio: string | null
  latitud: number | null
  longitud: number | null
}

export const generarReporteRutas = async (desde: string, hasta: string, sedeId?: number) => {
  const dias = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000
  if (dias < 0) throw new Error('La fecha inicial no puede ser mayor que la final')
  if (dias > MAXIMO_DIAS) throw new Error('El rango puede ser de máximo un año')

  const mensajeros = await Tramitador.findAll({
    where: { esMensajero: true, ...(sedeId ? { sedeId } : {}) },
    attributes: ['id', 'nombreTramitador', 'sedeId'],
    include: [{ model: SedeMensajeria, attributes: ['nombre'] }]
  })
  const porId = new Map(mensajeros.map(m => [m.id, m]))
  const ids = mensajeros.map(m => m.id)
  const nombre = (id: number) => porId.get(id)?.nombreTramitador.trim() ?? `#${id}`
  const sede = (id: number) => porId.get(id)?.sede?.nombre ?? ''

  const [jornadas, diligencias] = ids.length ? await Promise.all([
    resumenJornadas({ tramitadorIds: ids, desde, hasta }),
    db.query<FilaDiligencia>(`
      SELECT
        to_char(pa.fecha, 'YYYY-MM-DD') AS fecha, pa.tramitador_id AS "tramitadorId", pa.jornada_id AS "jornadaId",
        pa.orden, pa.estado, pa.inicio_diligencia AS inicio, pa.fecha_confirmacion AS fin, pa.observacion,
        pa.latitud_confirmacion AS "latitudConfirmacion", pa.longitud_confirmacion AS "longitudConfirmacion",
        s.id AS "tramiteId", tr."nombreTramite" AS tipo, c."nombreCliente" AS cliente,
        COALESCE(s.placa, s."matriculaInmobiliaria") AS placa, s."direccionTramite" AS direccion,
        m."nombreMunicipio" AS municipio, s.latitud, s.longitud
      FROM mensajeria_paradas pa
      JOIN "SolicitudTramites" s ON s.id = pa.solicitud_tramite_id
      LEFT JOIN "Tramites" tr ON tr.id = s."tramiteId"
      LEFT JOIN "Clientes" c ON c.id = s."clienteId"
      LEFT JOIN "Municipios" m ON m.id = s."municipiosId"
      WHERE pa.fecha BETWEEN CAST(:desde AS DATE) AND CAST(:hasta AS DATE) AND pa.tramitador_id IN (:ids)
      ORDER BY pa.fecha, pa.tramitador_id, COALESCE(pa.inicio_diligencia, pa.fecha_confirmacion), pa.orden
    `, { type: QueryTypes.SELECT, replacements: { desde, hasta, ids } })
  ]) : [[], []]

  // Número de cada ruta dentro de su día (Ruta 1, Ruta 2…)
  const numeroRuta = new Map<number, number>()
  const contador = new Map<string, number>()
  for (const j of jornadas) {
    const clave = `${j.fecha}-${j.tramitadorId}`
    contador.set(clave, (contador.get(clave) ?? 0) + 1)
    numeroRuta.set(j.id, contador.get(clave)!)
  }

  const minutosDiligencia = (d: FilaDiligencia) => (d.inicio && d.fin ? Math.max(0, Math.round((Date.parse(d.fin) - Date.parse(d.inicio)) / 60_000)) : null)
  const nombreEstado = (estado: string) => ({ ENTREGADO: 'Entregado', NO_SE_PUDO: 'No se pudo', PENDIENTE: 'Pendiente' }[estado] ?? estado)

  // ── Por día ──
  const dias_ = new Map<string, { fecha: string, tramitadorId: number }>()
  for (const x of [...jornadas, ...diligencias]) dias_.set(`${x.fecha}-${x.tramitadorId}`, { fecha: x.fecha, tramitadorId: x.tramitadorId })
  const porDia = [...dias_.values()]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || nombre(a.tramitadorId).localeCompare(nombre(b.tramitadorId)))
    .map(({ fecha, tramitadorId }) => {
      const suyas = jornadas.filter(j => j.fecha === fecha && j.tramitadorId === tramitadorId)
      const hechas = diligencias.filter(d => d.fecha === fecha && d.tramitadorId === tramitadorId && d.estado !== 'PENDIENTE')
      const conTiempo = hechas.map(minutosDiligencia).filter((m): m is number => m !== null)
      return {
        'Fecha': fecha,
        'Mensajero': nombre(tramitadorId),
        'Sede': sede(tramitadorId),
        'Rutas': suyas.length,
        'Inicio': hora(suyas[0]?.inicio ?? null),
        'Fin': hora(suyas.at(-1)?.fin ?? null),
        'Tiempo en ruta (min)': suyas.reduce((s, j) => s + j.minutosTotales, 0),
        'Almuerzo (min)': suyas.reduce((s, j) => s + j.minutosAlmuerzo, 0),
        'Tiempo efectivo (min)': suyas.reduce((s, j) => s + j.minutosEfectivos, 0),
        'Km (GPS)': Math.round(suyas.reduce((s, j) => s + j.km, 0) * 100) / 100,
        'Diligencias': hechas.length,
        'Entregadas': hechas.filter(d => d.estado === 'ENTREGADO').length,
        'No se pudo': hechas.filter(d => d.estado === 'NO_SE_PUDO').length,
        'Tiempo promedio por diligencia (min)': conTiempo.length ? Math.round(conTiempo.reduce((s, m) => s + m, 0) / conTiempo.length) : ''
      }
    })

  // ── Rutas ──
  const rutas = jornadas.map(j => ({
    'Fecha': j.fecha,
    'Mensajero': nombre(j.tramitadorId),
    'Ruta': numeroRuta.get(j.id),
    'Inicio': hora(j.inicio),
    'Fin': j.fin ? hora(j.fin) : 'En curso',
    'Tiempo total (min)': j.minutosTotales,
    'Almuerzo (min)': j.minutosAlmuerzo,
    'Tiempo efectivo (min)': j.minutosEfectivos,
    'Km (GPS)': j.km,
    'Diligencias': diligencias.filter(d => d.jornadaId === j.id && d.estado !== 'PENDIENTE').length
  }))

  // ── Diligencias ──
  const filasDiligencias = diligencias.map(d => {
    const confirmada = d.latitudConfirmacion !== null && d.longitudConfirmacion !== null
    const ubicada = d.latitud !== null && d.longitud !== null
    return {
      'Fecha': d.fecha,
      'Mensajero': nombre(d.tramitadorId),
      'Ruta': d.jornadaId ? numeroRuta.get(d.jornadaId) ?? '' : '',
      'Orden': d.orden,
      'Trámite': d.tramiteId,
      'Tipo': d.tipo ?? '',
      'Cliente': d.cliente ?? '',
      'Placa / matrícula': d.placa ?? '',
      'Dirección': d.direccion ?? '',
      'Municipio': d.municipio ?? '',
      'Inicio': hora(d.inicio),
      'Fin': hora(d.fin),
      'Duración (min)': minutosDiligencia(d) ?? '',
      'Estado': nombreEstado(d.estado),
      'Observación': d.observacion ?? '',
      'Distancia del GPS a la dirección (m)': confirmada && ubicada
        ? metrosEntre([Number(d.latitudConfirmacion), Number(d.longitudConfirmacion)], [Number(d.latitud), Number(d.longitud)])
        : ''
    }
  })

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja(porDia), 'Por día')
  XLSX.utils.book_append_sheet(libro, hoja(rutas), 'Rutas')
  XLSX.utils.book_append_sheet(libro, hoja(filasDiligencias), 'Diligencias')
  XLSX.utils.book_append_sheet(libro, hoja([
    { 'Nota': `Del ${desde} al ${hasta}. Tiempos en minutos y horas de Colombia.` },
    { 'Nota': 'Tiempo efectivo = tiempo en ruta menos el almuerzo. Duración de la diligencia = de "Iniciar diligencia" a su confirmación.' },
    { 'Nota': 'Km por el GPS de la app: solo se registran con la app abierta; los tramos con la app cerrada se cuentan en línea recta.' }
  ]), 'Notas')
  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
