import { Op } from 'sequelize'
import TiposDocumentoGasto from '../../models/gastos/tiposDocumentoGasto'
import type SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import Reintegros from '../../models/gastos/reintegros'
import EstadosReintegro from '../../models/gastos/estadosReintegro'
import { ESTADOS_GASTO, ESTADOS_REINTEGRO } from './constantes'
import { codigoEstadoGasto } from './estadosGasto'

// =====================================
// TIPOS DE DOCUMENTO SEGÚN LA ETAPA DEL GASTO
// Cada tipo dice para qué servicio se sube (Catálogos → Tipos de documento):
// antes del pago → los de pago; ya pagado → los de legalización y, si tiene un reintegro
// pendiente, también los de reintegro. Así el usuario no ve tipos que no le corresponden.
// =====================================

type Uso = 'paraPago' | 'paraLegalizacion' | 'paraReintegro'

const ANTES_DEL_PAGO: string[] = [ESTADOS_GASTO.SOLICITADO, ESTADOS_GASTO.PROGRAMADO, ESTADOS_GASTO.APROBADO_PAGO]

const usosDelGasto = async (gasto: Pick<SolicitudesGasto, "id" | "estadoId">): Promise<Uso[]> => {
  if (ANTES_DEL_PAGO.includes(await codigoEstadoGasto(gasto.estadoId))) return ['paraPago']

  const reintegroPendiente = await Reintegros.count({
    where: { solicitudGastoId: gasto.id },
    include: [{ model: EstadosReintegro, where: { codigo: ESTADOS_REINTEGRO.PENDIENTE }, attributes: [] }]
  })
  return reintegroPendiente ? ['paraLegalizacion', 'paraReintegro'] : ['paraLegalizacion']
}

// Tipos activos que se pueden subir al gasto en su etapa actual
export const tiposDocumentoDelGasto = async (gasto: Pick<SolicitudesGasto, "id" | "estadoId">) => {
  const usos = await usosDelGasto(gasto)
  return TiposDocumentoGasto.findAll({
    where: {
      activo: true,
      [Op.or]: [
        ...usos.map(uso => ({ [uso]: true })),
        // La factura de Legalización se sube por este mismo cargue: siempre se permite ya pagado
        ...(usos.includes('paraLegalizacion') ? [{ codigo: 'FACTURA' }] : [])
      ]
    },
    attributes: ['id', 'codigo', 'nombre'],
    order: [['nombre', 'ASC']]
  })
}
