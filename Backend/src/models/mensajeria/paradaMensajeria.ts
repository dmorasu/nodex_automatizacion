import { Table, Column, DataType, Model, AllowNull, Default, ForeignKey, BelongsTo } from 'sequelize-typescript'
import SolicitudTramites from '../solicitudTramites'
import Tramitador from '../tramitador'

export const ESTADOS_PARADA = {
  PENDIENTE: 'PENDIENTE',
  ENTREGADO: 'ENTREGADO',
  NO_SE_PUDO: 'NO_SE_PUDO'
} as const

// Una visita del mensajero a un trámite en un día. Las paradas se generan solas con los
// trámites del mensajero cuya fecha de diligencia es ese día; aquí se guarda el orden de la
// ruta y la confirmación de la visita (estado, foto y ubicación GPS).
@Table({
  tableName: 'mensajeria_paradas',
  underscored: true,
  // Los índices van aquí con el nombre real de la columna: con underscored, @Index en la
  // propiedad usa el nombre del atributo (solicitudTramiteId) y Postgres no lo encuentra.
  indexes: [
    { name: 'mensajeria_paradas_tramite_fecha', unique: true, fields: ['solicitud_tramite_id', 'fecha'] },
    { name: 'mensajeria_paradas_fecha_tramitador', fields: ['fecha', 'tramitador_id'] }
  ]
})
class ParadaMensajeria extends Model {

  @ForeignKey(() => SolicitudTramites)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare solicitudTramiteId: number

  @BelongsTo(() => SolicitudTramites, { onDelete: 'CASCADE' })
  declare solicitudTramite: SolicitudTramites

  @AllowNull(false)
  @Column({ type: DataType.DATEONLY })
  declare fecha: string

  @ForeignKey(() => Tramitador)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare tramitadorId: number

  @BelongsTo(() => Tramitador)
  declare tramitador: Tramitador

  // Posición en la ruta del día (1, 2, 3…)
  @AllowNull(false)
  @Default(0)
  @Column({ type: DataType.INTEGER })
  declare orden: number

  @AllowNull(false)
  @Default(ESTADOS_PARADA.PENDIENTE)
  @Column({ type: DataType.STRING(20) })
  declare estado: string

  // ── Confirmación desde la app ──

  @Column({ type: DataType.TEXT })
  declare observacion: string | null

  @Column({ type: DataType.DATE })
  declare fechaConfirmacion: Date | null

  // Dónde estaba el celular al confirmar
  @Column({ type: DataType.DOUBLE })
  declare latitudConfirmacion: number | null

  @Column({ type: DataType.DOUBLE })
  declare longitudConfirmacion: number | null

  @Column({ type: DataType.INTEGER })
  declare precisionMetros: number | null

  // Foto de la visita (Azure File Share)
  @Column({ type: DataType.STRING(500) })
  declare fotoRuta: string | null

  @Column({ type: DataType.STRING(255) })
  declare fotoNombre: string | null

  @Column({ type: DataType.STRING(100) })
  declare fotoTipo: string | null
}

export default ParadaMensajeria
