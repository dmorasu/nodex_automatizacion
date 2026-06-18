import { Table, Column, Model, DataType } from 'sequelize-typescript'

@Table({
  tableName: 'Notificaciones'
})
class Notificacion extends Model {

  @Column(DataType.INTEGER)
  declare solicitudTramiteId: number

  @Column(DataType.STRING)
  declare tipo: string

  @Column(DataType.STRING)
  declare canal: string

  @Column(DataType.STRING)
  declare destinatario: string

  @Column(DataType.TEXT)
  declare mensaje: string

  @Column(DataType.STRING)
  declare estado: string

  @Column(DataType.TEXT)
  declare error: string | null

  @Column(DataType.DATE)
  declare fechaEnvio: Date | null
}

export default Notificacion