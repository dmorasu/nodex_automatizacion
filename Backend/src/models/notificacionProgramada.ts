import { Table, Column, DataType, Model, Unique, AllowNull, Default } from 'sequelize-typescript'

// Configuración de las notificaciones automáticas de WhatsApp (diligencias de hoy y
// vencidas). Torre de control cambia la hora, los días y si están activas sin tocar código.
@Table({
  tableName: 'notificaciones_programadas',
  underscored: true
})
class NotificacionProgramada extends Model {

  // DILIGENCIA_HOY | DILIGENCIA_VENCIDA
  @Unique
  @AllowNull(false)
  @Column({ type: DataType.STRING(50) })
  declare clave: string

  // "HH:MM" en hora de Colombia
  @AllowNull(false)
  @Column({ type: DataType.STRING(5) })
  declare hora: string

  // Días de la semana en que se envía: 0 = domingo … 6 = sábado (como en cron)
  @AllowNull(false)
  @Column({ type: DataType.ARRAY(DataType.INTEGER) })
  declare dias: number[]

  @AllowNull(false)
  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare activa: boolean

  // Nombre de quien hizo el último cambio de configuración
  @Column({ type: DataType.STRING(150) })
  declare actualizadoPor: string | null

  @Column({ type: DataType.DATE })
  declare ultimaEjecucion: Date | null

  // PROGRAMADA (la lanzó el reloj) | MANUAL (botón "Enviar ahora")
  @Column({ type: DataType.STRING(20) })
  declare ultimoOrigen: string | null

  // Quién pulsó "Enviar ahora" (vacío si fue programada)
  @Column({ type: DataType.STRING(150) })
  declare ultimoEjecutadoPor: string | null

  // { encontradas, enviadas, sinTelefono, errores } o { error } si la consulta falló
  @Column({ type: DataType.JSONB })
  declare ultimoResultado: Record<string, unknown> | null
}

export default NotificacionProgramada
