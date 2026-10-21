import XLSX from 'xlsx'
import { QueryTypes } from 'sequelize'
import { db } from '../config/db'

// =====================================
// EXCEL DE LOS CATÁLOGOS (Nodex Trámites → Catálogos → Descargar Excel)
// Una hoja por catálogo. Tramitadores lo ve todo Torre de control; los demás catálogos solo
// Administrador de Torre de control o Admin (las mismas pestañas que ve en pantalla).
// =====================================

const siNo = (valor: unknown) => (valor ? 'Sí' : 'No')

// Hoja con encabezados en español y ancho de columnas según el contenido
const hoja = (filas: Record<string, unknown>[]) => {
  const ws = XLSX.utils.json_to_sheet(filas.length ? filas : [{ 'Sin datos': '' }])
  const encabezados = Object.keys(filas[0] ?? { 'Sin datos': '' })
  ws['!cols'] = encabezados.map(e => ({
    wch: Math.min(60, Math.max(e.length, ...filas.map(f => String(f[e] ?? '').length)) + 2)
  }))
  // Fila de encabezados fija y con filtro
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: encabezados.length - 1 } }) }
  return ws
}

const consultar = (sql: string) => db.query<Record<string, any>>(sql, { type: QueryTypes.SELECT })

export const generarExcelCatalogos = async (incluirAdministracion: boolean) => {
  const libro = XLSX.utils.book_new()

  const tramitadores = await consultar(`
    SELECT t.id, t."nombreTramitador", t.identificacion, t."correoTramitador", t."numeroTramitador", t.region,
      t.activo, t."esMensajero", s.nombre AS sede, (a.id IS NOT NULL) AS "tieneAcceso",
      (SELECT COUNT(*) FROM "SolicitudTramites" st WHERE st."tramitadorId" = t.id)::int AS tramites
    FROM "Tramitador" t
    LEFT JOIN mensajeria_sedes s ON s.id = t."sedeId"
    LEFT JOIN tramitadores_acceso a ON a.tramitador_id = t.id
    ORDER BY t."nombreTramitador"
  `)
  XLSX.utils.book_append_sheet(libro, hoja(tramitadores.map(t => ({
    'Id': t.id,
    'Nombre': t.nombreTramitador,
    'Identificación': t.identificacion,
    'Correo': t.correoTramitador ?? '',
    'WhatsApp': t.numeroTramitador ?? '',
    'Región': t.region ?? '',
    'Activo': siNo(t.activo),
    'Mensajero': siNo(t.esMensajero),
    'Sede': t.sede ?? '',
    'Acceso a la app': siNo(t.tieneAcceso),
    'Trámites asignados': t.tramites
  }))), 'Tramitadores')

  if (!incluirAdministracion) return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  const [tramites, subestados, operaciones, rechazos, areas] = await Promise.all([
    consultar(`
      SELECT t.id, t."nombreTramite", t.responsable,
        (SELECT COUNT(*) FROM "SubEstados" se WHERE se."tramiteId" = t.id)::int AS subestados,
        (SELECT COUNT(*) FROM "SolicitudTramites" s WHERE s."tramiteId" = t.id)::int AS uso
      FROM "Tramites" t ORDER BY t."nombreTramite"
    `),
    consultar(`
      SELECT se.id, t."nombreTramite", se.nombre,
        (SELECT COUNT(*) FROM "SubEstadosSolicitud" ss WHERE ss."subEstadoId" = se.id)::int AS uso
      FROM "SubEstados" se LEFT JOIN "Tramites" t ON t.id = se."tramiteId"
      ORDER BY t."nombreTramite", se.nombre
    `),
    consultar(`
      SELECT o.id, o."nombreOperacion", o."centroDeCostos", o."descargaPagoUnificada",
        (SELECT COUNT(*) FROM "SolicitudTramites" s WHERE s."operacionesId" = o.id)::int AS "usoTramites",
        (SELECT COUNT(*) FROM gastos_solicitudes g WHERE g.operacion_id = o.id)::int AS "usoGastos"
      FROM "Operaciones" o ORDER BY o."nombreOperacion"
    `),
    consultar(`
      SELECT r.id, r.nombre,
        (SELECT COUNT(*) FROM "EstadosTramites" e WHERE e."tipoRechazoId" = r.id)::int AS uso
      FROM "TiposRechazo" r ORDER BY r.nombre
    `),
    consultar(`
      SELECT a.id, a.nombre, (SELECT COUNT(*) FROM "Usuarios" u WHERE u."areaId" = a.id)::int AS uso
      FROM "Areas" a ORDER BY a.nombre
    `)
  ])

  XLSX.utils.book_append_sheet(libro, hoja(tramites.map(t => ({
    'Id': t.id,
    'Tipo de trámite': t.nombreTramite,
    'Responsable': t.responsable ?? '',
    'Subestados': t.subestados,
    'Trámites': t.uso
  }))), 'Tipos de trámite')

  XLSX.utils.book_append_sheet(libro, hoja(subestados.map(s => ({
    'Id': s.id,
    'Tipo de trámite': s.nombreTramite ?? '',
    'Subestado': s.nombre,
    'Veces usado en trámites': s.uso
  }))), 'Subestados')

  XLSX.utils.book_append_sheet(libro, hoja(operaciones.map(o => ({
    'Id': o.id,
    'Operación': o.nombreOperacion,
    'Centro de costos': o.centroDeCostos ?? '',
    'PDF de pago unificado': siNo(o.descargaPagoUnificada),
    'Trámites': o.usoTramites,
    'Gastos': o.usoGastos
  }))), 'Operaciones')

  XLSX.utils.book_append_sheet(libro, hoja(rechazos.map(r => ({
    'Id': r.id,
    'Tipo de rechazo': r.nombre,
    'Cambios de estado': r.uso
  }))), 'Tipos de rechazo')

  XLSX.utils.book_append_sheet(libro, hoja(areas.map(a => ({
    'Id': a.id,
    'Área': a.nombre,
    'Usuarios': a.uso
  }))), 'Áreas')

  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
