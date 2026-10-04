import { Table, Column, DataType, Model, AllowNull, ForeignKey, BelongsTo } from 'sequelize-typescript'
import Usuarios from '../usuarios'
import Bolsas from './bolsas'
import SolicitudesGasto from './solicitudesGasto'
import LotesPago from './lotesPago'

// Libro de la bolsa: cada entrada o salida de dinero es un registro.
// Nunca se edita ni se borra; las correcciones son movimientos nuevos (REVERSO / AJUSTE).
@Table({
  tableName: 'gastos_movimientos_bolsa',
  underscored: true,
  updatedAt: false
})
class MovimientosBolsa extends Model {

  @ForeignKey(() => Bolsas)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare bolsaId: number

  @BelongsTo(() => Bolsas)
  declare bolsa: Bolsas

  // RECARGA | PAGO | REINTEGRO | LEGALIZACION | REVERSO | AJUSTE
  @AllowNull(false)
  @Column({ type: DataType.STRING(20) })
  declare tipo: string

  // Positivo entra, negativo sale
  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare valor: string

  // Saldo de la bolsa justo después de este movimiento
  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare saldoResultante: string

  @ForeignKey(() => SolicitudesGasto)
  @Column({ type: DataType.INTEGER })
  declare solicitudGastoId: number

  @BelongsTo(() => SolicitudesGasto)
  declare solicitudGasto: SolicitudesGasto

  @ForeignKey(() => LotesPago)
  @Column({ type: DataType.INTEGER })
  declare lotePagoId: number

  @BelongsTo(() => LotesPago)
  declare lotePago: LotesPago

  // Las tablas de cuentas de cobro y reintegros se crean en la fase 5
  @Column({ type: DataType.INTEGER })
  declare cuentaCobroId: number

  @Column({ type: DataType.INTEGER })
  declare reintegroId: number

  @ForeignKey(() => Usuarios)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare usuarioId: number

  @BelongsTo(() => Usuarios)
  declare usuario: Usuarios

  @Column({ type: DataType.TEXT })
  declare observacion: string
}

export default MovimientosBolsa
