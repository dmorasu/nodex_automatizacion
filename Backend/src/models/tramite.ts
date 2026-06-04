// models/tramite.ts
import {Table,Column,Model,HasMany,DataType} from 'sequelize-typescript'
import SolicitudTramites from './solicitudTramites'
import SubEstados from './subEstados';

@Table({ tableName:'Tramites' })
class Tramite extends Model {

  @Column({ type:DataType.STRING(150) })
  declare nombreTramite:string

  @Column({ type:DataType.STRING(150) })
  declare responsable:string

  @HasMany(()=>SolicitudTramites)
  declare solicitudes: SolicitudTramites[]
  
  @HasMany(() => SubEstados)
declare subEstados: SubEstados[];
}

export default Tramite
