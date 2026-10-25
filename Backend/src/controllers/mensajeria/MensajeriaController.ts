import type { Request, Response } from 'express'
import { QueryTypes } from 'sequelize'
import { db } from '../../config/db'
import SedeMensajeria from '../../models/mensajeria/sedeMensajeria'
import ParadaMensajeria from '../../models/mensajeria/paradaMensajeria'
import { obtenerArchivo } from '../../services/azureFileStorage'
import { ErrorUbicacion, buscarDireccion, geocodificar, googleDisponible, ubicarManual, ubicarTramite } from '../../services/mensajeria/ubicacion'
import { hoyBogota, optimizarRuta, reordenarParadas, rutasDelDia } from '../../services/mensajeria/rutas'
import { MAXIMO_PUNTOS_TRAZADO, trazarRuta } from '../../services/mensajeria/trazado'
import { ubicacionesDelDia } from '../../services/mensajeria/ubicacionEnVivo'
import { generarReporteRutas } from '../../services/mensajeria/reporteRutas'

const responder = (res: Response, error: unknown) => {
  if (error instanceof ErrorUbicacion) return res.status(error.status).json({ error: error.message })
  console.error('MENSAJERÍA:', error)
  return res.status(500).json({ error: 'No se pudo completar la operación' })
}

const fechaValida = (valor: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(valor ?? '')) ? String(valor) : null)
const coordenada = (valor: unknown) => (valor === null || valor === undefined || valor === '' ? null : Number(valor))

// Rutas de mensajeros en Nodex Trámites (Torre de control)
export class MensajeriaController {

  // GET /ubicaciones?fecha=: última posición del día de cada mensajero que inició su ruta
  static ubicaciones = async (req: Request, res: Response) => {
    try {
      res.json(await ubicacionesDelDia(fechaValida(req.query.fecha) ?? hoyBogota()))
    } catch (error) {
      responder(res, error)
    }
  }

  // GET /reporte/exportar?desde=&hasta=&sedeId=: Excel de tiempos y km por día, ruta y diligencia (PESV)
  static exportarReporte = async (req: Request, res: Response) => {
    try {
      const desde = fechaValida(req.query.desde)
      const hasta = fechaValida(req.query.hasta)
      if (!desde || !hasta) throw new ErrorUbicacion('Indique las fechas desde y hasta')
      const sedeId = Number(req.query.sedeId) > 0 ? Number(req.query.sedeId) : undefined
      let archivo: Buffer
      try {
        archivo = await generarReporteRutas(desde, hasta, sedeId)
      } catch (error) {
        if (error instanceof Error && /fecha|rango/.test(error.message)) throw new ErrorUbicacion(error.message)
        throw error
      }
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="rutas-mensajeros-${desde}-a-${hasta}.xlsx"`)
      res.send(archivo)
    } catch (error) {
      responder(res, error)
    }
  }

  static configuracion = (_req: Request, res: Response) => {
    res.json({ googleDisponible: googleDisponible(), hoy: hoyBogota() })
  }

  // ── Sedes ──

  static sedes = async (_req: Request, res: Response) => {
    try {
      res.json(await SedeMensajeria.findAll({ order: [['nombre', 'ASC']] }))
    } catch (error) {
      responder(res, error)
    }
  }

  // Crear (sin id) o editar una sede. Si no se envían coordenadas y Google está disponible,
  // se ubica la dirección automáticamente.
  static guardarSede = async (req: Request, res: Response) => {
    try {
      const nombre = String(req.body.nombre ?? '').trim()
      const direccion = String(req.body.direccion ?? '').trim()
      if (!nombre || nombre.length > 100) throw new ErrorUbicacion('Indique el nombre de la sede (máximo 100 caracteres)')
      if (!direccion || direccion.length > 300) throw new ErrorUbicacion('Indique la dirección de la sede (máximo 300 caracteres)')

      let latitud = coordenada(req.body.latitud)
      let longitud = coordenada(req.body.longitud)
      if ((latitud === null || longitud === null) && googleDisponible()) {
        const ubicada = await geocodificar(`${direccion}, Colombia`)
        latitud = ubicada?.latitud ?? null
        longitud = ubicada?.longitud ?? null
      }
      if (latitud !== null && !(Math.abs(latitud) <= 90 && Math.abs(longitud ?? 999) <= 180)) throw new ErrorUbicacion('Coordenadas no válidas')

      const datos = { nombre, direccion, latitud, longitud, activo: req.body.activo !== false }
      const id = Number(req.params.id)
      if (id) {
        const sede = await SedeMensajeria.findByPk(id)
        if (!sede) throw new ErrorUbicacion('La sede no existe', 404)
        await sede.update(datos)
        return res.json(sede)
      }
      res.status(201).json(await SedeMensajeria.create(datos))
    } catch (error) {
      responder(res, error)
    }
  }

  // ── Rutas del día ──

  static rutas = async (req: Request, res: Response) => {
    try {
      const fecha = fechaValida(req.query.fecha) ?? hoyBogota()
      const sedeId = Number(req.query.sedeId) || undefined
      res.json(await rutasDelDia(fecha, sedeId))
    } catch (error) {
      responder(res, error)
    }
  }

  static reordenar = async (req: Request, res: Response) => {
    try {
      const fecha = fechaValida(req.body.fecha)
      const paradaIds: unknown = req.body.paradaIds
      if (!fecha) throw new ErrorUbicacion('Fecha no válida')
      if (!Array.isArray(paradaIds) || !paradaIds.every(id => Number.isInteger(id) && id > 0)) throw new ErrorUbicacion('Orden no válido')

      await reordenarParadas(fecha, Number(req.params.tramitadorId), paradaIds as number[])
      res.json({ mensaje: 'Orden guardado' })
    } catch (error) {
      responder(res, error)
    }
  }

  static optimizar = async (req: Request, res: Response) => {
    try {
      const fecha = fechaValida(req.body.fecha)
      if (!fecha) throw new ErrorUbicacion('Fecha no válida')
      res.json(await optimizarRuta(fecha, Number(req.params.tramitadorId)))
    } catch (error) {
      responder(res, error)
    }
  }

  // Línea de la ruta por las calles para el mapa: puntos en orden (sede → paradas → sede)
  static trazado = async (req: Request, res: Response) => {
    try {
      const puntos = Array.isArray(req.body?.puntos) ? req.body.puntos : []
      const validos = puntos.map((p: { latitud?: unknown, longitud?: unknown }) => ({ latitud: Number(p?.latitud), longitud: Number(p?.longitud) }))
      if (validos.length < 2 || validos.length > MAXIMO_PUNTOS_TRAZADO) {
        throw new ErrorUbicacion(`Envíe entre 2 y ${MAXIMO_PUNTOS_TRAZADO} puntos`)
      }
      if (validos.some((p: { latitud: number, longitud: number }) =>
        !Number.isFinite(p.latitud) || !Number.isFinite(p.longitud) || Math.abs(p.latitud) > 90 || Math.abs(p.longitud) > 180)) {
        throw new ErrorUbicacion('Hay coordenadas no válidas')
      }
      res.json(await trazarRuta(validos))
    } catch (error) {
      responder(res, error)
    }
  }

  // ── Ubicación de trámites ──

  // Vuelve a ubicar un trámite con Google
  static ubicar = async (req: Request, res: Response) => {
    try {
      // Con { direccion }: busca la dirección que se está corrigiendo, sin guardarla
      if (typeof req.body?.direccion === 'string') {
        if (!googleDisponible()) throw new ErrorUbicacion('La ubicación automática no está configurada (falta la clave de Google Maps)', 503)
        const resultado = await buscarDireccion(Number(req.params.id), req.body.direccion)
        if (!resultado) throw new ErrorUbicacion('Google no encontró la dirección. Ubíquela en el mapa', 422)
        return res.json({ latitud: resultado.latitud, longitud: resultado.longitud, ubicacionPrecisa: resultado.precisa, ubicacionFuente: 'GOOGLE' })
      }
      const { solicitud, encontrada } = await ubicarTramite(Number(req.params.id), { forzar: true })
      if (encontrada === false) throw new ErrorUbicacion('Google no encontró la dirección. Ubíquela en el mapa', 422)
      res.json({ latitud: solicitud.latitud, longitud: solicitud.longitud, ubicacionPrecisa: solicitud.ubicacionPrecisa, ubicacionFuente: solicitud.ubicacionFuente })
    } catch (error) {
      responder(res, error)
    }
  }

  // Punto puesto a mano en el mapa
  static ubicarManual = async (req: Request, res: Response) => {
    try {
      const latitud = coordenada(req.body.latitud)
      const longitud = coordenada(req.body.longitud)
      if (latitud === null || longitud === null) throw new ErrorUbicacion('Indique la ubicación en el mapa')
      // `direccion` opcional: corrige también la dirección del trámite
      const direccion = typeof req.body.direccion === 'string' ? req.body.direccion : undefined
      const solicitud = await ubicarManual(Number(req.params.id), { latitud, longitud }, 'MANUAL', direccion)
      res.json({
        latitud: solicitud.latitud,
        longitud: solicitud.longitud,
        ubicacionPrecisa: solicitud.ubicacionPrecisa,
        ubicacionFuente: solicitud.ubicacionFuente,
        direccionTramite: solicitud.direccionTramite
      })
    } catch (error) {
      responder(res, error)
    }
  }

  // Ubica con Google las paradas del día que aún no tienen ubicación (máximo 100 por vez)
  static ubicarPendientes = async (req: Request, res: Response) => {
    try {
      const fecha = fechaValida(req.body.fecha)
      if (!fecha) throw new ErrorUbicacion('Fecha no válida')
      if (!googleDisponible()) throw new ErrorUbicacion('La ubicación automática no está configurada (falta la clave de Google Maps)', 503)

      const pendientes = await db.query<{ id: number }>(`
        SELECT DISTINCT s.id
        FROM mensajeria_paradas pa
        JOIN "SolicitudTramites" s ON s.id = pa.solicitud_tramite_id
        WHERE pa.fecha = CAST(:fecha AS DATE) AND s.latitud IS NULL AND COALESCE(TRIM(s."direccionTramite"), '') <> ''
        LIMIT 100
      `, { type: QueryTypes.SELECT, replacements: { fecha } })

      let ubicados = 0
      const noEncontrados: number[] = []
      // De a uno: Google limita las consultas por segundo
      for (const { id } of pendientes) {
        try {
          const { encontrada } = await ubicarTramite(id, { forzar: true })
          if (encontrada) ubicados++
          else noEncontrados.push(id)
        } catch {
          noEncontrados.push(id)
        }
      }
      res.json({ revisados: pendientes.length, ubicados, noEncontrados })
    } catch (error) {
      responder(res, error)
    }
  }

  // Foto de la visita
  static foto = async (req: Request, res: Response) => {
    try {
      const parada = await ParadaMensajeria.findByPk(Number(req.params.id))
      if (!parada?.fotoRuta || !parada.fotoNombre) throw new ErrorUbicacion('La visita no tiene foto', 404)
      const contenido = await obtenerArchivo(parada.fotoRuta, parada.fotoNombre)
      res.setHeader('Content-Type', parada.fotoTipo ?? 'image/jpeg')
      res.setHeader('Content-Disposition', `inline; filename="${parada.fotoNombre}"`)
      res.send(contenido)
    } catch (error) {
      responder(res, error)
    }
  }
}
