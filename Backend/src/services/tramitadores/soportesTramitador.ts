import { QueryTypes, type Transaction } from 'sequelize'
import { db } from '../../config/db'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import EstadosGasto from '../../models/gastos/estadosGasto'
import Terceros from '../../models/gastos/terceros'
import Bolsas from '../../models/gastos/bolsas'
import FacturasGasto from '../../models/gastos/facturasGasto'
import Reintegros from '../../models/gastos/reintegros'
import EstadosReintegro from '../../models/gastos/estadosReintegro'
import DocumentosGasto from '../../models/gastos/documentosGasto'
import TiposDocumentoGasto from '../../models/gastos/tiposDocumentoGasto'
import Tramitador from '../../models/tramitador'
import Usuarios from '../../models/usuarios'
import SoporteTramitador, { ESTADOS_SOPORTE, TIPOS_SOPORTE } from '../../models/tramitadores/soporteTramitador'
import ArchivoSoporte from '../../models/tramitadores/archivoSoporte'
import { subirArchivo, eliminarArchivo } from '../azureFileStorage'
import { nombreSeguro } from '../../controllers/gastos/DocumentosGastoController'
import { ESTADOS_GASTO, ESTADOS_REINTEGRO, TIPOS_DOCUMENTO } from '../gastos/constantes'
import { codigoEstadoGasto } from '../gastos/estadosGasto'
import { marcarReintegradoEn } from '../gastos/reintegros'
import { ErrorGastos as ErrorNegocio } from '../gastos/errores'
import { conPrefijo, NOMBRES_TIPO_SOPORTE, type TipoDocumentoTramite } from './nombresDocumento'
import { registrarDocumentosTramite } from './documentosTramite'

type TipoSoporte = typeof TIPOS_SOPORTE[keyof typeof TIPOS_SOPORTE]

export const TAMANO_PAGINA_GASTOS = 20

// Gastos del tramitador: el que quedó en el gasto o, si no tiene, el de su trámite.
// Solo los ya pagados (lo solicitado o anulado no le llegó)
const DE_TRAMITADOR = `
  FROM gastos_solicitudes g
  JOIN gastos_estados_gasto e ON e.id = g.estado_id AND e.codigo NOT IN ('${ESTADOS_GASTO.SOLICITADO}', '${ESTADOS_GASTO.ANULADO}')
  LEFT JOIN "SolicitudTramites" t ON t.id = g.solicitud_tramite_id
  WHERE COALESCE(g.tramitador_id, t."tramitadorId") = :tramitadorId
`

const REINTEGRO_PENDIENTE = `EXISTS (
  SELECT 1 FROM gastos_reintegros r
  JOIN gastos_estados_reintegro er ON er.id = r.estado_id AND er.codigo = '${ESTADOS_REINTEGRO.PENDIENTE}'
  WHERE r.solicitud_gasto_id = g.id
)`

// La factura se sube desde el trámite (llega sola al gasto), así que en "Mis gastos"
// el tramitador solo ve los gastos en los que debe devolver un sobrante
const POR_GESTIONAR = REINTEGRO_PENDIENTE

// El soporte del gasto también queda en los documentos del trámite, con su tipo
const TIPO_EN_TRAMITE: Record<TipoSoporte, TipoDocumentoTramite> = {
  FACTURA: 'FACTURA',
  REINTEGRO: 'BOLETA_REINTEGRO',
  OTRO: 'OTRO'
}

const ATRIBUTOS_GASTO = [
  'id', 'codigo', 'conceptoPago', 'placa', 'matriculaInmobiliaria', 'solicitudTramiteId',
  'valorRealmentePagado', 'fechaPago', 'numeroFactura'
]

const incluirDetalleGasto = [
  { model: EstadosGasto, attributes: ['codigo', 'nombre'] },
  { model: Terceros, attributes: ['nombre'] },
  { model: FacturasGasto, attributes: ['numeroFactura', 'valorFactura'] },
  {
    model: Reintegros,
    attributes: ['id', 'valorReintegro', 'fechaReintegro', 'createdAt'],
    include: [{ model: EstadosReintegro, attributes: ['codigo', 'nombre'] }]
  }
]

const soportesDe = (solicitudGastoIds: number[]) =>
  SoporteTramitador.findAll({
    where: { solicitudGastoId: solicitudGastoIds },
    attributes: ['id', 'solicitudGastoId', 'reintegroId', 'tipo', 'observacion', 'estado', 'motivoRechazo', 'fechaRevision', 'createdAt'],
    include: [{ model: ArchivoSoporte, attributes: ['id', 'nombreOriginal', 'tipoArchivo', 'tamano'] }],
    order: [['createdAt', 'DESC']]
  })

// Qué puede subir el tramitador en cada gasto (la app muestra los botones según esto)
const accionesDelGasto = (gasto: SolicitudesGasto, soportes: SoporteTramitador[]) => {
  const pendiente = (tipo: string, reintegroId: number | null = null) =>
    soportes.some(s => s.tipo === tipo && s.estado === ESTADOS_SOPORTE.PENDIENTE && (s.reintegroId ?? null) === reintegroId)

  return {
    puedeSubirFactura: gasto.estado?.codigo === ESTADOS_GASTO.PAGADO && !pendiente(TIPOS_SOPORTE.FACTURA),
    reintegrosPorSoportar: (gasto.reintegros ?? [])
      .filter(r => r.estado?.codigo === ESTADOS_REINTEGRO.PENDIENTE && !pendiente(TIPOS_SOPORTE.REINTEGRO, r.id))
      .map(r => r.id)
  }
}

// =====================================
// MIS GASTOS (app del tramitador)
// =====================================
// Solo los gastos con reintegro pendiente
export const listarGastosDelTramitador = async (tramitadorId: number, { pagina = 1 }: { pagina?: number }) => {
  const condicionFiltro = `AND ${POR_GESTIONAR}`
  const replacements = {
    tramitadorId,
    limite: TAMANO_PAGINA_GASTOS,
    desde: (Math.max(1, pagina) - 1) * TAMANO_PAGINA_GASTOS
  }

  const [conteo, filas, resumen] = await Promise.all([
    db.query<{ total: string }>(`SELECT COUNT(*) AS total ${DE_TRAMITADOR} ${condicionFiltro}`, { replacements, type: QueryTypes.SELECT }),
    db.query<{ id: number }>(`
      SELECT g.id ${DE_TRAMITADOR} ${condicionFiltro}
      ORDER BY g.fecha_pago ASC NULLS LAST, g.id ASC
      LIMIT :limite OFFSET :desde
    `, { replacements, type: QueryTypes.SELECT }),
    // Resumen para la pantalla de inicio: lo que debe devolver y las facturas que faltan
    db.query<Record<string, string>>(`
      SELECT
        COUNT(*) FILTER (WHERE e.codigo = '${ESTADOS_GASTO.PAGADO}' AND NOT EXISTS (
          SELECT 1 FROM tramitadores_soportes s
          WHERE s.solicitud_gasto_id = g.id AND s.tipo = 'FACTURA' AND s.estado = '${ESTADOS_SOPORTE.PENDIENTE}'
        )) AS "gastosSinFactura",
        COALESCE((
          SELECT SUM(r.valor_reintegro) FROM gastos_reintegros r
          JOIN gastos_estados_reintegro er ON er.id = r.estado_id AND er.codigo = '${ESTADOS_REINTEGRO.PENDIENTE}'
          WHERE r.solicitud_gasto_id IN (SELECT g.id ${DE_TRAMITADOR})
        ), 0) AS "porReintegrar",
        (
          SELECT COUNT(*) FROM gastos_reintegros r
          JOIN gastos_estados_reintegro er ON er.id = r.estado_id AND er.codigo = '${ESTADOS_REINTEGRO.PENDIENTE}'
          WHERE r.solicitud_gasto_id IN (SELECT g.id ${DE_TRAMITADOR})
        ) AS "reintegrosPendientes"
      ${DE_TRAMITADOR}
    `, { replacements, type: QueryTypes.SELECT })
  ])

  const ids = filas.map(f => Number(f.id))
  const [gastos, soportes] = await Promise.all([
    SolicitudesGasto.findAll({ where: { id: ids }, attributes: ATRIBUTOS_GASTO, include: incluirDetalleGasto }),
    soportesDe(ids)
  ])

  // Se conserva el orden de la consulta paginada
  const registros = ids.map(id => {
    const gasto = gastos.find(g => g.id === id)!
    const propios = soportes.filter(s => s.solicitudGastoId === id)
    return { ...gasto.toJSON(), soportes: propios, ...accionesDelGasto(gasto, propios) }
  })

  const r = resumen[0] ?? {}
  return {
    total: Number(conteo[0]?.total ?? 0),
    pagina,
    tamano: TAMANO_PAGINA_GASTOS,
    resumen: {
      porReintegrar: Number(r.porReintegrar ?? 0),
      reintegrosPendientes: Number(r.reintegrosPendientes ?? 0),
      gastosSinFactura: Number(r.gastosSinFactura ?? 0)
    },
    registros
  }
}

// Gasto del tramitador (404 si no es suyo: no revela que existe)
const gastoDelTramitador = async (tramitadorId: number, solicitudGastoId: number) => {
  const [fila] = await db.query<{ id: number }>(`SELECT g.id ${DE_TRAMITADOR} AND g.id = :solicitudGastoId`, {
    replacements: { tramitadorId, solicitudGastoId },
    type: QueryTypes.SELECT
  })
  if (!fila) throw new ErrorNegocio('Gasto no encontrado', 404)

  return SolicitudesGasto.findByPk(solicitudGastoId, { attributes: ATRIBUTOS_GASTO, include: incluirDetalleGasto })
}

export const obtenerGastoDelTramitador = async (tramitadorId: number, solicitudGastoId: number) => {
  const gasto = (await gastoDelTramitador(tramitadorId, solicitudGastoId))!
  const soportes = await soportesDe([gasto.id])
  return { ...gasto.toJSON(), soportes, ...accionesDelGasto(gasto, soportes) }
}

// Gastos pagados de un trámite del tramitador, con lo que cada uno necesita.
// En el detalle del trámite le dicen si debe subir la factura o una boleta de reintegro.
export const gastosDelTramite = async (tramitadorId: number, solicitudTramiteId: number) => {
  const filas = await db.query<{ id: number }>(`SELECT g.id ${DE_TRAMITADOR} AND g.solicitud_tramite_id = :solicitudTramiteId ORDER BY g.id`, {
    replacements: { tramitadorId, solicitudTramiteId },
    type: QueryTypes.SELECT
  })
  const ids = filas.map(f => Number(f.id))
  if (ids.length === 0) return []

  const [gastos, soportes] = await Promise.all([
    SolicitudesGasto.findAll({ where: { id: ids }, attributes: ATRIBUTOS_GASTO, include: incluirDetalleGasto, order: [['id', 'ASC']] }),
    soportesDe(ids)
  ])

  return gastos.map(gasto => {
    const propios = soportes.filter(s => s.solicitudGastoId === gasto.id)
    const factura = propios.find(s => s.tipo === TIPOS_SOPORTE.FACTURA)
    return {
      id: gasto.id,
      codigo: gasto.codigo,
      conceptoPago: gasto.conceptoPago,
      valorRealmentePagado: gasto.valorRealmentePagado,
      estado: { codigo: gasto.estado.codigo, nombre: gasto.estado.nombre },
      // Estado de la última factura que subió (para mostrar "En revisión" o "Rechazada")
      soporteFactura: factura ? { estado: factura.estado, motivoRechazo: factura.motivoRechazo } : null,
      reintegrosPendientes: (gasto.reintegros ?? [])
        .filter(r => r.estado?.codigo === ESTADOS_REINTEGRO.PENDIENTE)
        .map(r => ({ id: r.id, valor: r.valorReintegro })),
      ...accionesDelGasto(gasto, propios)
    }
  })
}

// El tramitador sube la factura, el comprobante de un reintegro u otro documento del gasto.
// Queda por revisar en Legalización y, si el gasto es de un trámite, también queda en los
// documentos del trámite (así se sube una sola vez y se ve en los dos lados).
export const subirSoporte = async (
  tramitadorId: number,
  solicitudGastoId: number,
  datos: { tipo: TipoSoporte, reintegroId?: number | null, observacion?: string | null },
  archivos: Express.Multer.File[]
) => {
  const soporte = await crearSoporte(tramitadorId, solicitudGastoId, datos, archivos)

  if (soporte.solicitudTramiteId) {
    try {
      await registrarDocumentosTramite(soporte.solicitudTramiteId, tramitadorId, TIPO_EN_TRAMITE[datos.tipo], archivos)
    } catch (error) {
      // El soporte ya quedó para Legalización; solo faltó la copia en el trámite
      console.error('No se pudo copiar el soporte a los documentos del trámite:', error)
    }
  }

  return soporte
}

const crearSoporte = async (
  tramitadorId: number,
  solicitudGastoId: number,
  datos: { tipo: TipoSoporte, reintegroId?: number | null, observacion?: string | null },
  archivos: Express.Multer.File[]
) => {
  const gasto = (await gastoDelTramitador(tramitadorId, solicitudGastoId))!
  if (archivos.length === 0) throw new ErrorNegocio('Debe adjuntar al menos un archivo')

  const soportes = await soportesDe([gasto.id])
  const acciones = accionesDelGasto(gasto, soportes)
  let reintegroId: number | null = null

  if (datos.tipo === TIPOS_SOPORTE.FACTURA) {
    if (!acciones.puedeSubirFactura) {
      throw new ErrorNegocio(gasto.estado?.codigo === ESTADOS_GASTO.PAGADO
        ? 'Ya subió la factura de este gasto; está pendiente de revisión'
        : 'Este gasto ya tiene la factura registrada')
    }
  } else if (datos.tipo === TIPOS_SOPORTE.OTRO) {
    // Cualquier otro documento del gasto, mientras el gasto siga abierto
    if (gasto.estado?.codigo === ESTADOS_GASTO.CONTABILIZADO) {
      throw new ErrorNegocio('El gasto ya está contabilizado: no se le pueden agregar documentos')
    }
  } else {
    reintegroId = Number(datos.reintegroId)
    if (!gasto.reintegros?.some(r => r.id === reintegroId)) throw new ErrorNegocio('El reintegro no pertenece a este gasto')
    if (!acciones.reintegrosPorSoportar.includes(reintegroId)) {
      throw new ErrorNegocio('Este reintegro ya está reintegrado o tiene un comprobante pendiente de revisión')
    }
  }

  const rutaDirectorio = `gastos/${gasto.codigo}/tramitador`
  const subidos: string[] = []

  try {
    for (const archivo of archivos) {
      const nombreArchivo = nombreSeguro(archivo.originalname)
      await subirArchivo(rutaDirectorio, nombreArchivo, archivo.buffer)
      subidos.push(nombreArchivo)
    }

    return await db.transaction(async transaction => {
      const soporte = await SoporteTramitador.create({
        solicitudGastoId: gasto.id,
        reintegroId,
        tramitadorId,
        tipo: datos.tipo,
        observacion: datos.observacion?.trim() || null
      }, { transaction })

      await ArchivoSoporte.bulkCreate(archivos.map((archivo, i) => ({
        soporteId: soporte.id,
        // El prefijo dice qué es (ej: "Reintegro - consignacion.jpg"); lo conserva al pasar al gasto
        nombreOriginal: conPrefijo(NOMBRES_TIPO_SOPORTE[datos.tipo], archivo.originalname),
        nombreArchivo: subidos[i],
        rutaDirectorio,
        tipoArchivo: archivo.mimetype,
        tamano: archivo.size
      })), { transaction })

      return { id: soporte.id, tipo: soporte.tipo, solicitudTramiteId: gasto.solicitudTramiteId ?? null }
    })
  } catch (error) {
    // No dejar archivos sueltos en Azure si algo falló
    await Promise.allSettled(subidos.map(nombre => eliminarArchivo(rutaDirectorio, nombre)))
    throw error
  }
}

// Archivo de un soporte: el tramitador solo ve los suyos; Legalización ve todos
export const obtenerArchivoSoporte = async (archivoId: number, tramitadorId: number | null) => {
  const archivo = await ArchivoSoporte.findByPk(archivoId, {
    include: [{ model: SoporteTramitador, attributes: ['tramitadorId'] }]
  })
  if (!archivo || (tramitadorId !== null && archivo.soporte.tramitadorId !== tramitadorId)) {
    throw new ErrorNegocio('El archivo no existe', 404)
  }
  return archivo
}

// =====================================
// REVISIÓN (Legalización, en Nodex Gastos)
// =====================================
// reembolsable: true = Legalización, false = Contabilidad, null = ambos (administrador)
export const listarSoportes = async (estado: string, reembolsable: boolean | null = null) => {
  const soportes = await SoporteTramitador.findAll({
    where: { estado },
    include: [
      // Aparte (separate): así el filtro por el gasto no choca con el límite de filas
      { model: ArchivoSoporte, attributes: ['id', 'soporteId', 'nombreOriginal', 'tipoArchivo', 'tamano'], separate: true },
      { model: Tramitador, attributes: ['id', 'nombreTramitador'] },
      { model: Usuarios, as: 'revisor', attributes: ['id', 'nombreUsuario'] },
      {
        model: Reintegros,
        attributes: ['id', 'valorReintegro'],
        include: [{ model: EstadosReintegro, attributes: ['codigo', 'nombre'] }]
      },
      {
        model: SolicitudesGasto,
        attributes: ['id', 'codigo', 'conceptoPago', 'placa', 'matriculaInmobiliaria', 'solicitudTramiteId', 'valorRealmentePagado', 'fechaPago', 'reembolsable'],
        // Legalización: reembolsables · Contabilidad: no reembolsables
        required: true,
        ...(reembolsable !== null && { where: { reembolsable } }),
        include: [
          { model: EstadosGasto, attributes: ['codigo', 'nombre'] },
          { model: Bolsas, attributes: ['id', 'nombre'] },
          { model: Terceros, attributes: ['nombre'] }
        ]
      }
    ],
    order: [['createdAt', estado === ESTADOS_SOPORTE.PENDIENTE ? 'ASC' : 'DESC']],
    limit: 200
  })

  // Cómo va el trámite en Nodex Trámites: estado actual y si el tramitador lo reportó realizado
  const tramiteIds = [...new Set(soportes.map(s => s.solicitudGasto?.solicitudTramiteId).filter(Boolean))] as number[]
  const tramites = tramiteIds.length === 0 ? [] : await db.query<{ id: number, estado: string, reporte: string | null }>(`
    SELECT t.id, COALESCE(e."nombreEstado", 'Sin Iniciar') AS estado,
      (SELECT r.estado FROM tramitadores_reportes_realizado r WHERE r.solicitud_tramite_id = t.id ORDER BY r.created_at DESC LIMIT 1) AS reporte
    FROM "SolicitudTramites" t
    LEFT JOIN "Estados" e ON e.id = t."estadoActualTramite"
    WHERE t.id IN (:tramiteIds)
  `, { replacements: { tramiteIds }, type: QueryTypes.SELECT })

  return soportes.map(s => {
    const tramite = tramites.find(t => Number(t.id) === s.solicitudGasto?.solicitudTramiteId)
    return {
      ...s.toJSON(),
      tramite: tramite ? { id: Number(tramite.id), estado: tramite.estado, reporteRealizado: tramite.reporte } : null
    }
  })
}

const soporteParaRevisar = async (soporteId: number, transaction: Transaction) => {
  // Se bloquea solo la fila del soporte (Postgres no bloquea con joins externos)
  const soporte = await SoporteTramitador.findByPk(soporteId, { transaction, lock: transaction.LOCK.UPDATE })
  if (!soporte) throw new ErrorNegocio('El soporte no existe', 404)
  if (soporte.estado !== ESTADOS_SOPORTE.PENDIENTE) throw new ErrorNegocio('Este soporte ya fue revisado')

  const archivos = await ArchivoSoporte.findAll({ where: { soporteId }, transaction })
  return { soporte, archivos }
}

// Aprueba el soporte: sus archivos pasan a ser documentos del gasto (factura) o del reintegro.
// Un comprobante de reintegro aprobado además marca el reintegro como recibido (vuelve a la bolsa).
export const aprobarSoporte = (soporteId: number, usuarioId: number, fechaReintegro: string | null) =>
  db.transaction(async transaction => {
    const { soporte, archivos } = await soporteParaRevisar(soporteId, transaction)
    const esReintegro = soporte.tipo === TIPOS_SOPORTE.REINTEGRO

    if (esReintegro) {
      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
      await marcarReintegradoEn(transaction, soporte.reintegroId!, fechaReintegro || hoy, usuarioId)
    } else {
      const gasto = await SolicitudesGasto.findByPk(soporte.solicitudGastoId, { transaction })
      const estado = await codigoEstadoGasto(gasto!.estadoId)
      if (estado === ESTADOS_GASTO.ANULADO || estado === ESTADOS_GASTO.CONTABILIZADO) {
        throw new ErrorNegocio('El gasto está anulado o contabilizado: no se le pueden agregar documentos')
      }
    }

    const codigoTipoDocumento = esReintegro
      ? TIPOS_DOCUMENTO.SOPORTE_REINTEGRO
      : soporte.tipo === TIPOS_SOPORTE.OTRO ? 'OTRO' : 'FACTURA'
    const tipoDocumento = await TiposDocumentoGasto.findOne({ where: { codigo: codigoTipoDocumento }, transaction })
    if (!tipoDocumento) throw new ErrorNegocio('Falta el tipo de documento en el catálogo', 500)

    await DocumentosGasto.bulkCreate(archivos.map(archivo => ({
      tipoDocumentoId: tipoDocumento.id,
      ...(esReintegro ? { reintegroId: soporte.reintegroId } : { solicitudGastoId: soporte.solicitudGastoId }),
      nombreOriginal: archivo.nombreOriginal,
      nombreArchivo: archivo.nombreArchivo,
      rutaDirectorio: archivo.rutaDirectorio,
      tipoArchivo: archivo.tipoArchivo,
      tamano: archivo.tamano,
      subidoPor: usuarioId
    })), { transaction })

    await soporte.update({
      estado: ESTADOS_SOPORTE.APROBADO,
      revisadoPor: usuarioId,
      fechaRevision: new Date()
    }, { transaction })

    return soporte
  })

// Rechaza el soporte con un motivo que el tramitador ve en la app (puede subir otro)
export const rechazarSoporte = (soporteId: number, usuarioId: number, motivo: string) =>
  db.transaction(async transaction => {
    const { soporte } = await soporteParaRevisar(soporteId, transaction)
    await soporte.update({
      estado: ESTADOS_SOPORTE.RECHAZADO,
      motivoRechazo: motivo.trim(),
      revisadoPor: usuarioId,
      fechaRevision: new Date()
    }, { transaction })
    return soporte
  })

// ¿El gasto del soporte es reembolsable? (define si lo revisa Legalización o Contabilidad)
export const soporteEsReembolsable = async (soporteId: number) => {
  const soporte = await SoporteTramitador.findByPk(soporteId, {
    attributes: ['id'],
    include: [{ model: SolicitudesGasto, attributes: ['reembolsable'] }]
  })
  if (!soporte) throw new ErrorNegocio('El soporte no existe', 404)
  return soporte.solicitudGasto.reembolsable
}

export const archivoEsReembolsable = async (archivoId: number) => {
  const archivo = await ArchivoSoporte.findByPk(archivoId, { attributes: ['soporteId'] })
  if (!archivo) throw new ErrorNegocio('El archivo no existe', 404)
  return soporteEsReembolsable(archivo.soporteId)
}

// Cantidad pendiente, para avisos en Nodex Gastos
export const contarSoportesPendientes = () =>
  SoporteTramitador.count({ where: { estado: ESTADOS_SOPORTE.PENDIENTE } })
