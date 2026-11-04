import { Table, Column, DataType, Model, AllowNull, Default } from 'sequelize-typescript'

// Oficina desde la que salen los mensajeros (ej: Medellín, Bogotá). La ruta del día
// arranca y termina aquí.
@Table({
  tableName: 'mensajeria_sedes',
  underscored: true
})
class SedeMensajeria extends Model {

  @AllowNull(false)
  @Column({ type: DataType.STRING(100) })
  declare nombre: string

  @AllowNull(false)
  @Column({ type: DataType.STRING(300) })
  declare direccion: string

  @Column({ type: DataType.DOUBLE })
  declare latitud: number | null

  @Column({ type: DataType.DOUBLE })
  declare longitud: number | null

  @AllowNull(false)
  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare activo: boolean

  // Oficina GPA en el rótulo de envío y en el Directorio (2026-11-04). Columnas agregadas en
  // ajustarEsquemaTramitadores
  @Column({ type: DataType.STRING(100) })
  declare ciudad: string | null

  @Column({ type: DataType.STRING(20) })
  declare celular: string | null

  @Column({ type: DataType.STRING(300) })
  declare horario: string | null
}

export default SedeMensajeria
