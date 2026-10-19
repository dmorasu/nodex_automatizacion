import { QueryTypes } from 'sequelize'
import { db } from '../config/db'
import Tramite from '../models/tramite'
import Operaciones from '../models/operaciones'
import SubEstados from '../models/subEstados'
import TiposRechazo from '../models/tiposRechazos'
import Areas from '../models/areas'

// =====================================
// CATÁLOGOS DE TRÁMITES (Nodex Trámites → Catálogos)
// Tipos de trámite (con sus subestados), operaciones, tipos de rechazo y áreas de los usuarios.
// Solo se borra lo que nada usa: la relación Operaciones → SolicitudTramites tiene
// onDelete CASCADE en el modelo, así que borrar una operación en uso podría arrastrar trámites.
// =====================================

export class ErrorCatalogo extends Error {
  constructor(mensaje: string, public status = 400) {
    super(mensaje)
  }
}

export type TipoCatalogo = 'tramites' | 'operaciones' | 'subestados' | 'rechazos' | 'areas'

// Texto obligatorio, sin espacios de más y con largo máximo de la columna
const texto = (valor: unknown, etiqueta: string, maximo: number, obligatorio = true) => {
  const limpio = String(valor ?? '').replace(/\s+/g, ' ').trim()
  if (!limpio && obligatorio) throw new ErrorCatalogo(`${etiqueta} es obligatorio`)
  if (limpio.length > maximo) throw new ErrorCatalogo(`${etiqueta}: máximo ${maximo} caracteres`)
  return limpio || null
}

// Evita duplicados con otra mayúscula o espacios ("Traspaso" y "TRASPASO ")
const revisarDuplicado = async (tabla: string, columna: string, valor: string, id?: number, extra = '', reemplazos: object = {}) => {
  const [fila] = await db.query<{ id: number }>(
    `SELECT id FROM "${tabla}" WHERE UPPER(TRIM("${columna}")) = UPPER(:valor) ${id ? 'AND id <> :id' : ''} ${extra} LIMIT 1`,
    { type: QueryTypes.SELECT, replacements: { valor, id, ...reemplazos } }
  )
  if (fila) throw new ErrorCatalogo(`Ya existe "${valor}"`, 409)
}

// ── Listado con el uso de cada registro ──
export const listarCatalogos = async () => {
  const [tramites, subestados, operaciones, rechazos, areas] = await Promise.all([
    db.query(`
      SELECT t.id, t."nombreTramite" AS nombre, t.responsable,
        (SELECT COUNT(*) FROM "SolicitudTramites" s WHERE s."tramiteId" = t.id)::int AS uso
      FROM "Tramites" t ORDER BY t."nombreTramite"
    `, { type: QueryTypes.SELECT }),
    db.query(`
      SELECT se.id, se.nombre, se."tramiteId",
        (SELECT COUNT(*) FROM "SubEstadosSolicitud" ss WHERE ss."subEstadoId" = se.id)::int AS uso
      FROM "SubEstados" se ORDER BY se.nombre
    `, { type: QueryTypes.SELECT }),
    db.query(`
      SELECT o.id, o."nombreOperacion" AS nombre, o."centroDeCostos", o."descargaPagoUnificada",
        (SELECT COUNT(*) FROM "SolicitudTramites" s WHERE s."operacionesId" = o.id)::int AS "usoTramites",
        (SELECT COUNT(*) FROM gastos_solicitudes g WHERE g.operacion_id = o.id)::int AS "usoGastos"
      FROM "Operaciones" o ORDER BY o."nombreOperacion"
    `, { type: QueryTypes.SELECT }),
    db.query(`
      SELECT r.id, r.nombre,
        (SELECT COUNT(*) FROM "EstadosTramites" e WHERE e."tipoRechazoId" = r.id)::int AS uso
      FROM "TiposRechazo" r ORDER BY r.nombre
    `, { type: QueryTypes.SELECT }),
    listarAreas()
  ])
  return { tramites, subestados, operaciones, rechazos, areas }
}

// Áreas con cuántos usuarios tiene cada una (también para el formulario de usuarios)
export const listarAreas = () =>
  db.query<{ id: number, nombre: string, uso: number }>(`
    SELECT a.id, a.nombre, (SELECT COUNT(*) FROM "Usuarios" u WHERE u."areaId" = a.id)::int AS uso
    FROM "Areas" a ORDER BY a.nombre
  `, { type: QueryTypes.SELECT })

// ── Crear o editar (sin id = crear) ──
export const guardarCatalogo = async (tipo: TipoCatalogo, datos: Record<string, unknown>, id?: number) => {
  switch (tipo) {
    case 'tramites': {
      const nombreTramite = texto(datos.nombre, 'El nombre', 150)!
      const responsable = texto(datos.responsable, 'El responsable', 150, false)
      await revisarDuplicado('Tramites', 'nombreTramite', nombreTramite, id)
      return id
        ? (await existente(porId.tramites, id)).update({ nombreTramite, responsable })
        : Tramite.create({ nombreTramite, responsable })
    }
    case 'operaciones': {
      const nombreOperacion = texto(datos.nombre, 'El nombre', 100)!
      const centroDeCostos = texto(datos.centroDeCostos, 'El centro de costos', 10, false)
      // Sin el dato, no cambia
      const descargaPagoUnificada = datos.descargaPagoUnificada === undefined ? undefined : String(datos.descargaPagoUnificada) === 'true'
      await revisarDuplicado('Operaciones', 'nombreOperacion', nombreOperacion, id)
      return id
        ? (await existente(porId.operaciones, id)).update({ nombreOperacion, centroDeCostos, ...(descargaPagoUnificada !== undefined && { descargaPagoUnificada }) })
        : Operaciones.create({ nombreOperacion, centroDeCostos, descargaPagoUnificada: descargaPagoUnificada ?? false })
    }
    case 'subestados': {
      const nombre = texto(datos.nombre, 'El nombre', 200)!
      // El subestado pertenece a un tipo de trámite; al editar no se cambia de trámite
      const tramiteId = id ? (await existente(porId.subestados, id)).tramiteId : Number(datos.tramiteId)
      if (!id) await existente(porId.tramites, tramiteId, 'El tipo de trámite no existe')
      await revisarDuplicado('SubEstados', 'nombre', nombre, id, 'AND "tramiteId" = :tramiteId', { tramiteId })
      return id
        ? (await existente(porId.subestados, id)).update({ nombre })
        : SubEstados.create({ nombre, tramiteId })
    }
    case 'rechazos': {
      const nombre = texto(datos.nombre, 'El nombre', 200)!
      await revisarDuplicado('TiposRechazo', 'nombre', nombre, id)
      return id
        ? (await existente(porId.rechazos, id)).update({ nombre })
        : TiposRechazo.create({ nombre })
    }
    case 'areas': {
      const nombre = texto(datos.nombre, 'El nombre', 100)!
      await revisarDuplicado('Areas', 'nombre', nombre, id)
      if (!id) return Areas.create({ nombre })
      // Usuarios.area guarda el nombre en texto (lo lee la 4.5): se renombra también ahí
      return db.transaction(async transaction => {
        const area = await (await existente(porId.areas, id)).update({ nombre }, { transaction })
        await db.query(`UPDATE "Usuarios" SET area = :nombre WHERE "areaId" = :id`, { replacements: { nombre, id }, transaction })
        return area
      })
    }
  }
}

// ── Borrar (solo si no se usa) ──
export const borrarCatalogo = async (tipo: TipoCatalogo, id: number) => {
  const registro = await existente(porId[tipo] as (id: number) => Promise<{ destroy: () => Promise<void> } | null>, id)
  const uso = await usoDe(tipo, id)
  if (uso) throw new ErrorCatalogo(`No se puede eliminar: ${uso}`, 409)
  await registro.destroy()
}

const usoDe = async (tipo: TipoCatalogo, id: number) => {
  const contar = async (sql: string) =>
    Number((await db.query<{ n: number }>(sql, { type: QueryTypes.SELECT, replacements: { id } }))[0]?.n ?? 0)
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

  switch (tipo) {
    case 'tramites': {
      const [solicitudes, subestados] = await Promise.all([
        contar(`SELECT COUNT(*)::int n FROM "SolicitudTramites" WHERE "tramiteId" = :id`),
        contar(`SELECT COUNT(*)::int n FROM "SubEstados" WHERE "tramiteId" = :id`)
      ])
      const motivos = [
        solicitudes && `lo usan ${plural(solicitudes, 'trámite', 'trámites')}`,
        subestados && `tiene ${plural(subestados, 'subestado', 'subestados')} (elimínelos primero)`
      ].filter(Boolean)
      return motivos.join(' y ')
    }
    case 'operaciones': {
      const [tramites, gastos] = await Promise.all([
        contar(`SELECT COUNT(*)::int n FROM "SolicitudTramites" WHERE "operacionesId" = :id`),
        contar(`SELECT COUNT(*)::int n FROM gastos_solicitudes WHERE operacion_id = :id`)
      ])
      const motivos = [
        tramites && plural(tramites, 'trámite', 'trámites'),
        gastos && plural(gastos, 'gasto', 'gastos')
      ].filter(Boolean)
      return motivos.length ? `la usan ${motivos.join(' y ')}` : ''
    }
    case 'subestados': {
      const n = await contar(`SELECT COUNT(*)::int n FROM "SubEstadosSolicitud" WHERE "subEstadoId" = :id`)
      return n ? `lo usan ${plural(n, 'registro de trámite', 'registros de trámites')}` : ''
    }
    case 'rechazos': {
      const n = await contar(`SELECT COUNT(*)::int n FROM "EstadosTramites" WHERE "tipoRechazoId" = :id`)
      return n ? `lo usan ${plural(n, 'cambio de estado', 'cambios de estado')}` : ''
    }
    case 'areas': {
      const n = await contar(`SELECT COUNT(*)::int n FROM "Usuarios" WHERE "areaId" = :id`)
      return n ? `la tienen ${plural(n, 'usuario', 'usuarios')} (cámbieles el área primero)` : ''
    }
  }
}

// Registro por id o error 404. `buscar` es el findByPk del modelo (así se conserva su tipo)
const existente = async <M>(buscar: (id: number) => Promise<M | null>, id: number, mensaje = 'El registro no existe') => {
  const registro = Number.isInteger(id) && id > 0 ? await buscar(id) : null
  if (!registro) throw new ErrorCatalogo(mensaje, 404)
  return registro
}

const porId = {
  tramites: (id: number) => Tramite.findByPk(id),
  operaciones: (id: number) => Operaciones.findByPk(id),
  subestados: (id: number) => SubEstados.findByPk(id),
  rechazos: (id: number) => TiposRechazo.findByPk(id),
  areas: (id: number) => Areas.findByPk(id)
}
