import { Table, Column, DataType, Model, ForeignKey, BelongsTo, AllowNull } from 'sequelize-typescript'
import SoporteTramitador from './soporteTramitador'

// Archivo (en Azure File Share) de un soporte subido por el tramitador
@Table({
  tableName: 'tramitadores_soportes_archivos',
  underscored: true
})
class ArchivoSoporte extends Model {

  @ForeignKey(() => SoporteTramitador)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare soporteId: number

  @BelongsTo(() => SoporteTramitador, { onDelete: 'CASCADE' })
  declare soporte: SoporteTramitador

  @AllowNull(false)
  @Column({ type: DataType.STRING(255) })
  declare nombreOriginal: string

  // Nombre con el que quedó guardado en Azure
  @AllowNull(false)
  @Column({ type: DataType.STRING(255) })
  declare nombreArchivo: string

  @AllowNull(false)
  @Column({ type: DataType.STRING(500) })
  declare rutaDirectorio: string

  @AllowNull(false)
  @Column({ type: DataType.STRING(100) })
  declare tipoArchivo: string

  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare tamano: number
}

export default ArchivoSoporte
