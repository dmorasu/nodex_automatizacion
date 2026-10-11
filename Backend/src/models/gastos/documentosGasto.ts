import { Table, Column, DataType, Model, AllowNull, ForeignKey, BelongsTo } from 'sequelize-typescript'
import Usuarios from '../usuarios'
import SolicitudesGasto from './solicitudesGasto'
import TiposDocumentoGasto from './tiposDocumentoGasto'
import LotesPago from './lotesPago'
import Anticipos from './anticipos'

// Archivos en Azure File Share. Un documento pertenece a UNO de:
// un gasto, un lote de pago, una cuenta de cobro, un reintegro, un anticipo o un reembolso de caja menor.
@Table({
  tableName: 'gastos_documentos',
  underscored: true
})
class DocumentosGasto extends Model {

  @ForeignKey(() => TiposDocumentoGasto)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare tipoDocumentoId: number

  @BelongsTo(() => TiposDocumentoGasto)
  declare tipoDocumento: TiposDocumentoGasto

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

  // Soporte de la consignación del cliente
  @ForeignKey(() => Anticipos)
  @Column({ type: DataType.INTEGER })
  declare anticipoId: number | null

  @BelongsTo(() => Anticipos)
  declare anticipo: Anticipos

  // Las tablas de cuentas de cobro y reintegros se crean en la fase 5;
  // por ahora son columnas sin llave foránea
  @Column({ type: DataType.INTEGER })
  declare cuentaCobroId: number

  @Column({ type: DataType.INTEGER })
  declare reintegroId: number

  // Comprobante del reembolso de caja menor (la llave foránea la crea ajustesEsquemaGastos)
  @Column({ type: DataType.INTEGER })
  declare reembolsoCajaId: number | null

  @AllowNull(false)
  @Column({ type: DataType.STRING(255) })
  declare nombreOriginal: string

  // Nombre con el que quedó guardado en Azure
  @AllowNull(false)
  @Column({ type: DataType.STRING(255) })
  declare nombreArchivo: string

  // Carpeta en Azure (sin el nombre del archivo)
  @AllowNull(false)
  @Column({ type: DataType.STRING(500) })
  declare rutaDirectorio: string

  @AllowNull(false)
  @Column({ type: DataType.STRING(100) })
  declare tipoArchivo: string

  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare tamano: number

  @ForeignKey(() => Usuarios)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare subidoPor: number

  @BelongsTo(() => Usuarios)
  declare usuario: Usuarios
}

export default DocumentosGasto
