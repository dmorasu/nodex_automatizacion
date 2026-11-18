import { Table, Column, DataType, Model, AllowNull, ForeignKey, BelongsTo } from 'sequelize-typescript'
import FacturasGasto from './facturasGasto'

// Cada factura con que Legalización legaliza un gasto (pedido del usuario, 2026-11-18: a veces son
// varias, hasta 4). La factura del gasto (gastos_facturas) sigue siendo una y guarda el total, que
// es con lo que se calcula el 4x1000, el reintegro y la cuenta de cobro; aquí queda el detalle.
// Las facturas registradas antes no tienen filas: su detalle es la misma factura del gasto.
@Table({
  tableName: 'gastos_facturas_detalle',
  underscored: true,
  indexes: [{ name: 'gastos_facturas_detalle_factura', fields: ['factura_id'] }]
})
class FacturasDetalleGasto extends Model {

  @ForeignKey(() => FacturasGasto)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, onDelete: 'CASCADE' })
  declare facturaId: number

  @BelongsTo(() => FacturasGasto, { onDelete: 'CASCADE' })
  declare factura: FacturasGasto

  // Orden en que se registraron (1 a 4)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare orden: number

  @Column({ type: DataType.STRING(50) })
  declare numeroFactura: string | null

  @Column({ type: DataType.STRING(30) })
  declare identificacionTercero: string | null

  @Column({ type: DataType.STRING(200) })
  declare nombreTercero: string | null

  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare valor: string
}

export default FacturasDetalleGasto
