// models/tramite.ts
import {Table,Column,Model,HasMany,DataType,Default} from 'sequelize-typescript'
import SolicitudTramites from './solicitudTramites'
import SubEstados from './subEstados';

@Table({ tableName:'Tramites' })
class Tramite extends Model {

  @Column({ type:DataType.STRING(150) })
  declare nombreTramite:string

  @Column({ type:DataType.STRING(150) })
  declare responsable:string

  // Inactivo: no se ofrece para trámites nuevos; los que ya lo tienen siguen igual
  // (lo agrega ajustarEsquemaTramites → tiposDeTramiteActivos)
  @Default(true)
  @Column({ type:DataType.BOOLEAN, allowNull:false })
  declare activo:boolean

  @HasMany(()=>SolicitudTramites)
  declare solicitudes: SolicitudTramites[]
  
  @HasMany(() => SubEstados)
declare subEstados: SubEstados[];
}

export default Tramite
