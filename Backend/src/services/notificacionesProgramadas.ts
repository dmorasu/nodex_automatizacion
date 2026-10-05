import cron, { type ScheduledTask } from "node-cron"
import NotificacionProgramada from "../models/notificacionProgramada"
import SolicitudTramites from "../models/solicitudTramites"
import { obtenerDiligenciasDeHoy, obtenerDiligenciasVencidas } from "./notificacionesDiligenciasServices"
import { crearNotificacion } from "./notificacionesServices"

// =====================================
// NOTIFICACIONES AUTOMÁTICAS DE WHATSAPP (diligencias de hoy y vencidas)
// La hora, los días y si están activas se guardan en `notificaciones_programadas` y se
// cambian desde Nodex Trámites. Al guardar, la tarea se reprograma en caliente.
// Ojo: el programador vive en memoria; con más de una instancia del backend, cada una
// enviaría sus propios mensajes (por eso se despliega una sola).
// =====================================

const ZONA_HORARIA = "America/Bogota"
const TODOS_LOS_DIAS = [0, 1, 2, 3, 4, 5, 6]

export class ErrorNotificacionesProgramadas extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

type Resultado = { encontradas: number, enviadas: number, sinTelefono: number, errores: number }

type Tarea = {
  clave: "DILIGENCIA_HOY" | "DILIGENCIA_VENCIDA"
  nombre: string
  descripcion: string
  // Valores con los que funcionaba antes de ser configurable
  porDefecto: { hora: string, dias: number[], activa: boolean }
  buscar: () => Promise<SolicitudTramites[]>
  datos: (solicitud: SolicitudTramites) => Record<string, unknown>
}

const TAREAS: Tarea[] = [
  {
    clave: "DILIGENCIA_HOY",
    nombre: "Diligencias de hoy",
    descripcion: "Recuerda al tramitador las diligencias en curso programadas para hoy.",
    porDefecto: { hora: "08:00", dias: TODOS_LOS_DIAS, activa: true },
    buscar: obtenerDiligenciasDeHoy,
    datos: solicitud => ({
      nombre: solicitud.tramitador?.nombreTramitador,
      tipo: solicitud.tramite?.nombreTramite,
      detalle: solicitud.detalleSolicitud,
      mueble: solicitud.placa || solicitud.matriculaInmobiliaria || "",
      ubicacion: solicitud.direccionTramite,
      // crearNotificacion lo reemplaza por el analista asignado, si el trámite tiene
      programador: solicitud.municipios?.responsable
    })
  },
  {
    clave: "DILIGENCIA_VENCIDA",
    nombre: "Diligencias vencidas",
    descripcion: "Avisa al tramitador las diligencias en curso cuya fecha programada ya pasó.",
    porDefecto: { hora: "13:00", dias: TODOS_LOS_DIAS, activa: true },
    buscar: obtenerDiligenciasVencidas,
    datos: solicitud => ({
      nombre: solicitud.tramitador?.nombreTramitador,
      tipo: solicitud.tramite?.nombreTramite,
      detalle: solicitud.detalleSolicitud,
      mueble: solicitud.placa || solicitud.matriculaInmobiliaria || "",
      ubicacion: solicitud.direccionTramite,
      fecha: solicitud.programacion?.fechaProbableEntrega,
      programador: solicitud.tramite?.responsable
    })
  }
]

const tareaPorClave = (clave: string) => {
  const tarea = TAREAS.find(t => t.clave === clave)
  if (!tarea) throw new ErrorNotificacionesProgramadas("La notificación no existe", 404)
  return tarea
}

// Tareas de cron vivas y las que se están ejecutando (evita dos envíos simultáneos)
const programadas = new Map<string, ScheduledTask>()
const enEjecucion = new Set<string>()

// ── Ejecución ──

const ejecutar = async (tarea: Tarea, origen: "PROGRAMADA" | "MANUAL", usuario?: string) => {
  if (enEjecucion.has(tarea.clave)) {
    throw new ErrorNotificacionesProgramadas(`"${tarea.nombre}" ya se está enviando. Espere a que termine.`, 409)
  }
  enEjecucion.add(tarea.clave)
  console.log(`🕗 NOTIFICACIONES ${tarea.clave} (${origen}${usuario ? ` · ${usuario}` : ""})`)

  let resultado: Resultado | { error: string }
  try {
    const diligencias = await tarea.buscar()
    const cuenta: Resultado = { encontradas: diligencias.length, enviadas: 0, sinTelefono: 0, errores: 0 }

    for (const solicitud of diligencias) {
      // crearNotificacion no envía nada si el tramitador no tiene número
      if (!solicitud.tramitador?.numeroTramitador) {
        cuenta.sinTelefono++
        continue
      }
      try {
        await crearNotificacion({ solicitud, tipo: tarea.clave, destinatario: solicitud.tramitador, data: tarea.datos(solicitud) })
        cuenta.enviadas++
      } catch (error) {
        cuenta.errores++
        console.error(`❌ ${tarea.clave}: error con la solicitud ${solicitud.id}`, error)
      }
    }
    resultado = cuenta
    console.log(`✅ NOTIFICACIONES ${tarea.clave}:`, cuenta)
  } catch (error) {
    console.error(`❌ NOTIFICACIONES ${tarea.clave}:`, error)
    resultado = { error: "No se pudieron consultar las diligencias" }
  } finally {
    enEjecucion.delete(tarea.clave)
  }

  // Si la tabla no está disponible el envío ya se hizo; solo se pierde el registro
  await NotificacionProgramada.update(
    { ultimaEjecucion: new Date(), ultimoOrigen: origen, ultimoEjecutadoPor: usuario ?? null, ultimoResultado: resultado },
    { where: { clave: tarea.clave } }
  ).catch(error => console.error(`❌ No se guardó la última ejecución de ${tarea.clave}:`, error))

  return resultado
}

// ── Programación ──

// "08:30" + [1,2,3,4,5] → "30 8 * * 1,2,3,4,5"
const expresionCron = (hora: string, dias: number[]) => {
  const [hh, mm] = hora.split(":").map(Number)
  return `${mm} ${hh} * * ${[...dias].sort().join(",")}`
}

const programar = (tarea: Tarea, config: { hora: string, dias: number[], activa: boolean }) => {
  programadas.get(tarea.clave)?.destroy()
  programadas.delete(tarea.clave)

  if (!config.activa || config.dias.length === 0) {
    console.log(`⏸️ ${tarea.nombre}: desactivada`)
    return
  }

  const task = cron.schedule(
    expresionCron(config.hora, config.dias),
    async () => {
      try {
        await ejecutar(tarea, "PROGRAMADA")
      } catch (error) {
        // Ya había un envío manual en curso
        console.warn(`⚠️ ${tarea.clave}:`, error instanceof Error ? error.message : error)
      }
    },
    { timezone: ZONA_HORARIA, name: tarea.clave }
  )
  programadas.set(tarea.clave, task)
  console.log(`⏰ ${tarea.nombre}: ${config.hora} (días ${config.dias.join(",")}, ${ZONA_HORARIA})`)
}

// Al arrancar: crea las filas que falten con los valores de siempre y programa cada tarea.
// Si la tabla no responde, programa los valores por defecto para no dejar de notificar.
export const iniciarNotificacionesProgramadas = async () => {
  for (const tarea of TAREAS) {
    try {
      const [config] = await NotificacionProgramada.findOrCreate({
        where: { clave: tarea.clave },
        defaults: { clave: tarea.clave, ...tarea.porDefecto }
      })
      programar(tarea, config)
    } catch (error) {
      console.error(`❌ No se leyó la configuración de ${tarea.clave}; se usan los valores por defecto`, error)
      programar(tarea, tarea.porDefecto)
    }
  }
}

// ── Consulta y cambios (pantalla de Torre de control) ──

const vista = (tarea: Tarea, config: NotificacionProgramada) => ({
  clave: tarea.clave,
  nombre: tarea.nombre,
  descripcion: tarea.descripcion,
  hora: config.hora,
  dias: config.dias,
  activa: config.activa,
  actualizadoPor: config.actualizadoPor,
  actualizadoEn: config.updatedAt,
  ultimaEjecucion: config.ultimaEjecucion,
  ultimoOrigen: config.ultimoOrigen,
  ultimoEjecutadoPor: config.ultimoEjecutadoPor,
  ultimoResultado: config.ultimoResultado,
  proximaEjecucion: programadas.get(tarea.clave)?.getNextRun() ?? null,
  enEjecucion: enEjecucion.has(tarea.clave)
})

export const listarNotificacionesProgramadas = async () => {
  const configs = await NotificacionProgramada.findAll()
  return TAREAS
    .map(tarea => {
      const config = configs.find(c => c.clave === tarea.clave)
      return config ? vista(tarea, config) : null
    })
    .filter(Boolean)
}

const validarHora = (valor: unknown) => {
  const hora = String(valor ?? "").trim()
  const partes = /^(\d{1,2}):(\d{2})$/.exec(hora)
  if (!partes || Number(partes[1]) > 23 || Number(partes[2]) > 59) {
    throw new ErrorNotificacionesProgramadas("Indique una hora válida (HH:MM)")
  }
  return `${partes[1].padStart(2, "0")}:${partes[2]}`
}

const validarDias = (valor: unknown) => {
  if (!Array.isArray(valor)) throw new ErrorNotificacionesProgramadas("Indique los días de envío")
  const dias = [...new Set(valor.map(Number))]
  if (dias.some(dia => !Number.isInteger(dia) || dia < 0 || dia > 6)) {
    throw new ErrorNotificacionesProgramadas("Días no válidos")
  }
  return dias.sort()
}

export const actualizarNotificacionProgramada = async (
  clave: string,
  cambios: { hora?: unknown, dias?: unknown, activa?: unknown },
  usuario: string
) => {
  const tarea = tareaPorClave(clave)
  const config = await NotificacionProgramada.findOne({ where: { clave } })
  if (!config) throw new ErrorNotificacionesProgramadas("La notificación no existe", 404)

  const hora = cambios.hora === undefined ? config.hora : validarHora(cambios.hora)
  const dias = cambios.dias === undefined ? config.dias : validarDias(cambios.dias)
  const activa = cambios.activa === undefined ? config.activa : cambios.activa === true
  if (activa && dias.length === 0) {
    throw new ErrorNotificacionesProgramadas("Elija al menos un día o desactive la notificación")
  }

  await config.update({ hora, dias, activa, actualizadoPor: usuario })
  programar(tarea, config)
  return vista(tarea, config)
}

// Botón "Enviar ahora": envía aunque la notificación esté desactivada o no sea su día
export const enviarAhora = async (clave: string, usuario: string) => {
  const tarea = tareaPorClave(clave)
  const resultado = await ejecutar(tarea, "MANUAL", usuario)
  if ("error" in resultado) throw new ErrorNotificacionesProgramadas(resultado.error, 500)
  return resultado
}
