import { Table, Column, DataType, Model, AllowNull, Default, Unique, ForeignKey, BelongsTo, HasMany } from 'sequelize-typescript'
import Usuarios from '../usuarios'
import Bolsas from './bolsas'
import LegalizacionesCaja from './legalizacionesCaja'
import DocumentosGasto from './documentosGasto'
import TrazabilidadReembolsosCaja from './trazabilidadReembolsosCaja'

// Reembolso de caja menor (RCM-2026-000001 = número de legalización): agrupa gastos ya legalizados
// de una caja. BORRADOR → POR_APROBAR (Dirección de Negocio) → APROBADO → LEGALIZADO (llegó el
// dinero: la caja se repone por el total). Si Dirección lo rechaza vuelve a BORRADOR.
@Table({
  tableName: 'gastos_reembolsos_caja',
  underscored: true
})
class ReembolsosCaja extends Model {

  @Unique
  @Column({ type: DataType.STRING(20) })
  declare codigo: string

  @ForeignKey(() => Bolsas)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare bolsaId: number

  @BelongsTo(() => Bolsas)
  declare bolsa: Bolsas

  // BORRADOR | POR_APROBAR | APROBADO | LEGALIZADO | ANULADO (constantes ESTADOS_REEMBOLSO_CAJA)
  @AllowNull(false)
  @Default('BORRADOR')
  @Column({ type: DataType.STRING(20) })
  declare estado: string

  // Suma del valor de los soportes de sus gastos
  @AllowNull(false)
  @Default(0)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare total: string

  @Column({ type: DataType.TEXT })
  declare observacion: string | null

  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare creadoPor: number

  @BelongsTo(() => Usuarios, { foreignKey: 'creadoPor', as: 'creador' })
  declare creador: Usuarios

  @Column({ type: DataType.DATE })
  declare fechaEnvio: Date | null

  @Column({ type: DataType.INTEGER })
  declare aprobadoPor: number | null

  @BelongsTo(() => Usuarios, { foreignKey: 'aprobadoPor', as: 'aprobador' })
  declare aprobador: Usuarios

  @Column({ type: DataType.DATE })
  declare fechaAprobacion: Date | null

  // Último rechazo de Dirección (queda en el borrador para corregirlo; todos quedan en el historial)
  @Column({ type: DataType.TEXT })
  declare motivoRechazo: string | null

  @Column({ type: DataType.INTEGER })
  declare legalizadoPor: number | null

  @BelongsTo(() => Usuarios, { foreignKey: 'legalizadoPor', as: 'legalizador' })
  declare legalizador: Usuarios

  // Fecha en que se recibió el dinero del reembolso
  @Column({ type: DataType.DATEONLY })
  declare fechaLegalizacion: string | null

  @HasMany(() => LegalizacionesCaja)
  declare legalizaciones: LegalizacionesCaja[]

  @HasMany(() => DocumentosGasto, { foreignKey: 'reembolsoCajaId', constraints: false })
  declare documentos: DocumentosGasto[]

  @HasMany(() => TrazabilidadReembolsosCaja)
  declare historial: TrazabilidadReembolsosCaja[]
}

export default ReembolsosCaja
