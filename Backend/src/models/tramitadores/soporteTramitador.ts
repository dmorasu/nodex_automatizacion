import { Table, Column, DataType, Model, ForeignKey, BelongsTo, HasMany, AllowNull, Default } from 'sequelize-typescript'
import SolicitudesGasto from '../gastos/solicitudesGasto'
import Reintegros from '../gastos/reintegros'
import Tramitador from '../tramitador'
import Usuarios from '../usuarios'
import ArchivoSoporte from './archivoSoporte'

export const TIPOS_SOPORTE = { FACTURA: 'FACTURA', REINTEGRO: 'REINTEGRO', OTRO: 'OTRO' } as const
export const ESTADOS_SOPORTE = { PENDIENTE: 'PENDIENTE', APROBADO: 'APROBADO', RECHAZADO: 'RECHAZADO' } as const

// Soporte que sube el tramitador desde la app: factura de un gasto o comprobante de un reintegro.
// Queda por revisar; al aprobarlo, sus archivos pasan a ser documentos del gasto (o del reintegro).
// Si se rechaza, el tramitador ve el motivo y puede subir otro.
@Table({
  tableName: 'tramitadores_soportes',
  underscored: true
})
class SoporteTramitador extends Model {

  @ForeignKey(() => SolicitudesGasto)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare solicitudGastoId: number

  @BelongsTo(() => SolicitudesGasto)
  declare solicitudGasto: SolicitudesGasto

  // Solo para soportes de reintegro
  @ForeignKey(() => Reintegros)
  @Column({ type: DataType.INTEGER })
  declare reintegroId: number | null

  @BelongsTo(() => Reintegros)
  declare reintegro: Reintegros

  @ForeignKey(() => Tramitador)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare tramitadorId: number

  @BelongsTo(() => Tramitador)
  declare tramitador: Tramitador

  @AllowNull(false)
  @Column({ type: DataType.STRING(20) })
  declare tipo: string

  @Column({ type: DataType.TEXT })
  declare observacion: string | null

  @Default(ESTADOS_SOPORTE.PENDIENTE)
  @Column({ type: DataType.STRING(20) })
  declare estado: string

  @Column({ type: DataType.TEXT })
  declare motivoRechazo: string | null

  @ForeignKey(() => Usuarios)
  @Column({ type: DataType.INTEGER })
  declare revisadoPor: number | null

  @BelongsTo(() => Usuarios, { foreignKey: 'revisadoPor', as: 'revisor' })
  declare revisor: Usuarios

  @Column({ type: DataType.DATE })
  declare fechaRevision: Date | null

  @HasMany(() => ArchivoSoporte)
  declare archivos: ArchivoSoporte[]
}

export default SoporteTramitador
