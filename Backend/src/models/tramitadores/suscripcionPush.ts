import { Table, Column, DataType, Model, ForeignKey, BelongsTo, AllowNull } from 'sequelize-typescript'
import Tramitador from '../tramitador'

// Celular (navegador) en el que el tramitador activó las notificaciones push de la app.
// Un tramitador puede tener varios; el endpoint identifica el celular y es único: si otro
// tramitador inicia sesión en el mismo celular y las activa, la suscripción pasa a él.
@Table({
  tableName: 'tramitadores_suscripciones_push',
  underscored: true,
  indexes: [
    { unique: true, fields: ['endpoint'], name: 'tramitadores_suscripciones_push_endpoint' },
    { fields: ['tramitador_id'], name: 'tramitadores_suscripciones_push_tramitador' }
  ]
})
class SuscripcionPush extends Model {

  @ForeignKey(() => Tramitador)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare tramitadorId: number

  @BelongsTo(() => Tramitador, { onDelete: 'CASCADE' })
  declare tramitador: Tramitador

  // Dirección del servicio de push del navegador (Google, Apple o Mozilla) para este celular
  @AllowNull(false)
  @Column({ type: DataType.TEXT })
  declare endpoint: string

  // Claves con las que se cifra el mensaje para ese navegador
  @AllowNull(false)
  @Column({ type: DataType.STRING(200) })
  declare p256dh: string

  @AllowNull(false)
  @Column({ type: DataType.STRING(100) })
  declare auth: string

  // Solo para soporte (saber si es Android o iPhone)
  @Column({ type: DataType.STRING(300) })
  declare navegador: string | null
}

export default SuscripcionPush
