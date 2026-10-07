import { Table, Column, DataType, Model, AllowNull, Default, Unique, ForeignKey, BelongsTo, HasMany } from 'sequelize-typescript'
import Operaciones from '../operaciones'
import Usuarios from '../usuarios'
import Terceros from './terceros'
import Bolsas from './bolsas'
import ClientesEmpresariales from './clientesEmpresariales'
import SolicitudesGasto from './solicitudesGasto'
import DocumentosGasto from './documentosGasto'
import TrazabilidadAnticipos from './trazabilidadAnticipos'

// Anticipo (ingreso) de un cliente del banco para un vehículo o un inmueble.
// La operación lo registra con el soporte de la consignación (POR_CONFIRMAR); Contabilidad
// revisa que el dinero haya entrado y lo confirma con el recibo de caja (CONFIRMADO: suma a la
// bolsa de anticipos y al saldo del cliente) o lo devuelve con novedad (NOVEDAD). Ya confirmado,
// el creador lo convierte en uno o varios gastos no reembolsables que se pagan de esa bolsa.
@Table({
  tableName: 'gastos_anticipos',
  underscored: true
})
class Anticipos extends Model {

  // ANT-2026-000123: es el número de solicitud del anticipo. Se asigna justo después de crear el registro
  @Unique
  @Column({ type: DataType.STRING(20) })
  declare codigo: string

  // VEHICULO | INMUEBLE
  @AllowNull(false)
  @Column({ type: DataType.STRING(20) })
  declare tipo: string

  // POR_CONFIRMAR | NOVEDAD | CONFIRMADO | ANULADO
  @AllowNull(false)
  @Default('POR_CONFIRMAR')
  @Column({ type: DataType.STRING(20) })
  declare estado: string

  // Cliente del banco que consignó (queda como tercero para llevar su saldo)
  @ForeignKey(() => Terceros)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare clienteId: number

  @BelongsTo(() => Terceros)
  declare cliente: Terceros

  @ForeignKey(() => ClientesEmpresariales)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare clienteEmpresarialId: number

  @BelongsTo(() => ClientesEmpresariales)
  declare clienteEmpresarial: ClientesEmpresariales

  @ForeignKey(() => Operaciones)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare operacionId: number

  @BelongsTo(() => Operaciones)
  declare operacion: Operaciones

  // Bolsa de tipo ANTICIPOS donde entra el dinero
  @ForeignKey(() => Bolsas)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare bolsaId: number

  @BelongsTo(() => Bolsas)
  declare bolsa: Bolsas

  @AllowNull(false)
  @Column({ type: DataType.STRING(200) })
  declare concepto: string

  // Vehículo
  @Column({ type: DataType.STRING(20) })
  declare placa: string | null

  // Inmueble
  @Column({ type: DataType.STRING(50) })
  declare matriculaInmobiliaria: string | null

  // Lo que el cliente dice que consignó
  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare valorConsignado: string

  @AllowNull(false)
  @Column({ type: DataType.DATEONLY })
  declare fechaConsignacion: string

  @Column({ type: DataType.TEXT })
  declare observacion: string | null

  // ── Contabilidad ───────────────────────────

  // Lo que de verdad entró al banco (puede diferir del consignado). Es lo que suma a la bolsa
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare valorRecibido: string | null

  @Column({ type: DataType.STRING(50) })
  declare reciboCaja: string | null

  @Column({ type: DataType.TEXT })
  declare observacionContabilidad: string | null

  // Motivo de la última novedad (se conserva en la trazabilidad aunque se corrija)
  @Column({ type: DataType.TEXT })
  declare motivoNovedad: string | null

  @Column({ type: DataType.INTEGER })
  declare confirmadoPor: number | null

  @BelongsTo(() => Usuarios, { foreignKey: 'confirmadoPor', as: 'confirmador' })
  declare confirmador: Usuarios

  @Column({ type: DataType.DATE })
  declare fechaConfirmacion: Date | null

  @Column({ type: DataType.TEXT })
  declare motivoAnulacion: string | null

  // ── Historial ──────────────────────────────

  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare creadoPor: number

  @BelongsTo(() => Usuarios, { foreignKey: 'creadoPor', as: 'creador' })
  declare creador: Usuarios

  @Column({ type: DataType.INTEGER })
  declare actualizadoPor: number | null

  @HasMany(() => TrazabilidadAnticipos)
  declare trazabilidad: TrazabilidadAnticipos[]

  @HasMany(() => DocumentosGasto)
  declare documentos: DocumentosGasto[]

  // Gastos creados a partir del anticipo
  @HasMany(() => SolicitudesGasto)
  declare gastos: SolicitudesGasto[]
}

export default Anticipos
