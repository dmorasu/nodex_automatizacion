import { Table, Column, DataType, Model, AllowNull, Default, ForeignKey, BelongsTo } from 'sequelize-typescript'
import Tramitador from '../tramitador'
import Usuarios from '../usuarios'
import SolicitudTramites from '../solicitudTramites'

// ACTIVA aparta el espacio; CERRADA = ya se programó la cita del trámite reservado;
// CANCELADA = la quitó quien la creó o Torre de control
export const ESTADOS_RESERVA = {
  ACTIVA: 'ACTIVA',
  CERRADA: 'CERRADA',
  CANCELADA: 'CANCELADA'
} as const

export type EstadoReserva = typeof ESTADOS_RESERVA[keyof typeof ESTADOS_RESERVA]

// RESERVA = espacio apartado para una diligencia sin cita (Gestión de activos o Torre de control);
// NO_DISPONIBLE = el mensajero no puede atender (permiso, incapacidad...), solo Torre de control
export const TIPOS_RESERVA = {
  RESERVA: 'RESERVA',
  NO_DISPONIBLE: 'NO_DISPONIBLE'
} as const

export type TipoReserva = typeof TIPOS_RESERVA[keyof typeof TIPOS_RESERVA]

// Motivos de "No disponible" (decisión del usuario); con "Otro" se escribe el motivo
export const MOTIVOS_NO_DISPONIBLE = ['Permiso', 'Incapacidad', 'Mantenimiento de la moto', 'Capacitación'] as const

// Día completo: se guarda de 00:00 a 23:59 para que choque con cualquier cita o reserva del día
export const HORA_INICIO_DIA = '00:00'
export const HORA_FIN_DIA = '23:59'

// Espacio apartado en la agenda de un mensajero. No cambia nada del mensajero ni de sus trámites.
@Table({
  tableName: 'mensajeria_reservas',
  underscored: true,
  indexes: [{ name: 'mensajeria_reservas_tramitador_fecha', fields: ['tramitador_id', 'fecha', 'estado'] }]
})
class ReservaAgenda extends Model {

  @ForeignKey(() => Tramitador)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare tramitadorId: number

  @BelongsTo(() => Tramitador)
  declare tramitador: Tramitador

  @AllowNull(false)
  @Column({ type: DataType.DATEONLY })
  declare fecha: string

  @AllowNull(false)
  @Column({ type: DataType.TIME })
  declare horaInicio: string

  @AllowNull(false)
  @Column({ type: DataType.TIME })
  declare horaFin: string

  @AllowNull(false)
  @Column({ type: DataType.STRING(300) })
  declare motivo: string

  @AllowNull(false)
  @Default(TIPOS_RESERVA.RESERVA)
  @Column({ type: DataType.STRING(20) })
  declare tipo: TipoReserva

  @AllowNull(false)
  @Default(false)
  @Column({ type: DataType.BOOLEAN })
  declare diaCompleto: boolean

  // Opcional: al programar la cita de este trámite la reserva se cierra sola
  @ForeignKey(() => SolicitudTramites)
  @Column({ type: DataType.INTEGER, onDelete: 'SET NULL' })
  declare solicitudTramiteId: number | null

  @AllowNull(false)
  @Default(ESTADOS_RESERVA.ACTIVA)
  @Column({ type: DataType.STRING(20) })
  declare estado: EstadoReserva

  @ForeignKey(() => Usuarios)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare creadaPor: number

  @BelongsTo(() => Usuarios, 'creadaPor')
  declare creador: Usuarios

  @Column({ type: DataType.DATE })
  declare cerradaEn: Date | null

  @Column({ type: DataType.INTEGER })
  declare canceladaPor: number | null

  @Column({ type: DataType.DATE })
  declare canceladaEn: Date | null
}

export default ReservaAgenda
