import { Table, Column, DataType, HasMany, HasOne, Model, ForeignKey, BelongsTo } from 'sequelize-typescript'
import SolicitudTramites from './solicitudTramites'
import AccesoTramitador from './tramitadores/accesoTramitador'
import SedeMensajeria from './mensajeria/sedeMensajeria'
import Municipios from './municipios'
import CoberturaTramitador from './tramitadores/coberturaTramitador'

@Table({
  tableName: 'Tramitador'
})
class Tramitador extends Model {

  @Column({
    type: DataType.STRING(200),
    allowNull: false
  })
  declare nombreTramitador: string

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    unique: true
  })
  declare identificacion: string

  @Column({
    type: DataType.STRING(150),
    allowNull: false
  })
  declare correoTramitador: string

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true
  })
  declare activo: boolean

  @Column({
    type: DataType.STRING(100)
  })
  declare region: string

  @Column({
    type: DataType.STRING(20)
  })
  declare numeroTramitador: string

  // Mensajero: tiene ruta diaria (mapa en Torre de control y "Mi ruta" en su app)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false
  })
  declare esMensajero: boolean

  // Oficina de la que sale su ruta
  @ForeignKey(() => SedeMensajeria)
  @Column({ type: DataType.INTEGER })
  declare sedeId: number | null

  @BelongsTo(() => SedeMensajeria)
  declare sede: SedeMensajeria

  // ── Datos de la cuenta de cobro (2026-10-25): los llena Torre de control y salen en el PDF.
  // Columnas agregadas en ajustarEsquemaTramitadores (antes de sync). ──

  @Column({ type: DataType.STRING(200) })
  declare direccion: string | null

  // Encabezado de la cuenta de cobro ("Bucaramanga, 09 de octubre de 2026")
  @Column({ type: DataType.STRING(100) })
  declare ciudad: string | null

  // Banco o billetera (Bancolombia, Nequi, Daviplata…)
  @Column({ type: DataType.STRING(100) })
  declare banco: string | null

  // AHORROS | CORRIENTE | BILLETERA
  @Column({ type: DataType.STRING(20) })
  declare tipoCuenta: string | null

  @Column({ type: DataType.STRING(50) })
  declare numeroCuenta: string | null

  // Firmó la declaración del art. 383 del Estatuto Tributario (retención por la tabla de asalariados).
  // Con declaración, la nota de juramento sale en el PDF; sin ella, no.
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare declaracionArt383: boolean

  // Firma que el tramitador dibuja en la app (PNG en Azure); va en el PDF de cada cuenta que aprueba
  @Column({ type: DataType.STRING(500) })
  declare firmaRuta: string | null

  @Column({ type: DataType.STRING(255) })
  declare firmaNombre: string | null

  // ── Directorio de tramitadores (2026-11-04; antes en el Excel de Torre de control).
  // Columnas agregadas en ajustarEsquemaTramitadores (antes de sync). ──

  @Column({ type: DataType.STRING(150) })
  declare correoPersonal: string | null

  // Desde dónde se calcula la distancia al municipio del trámite
  @ForeignKey(() => Municipios)
  @Column({ type: DataType.INTEGER })
  declare municipioResidenciaId: number | null

  @BelongsTo(() => Municipios, { foreignKey: 'municipioResidenciaId', as: 'municipioResidencia' })
  declare municipioResidencia: Municipios

  // Cumpleaños: solo día y mes
  @Column({ type: DataType.SMALLINT })
  declare cumpleDia: number | null

  @Column({ type: DataType.SMALLINT })
  declare cumpleMes: number | null

  // ¿Su cuenta tiene tarjeta amparada por GPA? (datos de pago del directorio)
  @Column({ type: DataType.BOOLEAN })
  declare tarjetaAmparada: boolean | null

  // Cuánto tarda en llegarle una transferencia ("Inmediato", "Mismo día si se paga antes del mediodía"…)
  @Column({ type: DataType.STRING(200) })
  declare tiempoPago: string | null

  // Nota para Torre de control: "Primera opción", "Solo en contingencia, con autorización de Milton"…
  @Column({ type: DataType.STRING(500) })
  declare notaDirectorio: string | null

  @HasMany(() => CoberturaTramitador)
  declare cobertura: CoberturaTramitador[]

  @HasMany(() => SolicitudTramites, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  })
  declare solicitudesTramites: SolicitudTramites[]

  // Acceso a la app Nodex Tramitadores (si se le creó)
  @HasOne(() => AccesoTramitador)
  declare acceso: AccesoTramitador
}

export default Tramitador
