import { Table, Column, DataType, Model, ForeignKey, BelongsTo, AllowNull, Default, Unique } from 'sequelize-typescript'
import Tramitador from '../tramitador'
import Usuarios from '../usuarios'

// Credenciales del tramitador para la app Nodex Tramitadores.
// Va aparte de "Tramitador" para no afectar sus plantillas ni el cargue masivo.
// El usuario es la identificación del tramitador; la contraseña se guarda cifrada (bcrypt).
@Table({
  tableName: 'tramitadores_acceso',
  underscored: true
})
class AccesoTramitador extends Model {

  @ForeignKey(() => Tramitador)
  @Unique
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare tramitadorId: number

  @BelongsTo(() => Tramitador, { onDelete: 'CASCADE' })
  declare tramitador: Tramitador

  @AllowNull(false)
  @Column({ type: DataType.STRING(100) })
  declare contrasena: string

  // Contraseña temporal entregada por Torre de control: se cambia en el primer ingreso
  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare debeCambiarContrasena: boolean

  // Protección contra intentos de adivinar la contraseña
  @Default(0)
  @Column({ type: DataType.INTEGER })
  declare intentosFallidos: number

  @Column({ type: DataType.DATE })
  declare bloqueadoHasta: Date | null

  // Al restablecer la contraseña sube la versión y se cierran las sesiones abiertas
  @Default(1)
  @Column({ type: DataType.INTEGER })
  declare versionSesion: number

  @Column({ type: DataType.DATE })
  declare ultimoIngreso: Date | null

  @ForeignKey(() => Usuarios)
  @Column({ type: DataType.INTEGER })
  declare creadoPor: number | null
}

export default AccesoTramitador
