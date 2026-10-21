import { Op, QueryTypes } from 'sequelize'
import { db } from '../../config/db'
import Tramitador from '../../models/tramitador'
import UbicacionMensajero from '../../models/mensajeria/ubicacionMensajero'
import { ErrorUbicacion } from './ubicacion'

// =====================================
// UBICACIÓN EN VIVO DE LOS MENSAJEROS (2026-10-21)
// La app del mensajero envía su posición mientras tiene la ruta iniciada y la app abierta (una
// app web no puede leer el GPS en segundo plano). Torre de control ve la última del día.
// Requiere la autorización del mensajero (Ley 1581 de 2012): la app la pide al iniciar la ruta.
// =====================================

const SEGUNDOS_ENTRE_UBICACIONES = 30 // si llegan más seguido, se ignoran
export const DIAS_UBICACIONES = 60    // las más viejas se borran

let ultimaLimpieza = ''

// Borra las posiciones viejas una vez al día (la primera vez que llega una ese día)
const limpiarViejas = async () => {
  const hoy = new Date().toISOString().slice(0, 10)
  if (ultimaLimpieza === hoy) return
  ultimaLimpieza = hoy
  await UbicacionMensajero.destroy({ where: { registradaEn: { [Op.lt]: new Date(Date.now() - DIAS_UBICACIONES * 86400000) } } })
}

export const registrarUbicacion = async (tramitadorId: number, datos: { latitud: unknown, longitud: unknown, precision?: unknown }) => {
  const latitud = Number(datos.latitud)
  const longitud = Number(datos.longitud)
  const precision = datos.precision === undefined || datos.precision === null || datos.precision === '' ? null : Number(datos.precision)
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud) || Math.abs(latitud) > 90 || Math.abs(longitud) > 180) {
    throw new ErrorUbicacion('Ubicación no válida')
  }

  const mensajero = await Tramitador.findByPk(tramitadorId, { attributes: ['id', 'esMensajero', 'activo'] })
  if (!mensajero?.esMensajero || !mensajero.activo) throw new ErrorUbicacion('No está registrado como mensajero', 403)

  const ultima = await UbicacionMensajero.findOne({ where: { tramitadorId }, order: [['registradaEn', 'DESC']], attributes: ['registradaEn'] })
  if (ultima && Date.now() - ultima.registradaEn.getTime() < SEGUNDOS_ENTRE_UBICACIONES * 1000) return { guardada: false }

  await UbicacionMensajero.create({
    tramitadorId,
    latitud,
    longitud,
    precisionMetros: precision !== null && Number.isFinite(precision) ? Math.round(precision) : null,
    registradaEn: new Date()
  })
  limpiarViejas().catch(error => console.error('Ubicaciones: no se pudieron borrar las viejas', error))
  return { guardada: true }
}

// Última posición de cada mensajero en el día (hora de Colombia)
export const ubicacionesDelDia = (fecha: string) =>
  db.query<{ tramitadorId: number, latitud: number, longitud: number, precisionMetros: number | null, registradaEn: string }>(`
    SELECT DISTINCT ON (u.tramitador_id)
      u.tramitador_id AS "tramitadorId", u.latitud, u.longitud, u.precision_metros AS "precisionMetros",
      u.registrada_en AS "registradaEn"
    FROM mensajeria_ubicaciones u
    WHERE (u.registrada_en AT TIME ZONE 'America/Bogota')::date = CAST(:fecha AS DATE)
    ORDER BY u.tramitador_id, u.registrada_en DESC
  `, { type: QueryTypes.SELECT, replacements: { fecha } })
