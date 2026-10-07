import { randomInt } from 'crypto'
import jwt from 'jsonwebtoken'
import Tramitador from '../../models/tramitador'
import AccesoTramitador from '../../models/tramitadores/accesoTramitador'
import { checkContrasena, hashcontrasena } from '../../utils/auth'
import { generarContrasenaCumplida } from '../../utils/politicaContrasena'
import { ErrorGastos as ErrorNegocio } from '../gastos/errores'

// Tipo de token de la app de tramitadores. El middleware de usuarios internos
// (autenticacion) lo rechaza, y el de tramitadores solo acepta este.
export const TIPO_TOKEN_TRAMITADOR = 'TRAMITADOR'

const MAXIMO_INTENTOS = 5
const MINUTOS_BLOQUEO = 15
const DURACION_SESION = '15d'

// Temporal que ya cumple la política (mayúscula, minúscula, número y especial), sin
// caracteres que se confunden al dictarlos. El tramitador la cambia al primer ingreso.
const generarContrasenaTemporal = () => generarContrasenaCumplida(randomInt)

// Hash fijo para comparar cuando el usuario no existe: la respuesta tarda lo mismo
// y no revela qué identificaciones tienen acceso
let hashFicticio: Promise<string> | null = null
const obtenerHashFicticio = () => (hashFicticio ??= hashcontrasena(generarContrasenaTemporal()))

const ERROR_CREDENCIALES = 'Usuario o contraseña incorrectos'

export const firmarTokenTramitador = (acceso: AccesoTramitador) =>
  jwt.sign(
    { tipo: TIPO_TOKEN_TRAMITADOR, tramitadorId: acceso.tramitadorId, v: acceso.versionSesion },
    process.env.JWT_SECRET as string,
    { expiresIn: DURACION_SESION }
  )

// =====================================
// ADMINISTRACIÓN (Torre de control, desde Nodex Trámites)
// =====================================

// Crea el acceso o restablece la contraseña. Devuelve la contraseña temporal
// (solo esta vez: no se puede volver a consultar) y cierra las sesiones abiertas.
export const crearORestablecerAcceso = async (tramitador: Tramitador, usuarioId: number) => {
  if (!tramitador.activo) {
    throw new ErrorNegocio('El tramitador está inactivo: actívelo antes de darle acceso a la app')
  }

  const contrasenaTemporal = generarContrasenaTemporal()
  const contrasena = await hashcontrasena(contrasenaTemporal)
  const existente = await AccesoTramitador.findOne({ where: { tramitadorId: tramitador.id } })

  if (existente) {
    await existente.update({
      contrasena,
      debeCambiarContrasena: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
      versionSesion: existente.versionSesion + 1
    })
  } else {
    await AccesoTramitador.create({ tramitadorId: tramitador.id, contrasena, creadoPor: usuarioId })
  }

  return {
    usuario: tramitador.identificacion,
    contrasenaTemporal,
    restablecido: Boolean(existente)
  }
}

// Quita el acceso: las sesiones abiertas dejan de funcionar en la siguiente petición
export const revocarAcceso = async (tramitadorId: number) => {
  const eliminados = await AccesoTramitador.destroy({ where: { tramitadorId } })
  if (!eliminados) throw new ErrorNegocio('El tramitador no tiene acceso a la app', 404)
}

// =====================================
// INICIO DE SESIÓN (app Nodex Tramitadores)
// =====================================
export const iniciarSesion = async (identificacion: string, contrasenaIngresada: string) => {
  const tramitador = await Tramitador.findOne({
    where: { identificacion: identificacion.trim() },
    include: [{ model: AccesoTramitador }]
  })
  const acceso = tramitador?.acceso

  if (!tramitador || !acceso) {
    await checkContrasena(contrasenaIngresada, await obtenerHashFicticio())
    throw new ErrorNegocio(ERROR_CREDENCIALES, 401)
  }

  if (acceso.bloqueadoHasta && acceso.bloqueadoHasta > new Date()) {
    const minutos = Math.ceil((acceso.bloqueadoHasta.getTime() - Date.now()) / 60000)
    throw new ErrorNegocio(`Demasiados intentos fallidos. Intente de nuevo en ${minutos} minuto(s)`, 429)
  }

  if (!(await checkContrasena(contrasenaIngresada, acceso.contrasena))) {
    const intentos = acceso.intentosFallidos + 1
    const bloquear = intentos >= MAXIMO_INTENTOS
    await acceso.update({
      intentosFallidos: bloquear ? 0 : intentos,
      bloqueadoHasta: bloquear ? new Date(Date.now() + MINUTOS_BLOQUEO * 60000) : acceso.bloqueadoHasta
    })
    throw new ErrorNegocio(
      bloquear ? `Demasiados intentos fallidos. El usuario queda bloqueado ${MINUTOS_BLOQUEO} minutos` : ERROR_CREDENCIALES,
      bloquear ? 429 : 401
    )
  }

  // La contraseña es correcta, pero solo entran los tramitadores activos
  if (!tramitador.activo) {
    throw new ErrorNegocio('Su usuario está inactivo. Comuníquese con Torre de control', 403)
  }

  await acceso.update({ intentosFallidos: 0, bloqueadoHasta: null, ultimoIngreso: new Date() })

  return {
    token: firmarTokenTramitador(acceso),
    debeCambiarContrasena: acceso.debeCambiarContrasena,
    tramitador: { id: tramitador.id, nombre: tramitador.nombreTramitador }
  }
}

// Cambio de contraseña (obligatorio tras la temporal). Devuelve un token nuevo:
// las demás sesiones abiertas se cierran
export const cambiarContrasena = async (acceso: AccesoTramitador, identificacion: string, actual: string, nueva: string) => {
  if (!(await checkContrasena(actual, acceso.contrasena))) {
    throw new ErrorNegocio('La contraseña actual es incorrecta', 401)
  }
  if (nueva === actual) throw new ErrorNegocio('La nueva contraseña debe ser distinta a la actual')
  if (nueva.includes(identificacion)) throw new ErrorNegocio('La contraseña no puede contener su identificación')

  await acceso.update({
    contrasena: await hashcontrasena(nueva),
    debeCambiarContrasena: false,
    versionSesion: acceso.versionSesion + 1
  })

  return { token: firmarTokenTramitador(acceso) }
}
