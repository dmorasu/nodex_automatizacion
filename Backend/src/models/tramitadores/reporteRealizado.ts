import { Table, Column, DataType, Model, ForeignKey, BelongsTo, AllowNull, Default } from 'sequelize-typescript'
import SolicitudTramites from '../solicitudTramites'
import Tramitador from '../tramitador'
import Usuarios from '../usuarios'

// DEVUELTO (2026-10-13): Torre de control lo devuelve al tramitador con el motivo (en notaRevision);
// el tramitador puede volver a reportarlo cuando lo corrija
export const ESTADOS_REPORTE = { PENDIENTE: 'PENDIENTE', REVISADO: 'REVISADO', DEVUELTO: 'DEVUELTO' } as const

// El tramitador reporta que hizo el trámite. NO cambia el estado oficial:
// Gestión de activos o Torre de control lo revisan y, si corresponde, lo pasan a Finalizado.
@Table({
  tableName: 'tramitadores_reportes_realizado',
  underscored: true
})
class ReporteRealizado extends Model {

  @ForeignKey(() => SolicitudTramites)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare solicitudTramiteId: number

  @BelongsTo(() => SolicitudTramites, { onDelete: 'CASCADE' })
  declare solicitudTramite: SolicitudTramites

  @ForeignKey(() => Tramitador)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare tramitadorId: number

  @BelongsTo(() => Tramitador)
  declare tramitador: Tramitador

  @AllowNull(false)
  @Column({ type: DataType.TEXT })
  declare observacion: string

  @Default(ESTADOS_REPORTE.PENDIENTE)
  @Column({ type: DataType.STRING(20) })
  declare estado: string

  @ForeignKey(() => Usuarios)
  @Column({ type: DataType.INTEGER })
  declare revisadoPor: number | null

  @BelongsTo(() => Usuarios, { foreignKey: 'revisadoPor', as: 'revisor' })
  declare revisor: Usuarios

  @Column({ type: DataType.DATE })
  declare fechaRevision: Date | null

  @Column({ type: DataType.TEXT })
  declare notaRevision: string | null
}

export default ReporteRealizado
