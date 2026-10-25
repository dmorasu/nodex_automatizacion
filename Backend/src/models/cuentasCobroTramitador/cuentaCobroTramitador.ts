import { Table, Column, DataType, Model, AllowNull, Default, ForeignKey, BelongsTo, HasMany } from 'sequelize-typescript'
import Tramitador from '../tramitador'
import Usuarios from '../usuarios'
import LineaCuentaCobroTramitador from './lineaCuentaCobroTramitador'
import HistorialCuentaCobroTramitador from './historialCuentaCobroTramitador'

// Recorrido de la cuenta: el analista la arma (BORRADOR) y la envía; el tramitador la aprueba o pide
// corrección (POR_CORREGIR vuelve al analista); Torre de control da el visto bueno por semana y pasa
// a Tesorería, que la paga. ANULADA libera sus trámites para otra cuenta.
export const ESTADOS_CUENTA_TRAMITADOR = {
  BORRADOR: 'BORRADOR',
  CON_TRAMITADOR: 'CON_TRAMITADOR',
  POR_CORREGIR: 'POR_CORREGIR',
  APROBADA: 'APROBADA',
  EN_TESORERIA: 'EN_TESORERIA',
  PAGADA: 'PAGADA',
  ANULADA: 'ANULADA'
} as const

export type EstadoCuentaTramitador = typeof ESTADOS_CUENTA_TRAMITADOR[keyof typeof ESTADOS_CUENTA_TRAMITADOR]

// Datos del tramitador con los que se envió la cuenta: el PDF no cambia si después se editan
export type DatosTramitadorCuenta = {
  nombre: string
  identificacion: string
  direccion: string | null
  ciudad: string | null
  correo: string | null
  telefono: string | null
  banco: string | null
  tipoCuenta: string | null
  numeroCuenta: string | null
  declaracionArt383: boolean
}

// Cuenta de cobro de un tramitador (Nodex le da el consecutivo: CCT-0001)
@Table({
  tableName: 'tramitadores_cuentas_cobro',
  underscored: true,
  indexes: [
    { name: 'tramitadores_cuentas_cobro_consecutivo', unique: true, fields: ['consecutivo'] },
    { name: 'tramitadores_cuentas_cobro_tramitador_estado', fields: ['tramitador_id', 'estado'] },
    { name: 'tramitadores_cuentas_cobro_estado_semana', fields: ['estado', 'semana'] }
  ]
})
class CuentaCobroTramitador extends Model {

  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare consecutivo: number

  @ForeignKey(() => Tramitador)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare tramitadorId: number

  @BelongsTo(() => Tramitador)
  declare tramitador: Tramitador

  @AllowNull(false)
  @Default(ESTADOS_CUENTA_TRAMITADOR.BORRADOR)
  @Column({ type: DataType.STRING(20) })
  declare estado: EstadoCuentaTramitador

  // Viernes que cierra la semana (sábado a viernes) en que se finalizaron sus trámites: la precuenta
  // y el visto bueno son por semana
  @AllowNull(false)
  @Column({ type: DataType.DATEONLY })
  declare semana: string

  // Total en centavos (suma de las líneas)
  @AllowNull(false)
  @Default(0)
  @Column({ type: DataType.BIGINT })
  declare total: string

  @Column({ type: DataType.JSONB })
  declare datosTramitador: DatosTramitadorCuenta | null

  @Column({ type: DataType.INTEGER })
  declare creadoPor: number | null

  @BelongsTo(() => Usuarios, { foreignKey: 'creadoPor', as: 'creador', constraints: false })
  declare creador: Usuarios

  @Column({ type: DataType.DATE })
  declare enviadaEn: Date | null

  // Quien la envió al tramitador: recibe el aviso cuando la aprueba o pide corrección
  @Column({ type: DataType.INTEGER })
  declare enviadaPor: number | null

  // Aprobación del tramitador en la app, con la firma que tenía en ese momento (copia en Azure)
  @Column({ type: DataType.DATE })
  declare aprobadaEn: Date | null

  @Column({ type: DataType.STRING(500) })
  declare firmaRuta: string | null

  @Column({ type: DataType.STRING(255) })
  declare firmaNombre: string | null

  // Visto bueno de Torre de control = radicación
  @Column({ type: DataType.INTEGER })
  declare vistoBuenoPor: number | null

  @BelongsTo(() => Usuarios, { foreignKey: 'vistoBuenoPor', as: 'usuarioVistoBueno', constraints: false })
  declare usuarioVistoBueno: Usuarios

  @Column({ type: DataType.DATE })
  declare vistoBuenoEn: Date | null

  @Column({ type: DataType.DATEONLY })
  declare fechaRadicacion: string | null

  // Pago (por ahora Tesorería lo marca a mano; el pago con bolsas se define después)
  @Column({ type: DataType.DATEONLY })
  declare fechaPago: string | null

  @Column({ type: DataType.INTEGER })
  declare pagadaPor: number | null

  @Column({ type: DataType.TEXT })
  declare observacionPago: string | null

  @Column({ type: DataType.STRING(500) })
  declare soportePagoRuta: string | null

  @Column({ type: DataType.STRING(255) })
  declare soportePagoNombre: string | null

  @Column({ type: DataType.STRING(100) })
  declare soportePagoTipo: string | null

  @Column({ type: DataType.TEXT })
  declare motivoAnulacion: string | null

  @HasMany(() => LineaCuentaCobroTramitador)
  declare lineas: LineaCuentaCobroTramitador[]

  @HasMany(() => HistorialCuentaCobroTramitador)
  declare historial: HistorialCuentaCobroTramitador[]
}

export const numeroCuentaTramitador = (consecutivo: number) => `CCT-${String(consecutivo).padStart(4, '0')}`

export default CuentaCobroTramitador
