import { Model, ModelStatic, Op } from 'sequelize'
import TiposGasto from '../models/gastos/tiposGasto'
import FormasPago from '../models/gastos/formasPago'
import EstadosGasto from '../models/gastos/estadosGasto'
import EstadosCuentaCobro from '../models/gastos/estadosCuentaCobro'
import EstadosReintegro from '../models/gastos/estadosReintegro'
import TiposDocumentoGasto from '../models/gastos/tiposDocumentoGasto'
import Parametros from '../models/gastos/parametros'
import Roles from '../models/gastos/roles'
import UsuarioRoles from '../models/gastos/usuarioRoles'
import Usuarios from '../models/usuarios'
import {
  ROLES,
  TIPOS_GASTO,
  ESTADOS_GASTO,
  ESTADOS_CUENTA_COBRO,
  ESTADOS_REINTEGRO,
  PARAMETROS
} from '../services/gastos/constantes'


// =====================================
// DATOS INICIALES
// Solo se insertan si no existen: si alguien cambia un nombre
// en la base de datos, el seed no lo sobrescribe.
// =====================================

const TIPOS_GASTO_INICIALES = [
  { codigo: TIPOS_GASTO.VEHICULO, nombre: 'Vehículo' },
  { codigo: TIPOS_GASTO.INMUEBLE, nombre: 'Inmueble' },
  { codigo: TIPOS_GASTO.OTRO, nombre: 'Otro' },
  { codigo: TIPOS_GASTO.CTL, nombre: 'CTL' },
  { codigo: TIPOS_GASTO.CAMARA_COMERCIO, nombre: 'Certificado de Cámara de Comercio' }
]

const FORMAS_PAGO_INICIALES = [
  { codigo: 'TRANSFERENCIA', nombre: 'Transferencia' },
  { codigo: 'EFECTIVO', nombre: 'Efectivo' },
  { codigo: 'TARJETA_CORPORATIVA', nombre: 'Tarjeta corporativa' }
]

const ESTADOS_GASTO_INICIALES = [
  { codigo: ESTADOS_GASTO.SOLICITADO, nombre: 'Solicitado', orden: 1 },
  { codigo: ESTADOS_GASTO.PROGRAMADO, nombre: 'Programado para pago', orden: 2 },
  { codigo: ESTADOS_GASTO.APROBADO_PAGO, nombre: 'Aprobado para pago', orden: 3 },
  { codigo: ESTADOS_GASTO.PAGADO, nombre: 'Pagado', orden: 4 },
  { codigo: ESTADOS_GASTO.FACTURADO, nombre: 'Facturado', orden: 5 },
  { codigo: ESTADOS_GASTO.EN_CUENTA_COBRO, nombre: 'En cuenta de cobro', orden: 6 },
  { codigo: ESTADOS_GASTO.LEGALIZADO, nombre: 'Legalizado', orden: 7 },
  { codigo: ESTADOS_GASTO.CONTABILIZADO, nombre: 'Contabilizado', orden: 8 },
  { codigo: ESTADOS_GASTO.ANULADO, nombre: 'Anulado', orden: 99 }
]

const ESTADOS_CUENTA_COBRO_INICIALES = [
  { codigo: ESTADOS_CUENTA_COBRO.BORRADOR, nombre: 'Borrador', orden: 1 },
  { codigo: ESTADOS_CUENTA_COBRO.LEGALIZADA, nombre: 'Legalizada', orden: 2 },
  { codigo: ESTADOS_CUENTA_COBRO.CONTABILIZADA, nombre: 'Contabilizada', orden: 3 },
  { codigo: ESTADOS_CUENTA_COBRO.ANULADA, nombre: 'Anulada', orden: 99 }
]

const ESTADOS_REINTEGRO_INICIALES = [
  { codigo: ESTADOS_REINTEGRO.PENDIENTE, nombre: 'Pendiente' },
  { codigo: ESTADOS_REINTEGRO.REINTEGRADO, nombre: 'Reintegrado' }
]

const TIPOS_DOCUMENTO_INICIALES = [
  { codigo: 'FACTURA', nombre: 'Factura' },
  { codigo: 'SOPORTE_PAGO', nombre: 'Soporte de pago' },
  { codigo: 'CUENTA_COBRO', nombre: 'Cuenta de cobro' },
  { codigo: 'SOPORTE_REINTEGRO', nombre: 'Soporte de reintegro' },
  { codigo: 'SOPORTE_CONSIGNACION', nombre: 'Soporte de consignación' },
  { codigo: 'FACTURA_ANTICIPO', nombre: 'Factura del cliente (PDF)' },
  { codigo: 'FACTURA_ANTICIPO_XML', nombre: 'Factura electrónica (XML)' },
  { codigo: 'OTRO', nombre: 'Otro' }
]

const ROLES_INICIALES = [
  { codigo: ROLES.TESORERIA, nombre: 'Tesorería', descripcion: 'Paga gastos y administra las bolsas' },
  { codigo: ROLES.TESORERIA_CERTIFICADOS, nombre: 'Tesorería - Certificados', descripcion: 'Paga las compras de CTL y certificados de Cámara de Comercio' },
  { codigo: ROLES.LEGALIZACION, nombre: 'Legalización', descripcion: 'Arma cuentas de cobro, legaliza y registra reintegros' },
  { codigo: ROLES.CONTABILIDAD, nombre: 'Contabilidad', descripcion: 'Contabiliza las cuentas de cobro legalizadas' },
  { codigo: ROLES.ADMIN, nombre: 'Administrador', descripcion: 'Acceso total al módulo de gastos' },
  { codigo: ROLES.DIRECCION_NEGOCIO, nombre: 'Dirección de Negocio', descripcion: 'Aprueba los pagos que programa Tesorería' },
  { codigo: ROLES.GESTION_ACTIVOS, nombre: 'Gestión de activos', descripcion: 'Trámites: crea y edita sus propios trámites y les crea gastos' },
  { codigo: ROLES.TORRE_CONTROL, nombre: 'Torre de control', descripcion: 'Trámites: acceso completo a la gestión de trámites' },
  { codigo: ROLES.ANALISTA_TRAMITES, nombre: 'Analista de trámites', descripcion: 'Trámites: permisos de Torre de control; en el inicio ve solo sus trámites asignados' },
  { codigo: ROLES.ADMIN_TORRE_CONTROL, nombre: 'Administrador Torre de control', descripcion: 'Trámites: permisos de Torre de control y reasigna los analistas de los trámites' }
]

const PARAMETROS_INICIALES = [
  { clave: PARAMETROS.RETENCION_FUENTE, valor: '0.11', descripcion: 'Retención en la fuente sobre la base de retención' },
  { clave: PARAMETROS.GMF, valor: '0.004', descripcion: '4x1000 sobre el valor de la factura' }
]


// =====================================
// UTILIDADES
// =====================================

const insertarSiNoExisten = async (
  modelo: ModelStatic<Model>,
  campoClave: string,
  registros: Record<string, unknown>[]
) => {
  for (const registro of registros) {
    await modelo.findOrCreate({
      where: { [campoClave]: registro[campoClave] },
      defaults: registro
    })
  }
}

// Asigna ADMIN a los correos de GASTOS_ADMIN_CORREOS (separados por coma).
// Sirve para tener el primer administrador, que luego asigna los demás roles.
const asignarAdministradoresIniciales = async () => {
  const correos = (process.env.GASTOS_ADMIN_CORREOS ?? '')
    .split(',')
    .map(correo => correo.trim().toLowerCase())
    .filter(Boolean)

  if (correos.length === 0) return

  const rolAdmin = await Roles.findOne({ where: { codigo: ROLES.ADMIN } })
  if (!rolAdmin) return

  for (const correo of correos) {
    const usuario = await Usuarios.findOne({ where: { correoUsuario: { [Op.iLike]: correo } } })

    if (!usuario) {
      console.warn(`⚠️ GASTOS_ADMIN_CORREOS: no existe el usuario ${correo}`)
      continue
    }

    await UsuarioRoles.findOrCreate({
      where: { usuarioId: usuario.id, rolId: rolAdmin.id }
    })
  }
}


// =====================================
// PUNTO DE ENTRADA
// =====================================

export const seedGastos = async () => {
  await insertarSiNoExisten(TiposGasto, 'codigo', TIPOS_GASTO_INICIALES)
  await insertarSiNoExisten(FormasPago, 'codigo', FORMAS_PAGO_INICIALES)
  await insertarSiNoExisten(EstadosGasto, 'codigo', ESTADOS_GASTO_INICIALES)
  // El orden de los estados es del sistema (no lo edita el usuario): se mantiene actualizado
  for (const { codigo, orden } of ESTADOS_GASTO_INICIALES) {
    await EstadosGasto.update({ orden }, { where: { codigo } })
  }
  await insertarSiNoExisten(EstadosCuentaCobro, 'codigo', ESTADOS_CUENTA_COBRO_INICIALES)
  await insertarSiNoExisten(EstadosReintegro, 'codigo', ESTADOS_REINTEGRO_INICIALES)
  await insertarSiNoExisten(TiposDocumentoGasto, 'codigo', TIPOS_DOCUMENTO_INICIALES)
  await insertarSiNoExisten(Roles, 'codigo', ROLES_INICIALES)
  await insertarSiNoExisten(Parametros, 'clave', PARAMETROS_INICIALES)

  await asignarAdministradoresIniciales()
}
