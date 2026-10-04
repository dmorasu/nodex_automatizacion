import { Op, literal, QueryTypes } from 'sequelize'
import { db } from '../config/db'
import Usuarios from '../models/usuarios'
import Roles from '../models/gastos/roles'
import Municipios from '../models/municipios'
import SolicitudTramites from '../models/solicitudTramites'
import { ROLES } from './gastos/constantes'

// =====================================
// ANALISTAS DE TRÁMITES
// Cada trámite tiene su analista (SolicitudTramites.analistaAsignado). Los analistas son los
// usuarios con el rol ANALISTA_TRAMITES. El municipio guarda el analista por defecto de los
// trámites nuevos (Municipios.analistaId).
// =====================================

export class ErrorAnalistas extends Error {
  constructor(mensaje: string, public status = 400) {
    super(mensaje)
  }
}

// Nombre del analista como atributo calculado (el modelo no tiene asociación, ver solicitudTramites.ts)
export const ATRIBUTO_NOMBRE_ANALISTA = [
  literal(`(SELECT u."nombreUsuario" FROM "Usuarios" u WHERE u.id = "SolicitudTramites"."analistaAsignado")`),
  'nombreAnalista'
] as [ReturnType<typeof literal>, string]

// Desistido y Finalizado: los trámites cerrados no se mueven en la reasignación masiva
const ESTADOS_CERRADOS = ['Desistido', 'Finalizado']

// Usuarios con el rol de analista (para los selectores)
export const listarAnalistas = async () => {
  const usuarios = await Usuarios.findAll({
    attributes: ['id', 'nombreUsuario', 'correoUsuario'],
    include: [{
      model: Roles,
      attributes: [],
      where: { codigo: ROLES.ANALISTA_TRAMITES, activo: true },
      through: { attributes: [] }
    }],
    order: [['nombreUsuario', 'ASC']]
  })
  return usuarios.map(u => ({ id: u.id, nombreUsuario: u.nombreUsuario, correoUsuario: u.correoUsuario }))
}

const verificarAnalista = async (analistaId: number | null) => {
  if (analistaId === null) return
  const analistas = await listarAnalistas()
  if (!analistas.some(a => a.id === analistaId)) {
    throw new ErrorAnalistas('El usuario elegido no tiene el rol de Analista de trámites')
  }
}

// Cambia el analista de un trámite (null = sin analista)
export const asignarAnalista = async (solicitudId: number, analistaId: number | null) => {
  const solicitud = await SolicitudTramites.findByPk(solicitudId, { attributes: ['id', 'analistaAsignado'] })
  if (!solicitud) throw new ErrorAnalistas('El trámite no existe', 404)

  await verificarAnalista(analistaId)
  await solicitud.update({ analistaAsignado: analistaId })
}

// Pasa los trámites abiertos de un analista a otro (ej: vacaciones o retiro)
export const reasignarTramitesAbiertos = async (desdeId: number | null, haciaId: number | null) => {
  if (desdeId === haciaId) throw new ErrorAnalistas('Elija dos analistas distintos')
  await verificarAnalista(haciaId)

  const [, filas] = await db.query(`
    UPDATE "SolicitudTramites" s
    SET "analistaAsignado" = :haciaId, "updatedAt" = NOW()
    WHERE ${desdeId === null ? 's."analistaAsignado" IS NULL' : 's."analistaAsignado" = :desdeId'}
      AND NOT EXISTS (
        SELECT 1 FROM "Estados" e
        WHERE e.id = s."estadoActualTramite" AND e."nombreEstado" IN (:cerrados)
      )
  `, { replacements: { desdeId, haciaId, cerrados: ESTADOS_CERRADOS } })

  return { actualizados: Number((filas as { rowCount?: number })?.rowCount ?? 0) }
}

// Cuántos trámites tiene cada analista (abiertos y total), incluye "sin analista"
export const resumenPorAnalista = () =>
  db.query<{ analistaId: number | null, nombreUsuario: string | null, abiertos: string, total: string }>(`
    SELECT s."analistaAsignado" AS "analistaId", u."nombreUsuario",
           COUNT(*) FILTER (WHERE e."nombreEstado" IS NULL OR e."nombreEstado" NOT IN (:cerrados)) AS abiertos,
           COUNT(*) AS total
    FROM "SolicitudTramites" s
    LEFT JOIN "Usuarios" u ON u.id = s."analistaAsignado"
    LEFT JOIN "Estados" e ON e.id = s."estadoActualTramite"
    GROUP BY 1, 2
    ORDER BY abiertos DESC
  `, { type: QueryTypes.SELECT, replacements: { cerrados: ESTADOS_CERRADOS } })

// Municipios con su analista por defecto (paginado y con búsqueda)
export const listarMunicipios = async ({ busqueda, analistaId, pagina }: {
  busqueda?: string
  analistaId?: number | 'sin'
  pagina: number
}) => {
  const tamano = 25
  const where: Record<string | symbol, unknown> = {}
  if (busqueda) {
    where[Op.or] = [
      { nombreMunicipio: { [Op.iLike]: `%${busqueda}%` } },
      { departamento: { [Op.iLike]: `%${busqueda}%` } }
    ]
  }
  if (analistaId === 'sin') where.analistaId = null
  else if (analistaId) where.analistaId = analistaId

  const { rows, count } = await Municipios.findAndCountAll({
    where,
    attributes: [
      'id', 'nombreMunicipio', 'departamento', 'analistaId',
      [literal(`(SELECT u."nombreUsuario" FROM "Usuarios" u WHERE u.id = "Municipios"."analistaId")`), 'nombreAnalista']
    ],
    order: [['departamento', 'ASC'], ['nombreMunicipio', 'ASC']],
    limit: tamano,
    offset: (pagina - 1) * tamano
  })

  return { registros: rows, total: count, paginas: Math.max(1, Math.ceil(count / tamano)), pagina }
}

// Cambia el analista por defecto de varios municipios (solo afecta a los trámites nuevos)
export const asignarAnalistaMunicipios = async (municipioIds: number[], analistaId: number | null) => {
  await verificarAnalista(analistaId)
  const [actualizados] = await Municipios.update({ analistaId }, { where: { id: municipioIds } })
  return { actualizados }
}
