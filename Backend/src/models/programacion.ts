import {
  Table, Column, Model, DataType,
  ForeignKey, BelongsTo
} from 'sequelize-typescript'
import SolicitudTramites from './solicitudTramites'

@Table({ tableName: 'Programacion' })
class Programacion extends Model {

  @Column({ 
    type: DataType.DATEONLY,
    allowNull: true
  })
  declare fechaRealizacionDiligencia: Date | null

  @Column({ 
    type: DataType.DATE,
    allowNull: true
  })
  declare fechaProbableEntrega: Date | null

  @Column({ 
    type: DataType.DATE,
    allowNull: true
  })
  declare fechaFinalizacionServicio: Date | null

  @Column({
    type: DataType.DECIMAL(12,2),
    allowNull: true
  })
  declare valorTramite: number | null

  @Column({
    type: DataType.DECIMAL(12,2),
    allowNull: true
  })
  declare valorViaticos: number | null

  
  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  declare conceptoHonorarios: string | null
  
  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  declare conceptoViaticos: string | null

  @Column({
  type: DataType.BOOLEAN,
  defaultValue: false
})
declare requiereCita: boolean

@Column({
  type: DataType.DATEONLY,
  allowNull: true
})
declare fechaCita: Date | null

@Column({
  type: DataType.TIME,
  allowNull: true
})
declare horaCita: string | null

  @ForeignKey(() => SolicitudTramites)
  @Column({ unique: true,field: 'solicitudTramiteId'  })
  declare solicitudTramiteId: number

  @BelongsTo(() => SolicitudTramites,{
    foreignKey: 'solicitudTramiteId'
  })
  declare solicitudTramite: SolicitudTramites
}

export default Programacion
