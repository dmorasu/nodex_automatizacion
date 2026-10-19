import {Table,ForeignKey,Model,Column,BelongsTo,HasMany, DataType} from 'sequelize-typescript'
import SolicitudTramites from './solicitudTramites'


@Table({
    tableName:'Operaciones'
})

class Operaciones extends Model{

    @Column({
        type: DataType.STRING(100)
    })

    declare nombreOperacion:string

    @Column({
        type: DataType.STRING(10)
    })

    declare centroDeCostos:string

    // Legalización descarga los gastos de esta operación como un solo PDF de pago por gasto
    // (liquidación + soporte de pago). Se marca en Catálogos → Operaciones (hoy: 1301)
    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false
    })
    declare descargaPagoUnificada:boolean


    @HasMany(()=>SolicitudTramites,{
         onUpdate:'CASCADE',
         onDelete:'CASCADE'

      })
     declare solicitudTramites:SolicitudTramites

}


export  default Operaciones