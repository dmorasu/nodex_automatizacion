import { Op, QueryTypes } from 'sequelize'
import { db } from '../../config/db'
import TiposGasto from '../../models/gastos/tiposGasto'
import FormasPago from '../../models/gastos/formasPago'
import TiposDocumentoGasto from '../../models/gastos/tiposDocumentoGasto'
import ClientesEmpresariales from '../../models/gastos/clientesEmpresariales'
import { TIPOS_DOCUMENTO } from './constantes'
import { ErrorGastos } from './errores'

// =====================================
// CATÁLOGOS DE NODEX GASTOS (solo Administrador)
// Se crean, se renombran y se activan o desactivan. Solo se elimina lo que no se usa.
// · Tipos de gasto: no se crean ni se eliminan (la lógica depende de sus códigos:
//   vehículo, inmueble, CTL, Cámara de Comercio…); solo se renombran o se desactivan.
// · Tipos de documento que usa el sistema (soporte de pago, factura…): no se desactivan
//   ni se eliminan.
// · Tipos de documento: además dicen para qué servicio se suben (pago, legalización, reintegro).
// El código de los registros nuevos sale del nombre (lo usa la lógica, no la pantalla).
// =====================================

type Registro = { id: number, codigo?: string, nombre: string, activo: boolean }

type Catalogo = {
  modelo: typeof TiposGasto | typeof FormasPago | typeof TiposDocumentoGasto | typeof ClientesEmpresariales
  // Los clientes empresariales no tienen código
  conCodigo: boolean
  permiteCrear: boolean
  // Columna que lo usa: cuántos registros dependen de cada uno
  uso: { tabla: string, columna: string }
  // Códigos que la lógica necesita: no se desactivan ni se eliminan
  delSistema: string[]
  // Tipos de documento: para qué servicio se sube cada uno
  conUsos?: boolean
}

const USOS = ['paraPago', 'paraLegalizacion', 'paraReintegro'] as const
type DatosRegistro = { nombre?: string, activo?: boolean } & Partial<Record<typeof USOS[number], boolean>>

export const CATALOGOS: Record<string, Catalogo> = {
  clientesEmpresariales: {
    modelo: ClientesEmpresariales,
    conCodigo: false,
    permiteCrear: true,
    uso: { tabla: 'gastos_anticipos', columna: 'cliente_empresarial_id' },
    delSistema: []
  },
  tiposGasto: {
    modelo: TiposGasto,
    conCodigo: true,
    permiteCrear: false,
    uso: { tabla: 'gastos_solicitudes', columna: 'tipo_gasto_id' },
    // Se pueden desactivar (dejan de salir al crear gastos), no eliminar
    delSistema: []
  },
  formasPago: {
    modelo: FormasPago,
    conCodigo: true,
    permiteCrear: true,
    uso: { tabla: 'gastos_solicitudes', columna: 'forma_pago_id' },
    delSistema: []
  },
  tiposDocumento: {
    modelo: TiposDocumentoGasto,
    conCodigo: true,
    permiteCrear: true,
    uso: { tabla: 'gastos_documentos', columna: 'tipo_documento_id' },
    // FACTURA y OTRO los usa la app de tramitadores
    delSistema: [...Object.values(TIPOS_DOCUMENTO), 'FACTURA', 'OTRO'],
    conUsos: true
  }
}

export type NombreCatalogo = keyof typeof CATALOGOS

const catalogo = (nombre: string) => {
  const config = CATALOGOS[nombre]
  if (!config) throw new ErrorGastos('Catálogo no válido', 404)
  return config
}

// Los tipos de gasto no se eliminan nunca (la lógica los busca por código)
const esDelSistema = (config: Catalogo, registro: Registro) =>
  config.modelo === TiposGasto || (registro.codigo ? config.delSistema.includes(registro.codigo) : false)

// "Tarjeta débito" → "TARJETA_DEBITO"
const codigoDesde = (nombre: string) =>
  nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50)

const modelo = (config: Catalogo) => config.modelo as unknown as {
  findAll: (opciones: object) => Promise<(Registro & { toJSON: () => Registro })[]>
  findOne: (opciones: object) => Promise<Registro | null>
  findByPk: (id: number) => Promise<(Registro & { update: (datos: object) => Promise<unknown>, destroy: () => Promise<void> }) | null>
  create: (datos: object) => Promise<Registro>
}

const usos = async (config: Catalogo) => {
  const filas = await db.query<{ id: number, cantidad: string }>(
    `SELECT ${config.uso.columna} AS id, COUNT(*) AS cantidad FROM ${config.uso.tabla} WHERE ${config.uso.columna} IS NOT NULL GROUP BY 1`,
    { type: QueryTypes.SELECT }
  )
  return new Map(filas.map(f => [Number(f.id), Number(f.cantidad)]))
}

export const listarCatalogo = async (nombre: string) => {
  const config = catalogo(nombre)
  const [registros, uso] = await Promise.all([
    modelo(config).findAll({
      attributes: ['id', ...(config.conCodigo ? ['codigo'] : []), 'nombre', 'activo', ...(config.conUsos ? USOS : [])],
      order: [['activo', 'DESC'], ['nombre', 'ASC']]
    }),
    usos(config)
  ])
  return {
    permiteCrear: config.permiteCrear,
    registros: registros.map(r => ({
      ...r.toJSON(),
      uso: uso.get(r.id) ?? 0,
      delSistema: esDelSistema(config, r)
    }))
  }
}

const nombreRepetido = async (config: Catalogo, nombre: string, excepto?: number) => {
  const existente = await modelo(config).findOne({
    where: { nombre: { [Op.iLike]: nombre }, ...(excepto ? { id: { [Op.ne]: excepto } } : {}) }
  })
  if (existente) throw new ErrorGastos(`Ya existe ${existente.nombre}`, 409)
}

export const crearEnCatalogo = async (nombre: string, datos: { nombre: string }) => {
  const config = catalogo(nombre)
  if (!config.permiteCrear) throw new ErrorGastos('En este catálogo no se crean registros nuevos: la lógica depende de ellos')

  const texto = datos.nombre.trim()
  await nombreRepetido(config, texto)

  let codigo: string | undefined
  if (config.conCodigo) {
    codigo = codigoDesde(texto)
    if (!codigo) throw new ErrorGastos('El nombre debe tener letras o números')
    // Si el código ya existe (otro nombre que da el mismo), se le agrega un número
    for (let i = 2; await modelo(config).findOne({ where: { codigo } }); i++) codigo = `${codigoDesde(texto).slice(0, 46)}_${i}`
  }

  const registro = await modelo(config).create({ nombre: texto, ...(codigo ? { codigo } : {}), activo: true })
  return registro.id
}

export const actualizarEnCatalogo = async (nombre: string, id: number, datos: DatosRegistro) => {
  const config = catalogo(nombre)
  const registro = await modelo(config).findByPk(id)
  if (!registro) throw new ErrorGastos('El registro no existe', 404)

  const texto = datos.nombre?.trim()
  if (texto) await nombreRepetido(config, texto, id)
  if (datos.activo === false && config.modelo !== TiposGasto && esDelSistema(config, registro)) {
    throw new ErrorGastos(`${registro.nombre} lo usa el sistema: no se puede desactivar`)
  }

  await registro.update({
    ...(texto ? { nombre: texto } : {}),
    ...(datos.activo !== undefined ? { activo: datos.activo } : {}),
    ...(config.conUsos ? Object.fromEntries(USOS.filter(uso => datos[uso] !== undefined).map(uso => [uso, datos[uso]])) : {})
  })
}

export const eliminarDeCatalogo = async (nombre: string, id: number) => {
  const config = catalogo(nombre)
  const registro = await modelo(config).findByPk(id)
  if (!registro) throw new ErrorGastos('El registro no existe', 404)
  if (esDelSistema(config, registro)) throw new ErrorGastos(`${registro.nombre} lo usa el sistema: no se puede eliminar`)

  const cantidad = (await usos(config)).get(id) ?? 0
  if (cantidad) throw new ErrorGastos(`${registro.nombre} está en uso (${cantidad}): desactívelo en lugar de eliminarlo`)

  await registro.destroy()
}
