import { Table, Column, DataType, Model, AllowNull, Default, ForeignKey, BelongsTo } from 'sequelize-typescript'
import CuentaCobroTramitador from './cuentaCobroTramitador'
import SolicitudTramites from '../solicitudTramites'
import Operaciones from '../operaciones'

// TRAMITE: el valor del trámite finalizado (uno por trámite). VISITA_FALLIDA: una ida adicional
// que no se pudo terminar. ADICIONAL: papelería, impresiones, sobres… Las tres van atadas a un
// trámite y su centro de costos es el de la operación del trámite.
export const TIPOS_LINEA_CUENTA = {
  TRAMITE: 'TRAMITE',
  VISITA_FALLIDA: 'VISITA_FALLIDA',
  ADICIONAL: 'ADICIONAL'
} as const

export type TipoLineaCuenta = typeof TIPOS_LINEA_CUENTA[keyof typeof TIPOS_LINEA_CUENTA]

@Table({
  tableName: 'tramitadores_cuentas_cobro_lineas',
  underscored: true,
  indexes: [
    { name: 'tramitadores_cuentas_cobro_lineas_cuenta', fields: ['cuenta_id'] },
    { name: 'tramitadores_cuentas_cobro_lineas_tramite', fields: ['solicitud_tramite_id', 'tipo'] }
  ]
})
class LineaCuentaCobroTramitador extends Model {

  @ForeignKey(() => CuentaCobroTramitador)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare cuentaId: number

  @BelongsTo(() => CuentaCobroTramitador, { onDelete: 'CASCADE' })
  declare cuenta: CuentaCobroTramitador

  @ForeignKey(() => SolicitudTramites)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare solicitudTramiteId: number

  @BelongsTo(() => SolicitudTramites)
  declare solicitudTramite: SolicitudTramites

  @AllowNull(false)
  @Column({ type: DataType.STRING(20) })
  declare tipo: TipoLineaCuenta

  // Lo que sale en "Detalle del trámite" del anexo (tipo de trámite, "Traspaso fallido", "Papelería"…)
  @AllowNull(false)
  @Column({ type: DataType.STRING(200) })
  declare concepto: string

  // Fecha de realización: la de finalizado en los trámites; la que se indique en las demás
  @AllowNull(false)
  @Column({ type: DataType.DATEONLY })
  declare fecha: string

  // Centavos
  @AllowNull(false)
  @Default(0)
  @Column({ type: DataType.BIGINT })
  declare valor: string

  // Centro de costos al momento de armar la cuenta (si después cambia la operación, la cuenta no cambia)
  @ForeignKey(() => Operaciones)
  @Column({ type: DataType.INTEGER })
  declare operacionId: number | null

  @Column({ type: DataType.STRING(200) })
  declare centroCostos: string | null

  // Quién la agregó: el analista (usuario) o el tramitador desde la app (con soporte)
  @Column({ type: DataType.INTEGER })
  declare creadaPorUsuario: number | null

  @Column({ type: DataType.INTEGER })
  declare creadaPorTramitador: number | null

  // Soporte del adicional que agrega el tramitador desde la app (foto o PDF en Azure)
  @Column({ type: DataType.STRING(500) })
  declare soporteRuta: string | null

  @Column({ type: DataType.STRING(255) })
  declare soporteNombre: string | null

  @Column({ type: DataType.STRING(100) })
  declare soporteTipo: string | null
}

export default LineaCuentaCobroTramitador
