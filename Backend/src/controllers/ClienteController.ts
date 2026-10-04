import type {Request,Response} from 'express'
import Cliente from '../models/clientes'
import { Op,Sequelize } from 'sequelize'
import { db } from '../config/db'
import * as XLSX from 'xlsx'
 
declare global{
    namespace Express{
        interface Request{
            cliente?:Cliente
        }
    }
}

export class ClienteController{


    static getAll =async(req:Request, res:Response)=>{
        try {
                const cliente=await Cliente.findAll({
                    order:[
                        ['createdAt','DESC']
                    ],
                })
                res.json(cliente)
        } catch (error) {
            console.log(error);
            res.status(500).json({error:'Error al consultar todos los clientes'})
            
        }
    }

    static search = async (req: Request, res: Response) => {
    try {
      const search = req.query.search?.toString().trim() || '';
      const limit = Number(req.query.limit) || 20;

      if (search.length < 2) {
        return res.json([]);
      }

      const clientes = await Cliente.findAll({
        where: {
          nombreCliente: {
            [Op.iLike]: `%${search}%`
          }
        },
        order: [
          // Primero los que empiezan por el texto buscado (escapado para evitar inyección SQL)
        [Sequelize.literal(`"nombreCliente" ILIKE ${db.escape(`${search}%`)}`), 'DESC'],
          ['nombreCliente', 'ASC']
        ],
        limit
      });

      res.json(clientes);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error buscando clientes' });
    }
  }

    static create  =async(req:Request,res:Response)=>{
        try {
                const cliente= new Cliente(req.body)
                await cliente.save()
                res.status(201).json('Cliente almacenado correctamente')

        } catch (error) {
            res.status(500).json({error:"No se pudo almacenar el cliente"})
            //console.log(error);
            
            
        }
    }

    static getById =  async (req:Request,res:Response)=>{
        res.json(req.cliente)
    }

    static updateById =async (req:Request,res:Response)=>{
        await req.cliente.update(req.body)
        res.json('Cliente Actualizado')
    }

    static deleteById =async(req:Request,res:Response)=>{
        await req.cliente.destroy()
        res.json('Cliente Eliminado')
    }

}
export const generarPlantillaClientes = async (req: Request, res: Response) => {

  const dataClientes = [{
    nombreCliente: '',
    identificacionCliente: '',
    telefono: '',
    telefonoMovil: ''
  }]

  const wb = XLSX.utils.book_new()

  const sheet = XLSX.utils.json_to_sheet(dataClientes)

  XLSX.utils.book_append_sheet(wb, sheet, 'Clientes')

  const buffer = XLSX.write(wb, {
    type: 'buffer',
    bookType: 'xlsx'
  })

  res.setHeader(
    'Content-Disposition',
    'attachment; filename=plantilla_clientes.xlsx'
  )

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )

  res.send(buffer)
}
export const validarClientesExcel = async (req: Request, res: Response) => {

  if (!req.file) {
    return res.status(400).json({
      message: "Debe subir un archivo Excel",
      totalProcesados: 0,
      errores: []
    })
  }

  try {

    const workbook = XLSX.read(req.file.buffer, {
      cellDates: true
    })

    const sheet = workbook.Sheets[workbook.SheetNames[0]]

    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false })

    const errores: any[] = []

    for (const [index, row] of rows.entries()) {

      const filaExcel = index + 2

      if (!row.nombreCliente || row.nombreCliente.toString().trim() === '') {
        errores.push({ fila: filaExcel, error: 'nombreCliente es obligatorio' })
      }

      if (!row.identificacionCliente || row.identificacionCliente.toString().trim() === '') {
        errores.push({ fila: filaExcel, error: 'identificacionCliente es obligatorio' })
      }

      // Validar duplicado en BD
      const existe = await Cliente.findOne({
        where: { identificacionCliente: row.identificacionCliente }
      })

      if (existe) {
        errores.push({
          fila: filaExcel,
          error: 'identificacionCliente ya existe en base de datos'
        })
      }
    }

    return res.json({
      totalProcesados: rows.length,
      errores
    })

  } catch (error) {
    return res.status(500).json({
      message: "Error leyendo archivo Excel",
      totalProcesados: 0,
      errores: []
    })
  }
}
export const cargaMasivaClientes = async (req: Request, res: Response) => {

  if (!req.file) {
    return res.status(400).json({
      message: "Debe subir un archivo Excel",
      totalProcesados: 0,
      creados: [],
      errores: []
    })
  }

  try {

    const workbook = XLSX.read(req.file.buffer, {
      cellDates: true
    })

    const sheet = workbook.Sheets[workbook.SheetNames[0]]

    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false })

    const creados: number[] = []
    const errores: any[] = []

    for (const [index, row] of rows.entries()) {

      const filaExcel = index + 2

      try {

        if (!row.nombreCliente || !row.identificacionCliente) {
          errores.push({
            fila: filaExcel,
            error: "nombreCliente e identificacionCliente son obligatorios"
          })
          continue
        }

        const existe = await Cliente.findOne({
          where: { identificacionCliente: row.identificacionCliente }
        })

        if (existe) {
          errores.push({
            fila: filaExcel,
            error: "identificacionCliente ya existe"
          })
          continue
        }

        await Cliente.create({
          nombreCliente: row.nombreCliente.toString().trim(),
          identificacionCliente: row.identificacionCliente.toString().trim(),
          telefono: row.telefono?.toString().trim() || null,
          telefonoMovil: row.telefonoMovil?.toString().trim() || null
        })

        creados.push(filaExcel)

      } catch (err: any) {
        errores.push({
          fila: filaExcel,
          error: err.message
        })
      }
    }

    return res.json({
      message: "Carga masiva de clientes finalizada",
      totalProcesados: rows.length,
      creados,
      errores
    })

  } catch (error) {
    return res.status(500).json({
      message: "Error procesando archivo Excel",
      totalProcesados: 0,
      creados: [],
      errores: []
    })
  }
}
