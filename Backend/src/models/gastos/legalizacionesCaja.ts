import { Table, Column, DataType, Model, AllowNull, ForeignKey, BelongsTo, Unique } from 'sequelize-typescript'
import Usuarios from '../usuarios'
import Bolsas from './bolsas'
import SolicitudesGasto from './solicitudesGasto'
import ReembolsosCaja from './reembolsosCaja'

// Legalización de un gasto pagado por caja menor: Tesorería registra la factura que trajo quien
// recibió el efectivo (con su soporte obligatorio). Si el valor del soporte es distinto al
// entregado, la diferencia vuelve a la caja (o sale de ella) en ese momento.
@Table({
  tableName: 'gastos_legalizaciones_caja',
  underscored: true
})
class LegalizacionesCaja extends Model {

  @Unique
  @ForeignKey(() => SolicitudesGasto)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare solicitudGastoId: number

  @BelongsTo(() => SolicitudesGasto)
  declare solicitudGasto: SolicitudesGasto

  @ForeignKey(() => Bolsas)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare bolsaId: number

  @BelongsTo(() => Bolsas)
  declare bolsa: Bolsas

  @AllowNull(false)
  @Column({ type: DataType.STRING(50) })
  declare numeroFactura: string

  @AllowNull(false)
  @Column({ type: DataType.DATEONLY })
  declare fechaFactura: string

  // Beneficiario de la factura
  @AllowNull(false)
  @Column({ type: DataType.STRING(200) })
  declare beneficiario: string

  // CC | NIT
  @AllowNull(false)
  @Column({ type: DataType.STRING(10) })
  declare tipoIdentificacion: string

  @AllowNull(false)
  @Column({ type: DataType.STRING(30) })
  declare identificacion: string

  @Column({ type: DataType.STRING(20) })
  declare placa: string | null

  @Column({ type: DataType.STRING(50) })
  declare matriculaInmobiliaria: string | null

  // Nombre de quien trae la factura (puede ser un mensajero: no es un usuario de Nodex)
  @AllowNull(false)
  @Column({ type: DataType.STRING(150) })
  declare quienLegaliza: string

  // Lo que dice el soporte (lo que se reembolsa)
  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare valorSoporte: string

  // Soporte − entregado: negativo = devolvió efectivo a la caja; positivo = la caja pagó la diferencia
  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare diferencia: string

  @Column({ type: DataType.TEXT })
  declare observacion: string | null

  @ForeignKey(() => ReembolsosCaja)
  @Column({ type: DataType.INTEGER })
  declare reembolsoCajaId: number | null

  @BelongsTo(() => ReembolsosCaja)
  declare reembolso: ReembolsosCaja

  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare registradoPor: number

  @BelongsTo(() => Usuarios, { foreignKey: 'registradoPor', as: 'registrador' })
  declare registrador: Usuarios
}

export default LegalizacionesCaja
