import { Table, Column, Model, DataType } from 'sequelize-typescript'

@Table({
  tableName: 'Notificaciones'
})
class Notificacion extends Model {

  @Column(DataType.INTEGER)
  solicitudTramiteId!: number

  @Column(DataType.STRING)
  tipo!: string

  @Column(DataType.STRING)
  canal!: string

  @Column(DataType.STRING)
  destinatario!: string

  @Column(DataType.TEXT)
  mensaje!: string

  @Column(DataType.STRING)
  estado!: string

  @Column(DataType.TEXT)
  error!: string

  @Column(DataType.DATE)
  fechaEnvio!: Date
}

export default Notificacion