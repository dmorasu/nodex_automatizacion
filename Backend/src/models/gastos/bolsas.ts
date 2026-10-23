import { Table, Column, DataType, Model, AllowNull, Default } from 'sequelize-typescript'

// Fondo por línea de negocio desde el que se pagan los gastos.
// El saldo se mueve SOLO con registros en movimientos de bolsa (fase 4);
// saldoActual es la copia del saldo que se actualiza en la misma transacción.
@Table({
  tableName: 'gastos_bolsas',
  underscored: true
})
class Bolsas extends Model {

  @AllowNull(false)
  @Column({ type: DataType.STRING(100) })
  declare nombre: string

  @Column({ type: DataType.STRING(100) })
  declare lineaNegocio: string

  // GENERAL | ANTICIPOS | FACTURAS | CAJA_MENOR (constantes TIPOS_BOLSA). La de anticipos se llena
  // con los pagos de los clientes y lleva el saldo de cada uno en sus movimientos (clienteId)
  @AllowNull(false)
  @Default('GENERAL')
  @Column({ type: DataType.STRING(20) })
  declare tipo: string

  @AllowNull(false)
  @Default(0)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare saldoActual: string

  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare activo: boolean

  // Bolsa general que paga sin tener dinero (el saldo puede quedar negativo): solo gastos no
  // reembolsables, para llevar el total de lo que asume la empresa sin recargarla
  @AllowNull(false)
  @Default(false)
  @Column({ type: DataType.BOOLEAN })
  declare sinSaldo: boolean

  // ── Solo cajas menores (tipo CAJA_MENOR) ──

  // Fondo fijo asignado: saldo + pagado sin legalizar + pendiente por reembolsar debe dar este valor
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare fondoAsignado: string | null

  // Si el disponible baja de este valor se avisa a Tesorería (una vez, hasta que se reponga)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare topeAlerta: string | null

  @Default(false)
  @Column({ type: DataType.BOOLEAN })
  declare alertaTopeEnviada: boolean
}

export default Bolsas
