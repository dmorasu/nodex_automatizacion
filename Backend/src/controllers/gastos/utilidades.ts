import type { Request, Response } from 'express'
import { ErrorGastos } from '../../services/gastos/errores'
import { ROLES, TIPOS_GASTO_CERTIFICADOS } from '../../services/gastos/constantes'
import TiposGasto from '../../models/gastos/tiposGasto'

// Errores de negocio → su código (400, 403, 404); cualquier otro → 500
export const responderError = (res: Response, error: unknown) => {
  if (error instanceof ErrorGastos) {
    return res.status(error.status).json({ error: error.message })
  }

  console.error(error)
  return res.status(500).json({ error: 'Hubo un error' })
}

export const esAdmin = (req: Request) => req.roles?.includes(ROLES.ADMIN) ?? false

// Roles del módulo de gastos (los de trámites, como Gestión de activos, no cuentan)
// (Dirección de Negocio ve los gastos y sus documentos para aprobar los pagos)
const ROLES_GASTOS: string[] = [ROLES.TESORERIA, ROLES.TESORERIA_CERTIFICADOS, ROLES.LEGALIZACION, ROLES.CONTABILIDAD, ROLES.DIRECCION_NEGOCIO, ROLES.ADMIN]

// Con un rol del módulo de gastos se ven todos los gastos; sin él, cada usuario ve solo los suyos
export const puedeVerTodos = (req: Request) => (req.roles ?? []).some(rol => ROLES_GASTOS.includes(rol))

// Tesorería - Certificados sin otro rol de gastos: solo ve y paga las compras de certificados
// (CTL, Cámara de Comercio y RUNT)
export const soloCertificados = (req: Request) => {
  const roles = req.roles ?? []
  return roles.includes(ROLES.TESORERIA_CERTIFICADOS) &&
    !roles.some(rol => ([ROLES.TESORERIA, ROLES.LEGALIZACION, ROLES.CONTABILIDAD, ROLES.ADMIN] as string[]).includes(rol))
}

// Auxiliar de Tesorería - Caja menor sin Tesorería: solo ve y maneja la caja que tiene asignada
export const esAuxiliarCaja = (req: Request) => {
  const roles = req.roles ?? []
  return roles.includes(ROLES.AUXILIAR_TESORERIA_CAJA) && !roles.includes(ROLES.TESORERIA) && !roles.includes(ROLES.ADMIN)
}

// Ids de los tipos de gasto de certificados (se consultan una vez)
let idsCertificados: Promise<number[]> | null = null
export const idsTiposCertificados = () =>
  (idsCertificados ??= TiposGasto.findAll({ where: { codigo: TIPOS_GASTO_CERTIFICADOS }, attributes: ['id'] })
    .then(tipos => tipos.map(t => t.id))
    .catch(error => { idsCertificados = null; throw error }))

// Quién gestiona la factura (y los soportes del tramitador) de un gasto:
// reembolsable → Legalización (va a cuenta de cobro); no reembolsable → Contabilidad (lo asume la bolsa)
export const puedeGestionarFactura = (req: Request, reembolsable: boolean) =>
  esAdmin(req) || (req.roles ?? []).includes(reembolsable ? ROLES.LEGALIZACION : ROLES.CONTABILIDAD)

// Nunca exponer la contraseña al incluir usuarios en una consulta
export const ATRIBUTOS_USUARIO = ['id', 'nombreUsuario']
