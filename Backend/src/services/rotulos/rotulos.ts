import { Op, QueryTypes } from 'sequelize'
import { db } from '../../config/db'
import SolicitudTramites from '../../models/solicitudTramites'
import Clientes from '../../models/clientes'
import Municipios from '../../models/municipios'
import Operaciones from '../../models/operaciones'
import Usuarios from '../../models/usuarios'
import Tramite from '../../models/tramite'
import Tramitador from '../../models/tramitador'
import SedeMensajeria from '../../models/mensajeria/sedeMensajeria'
import Transportadora from '../../models/trasnportadora'
import Logistica from '../../models/logistica'
import DocumentoSolicitud from '../../models/documentosSolicitud'
import RotuloEnvio from '../../models/rotulos/rotuloEnvio'
import RotuloTramite from '../../models/rotulos/rotuloTramite'
import { subirArchivo, eliminarArchivo } from '../azureFileStorage'
import { nombreSeguro } from '../../controllers/gastos/DocumentosGastoController'
import { conPrefijo } from '../tramitadores/nombresDocumento'
import { ErrorGastos } from '../gastos/errores'
import {
  armarRotulo, normalizar, DESTINOS, ORIGENES, TIPOS_ENVIO, CONTENIDOS, TRANSPORTADORAS_SUGERIDAS, GPA,
  type EntradaRotulo, type ContextoRotulo, type SedeRotulo, type TramitadorRotulo, type Rotulo, type Origen, type Destino
} from './reglasRotulo'
import { generarPdfRotulo, nombreArchivoRotulo } from './pdfRotulo'

// =====================================
// RÓTULOS DE ENVÍO (Ayudas Torre de Control, fase 3, 2026-11-04)
// Se arman desde el trámite: el PDF queda en los documentos de cada trámite del envío, el
// rótulo en rotulos_envio (con los datos con que se imprimió) y, si se pide, la logística de
// cada trámite toma la transportadora y el destinatario (solo lo que esté vacío).
// =====================================

export const MAXIMO_TRAMITES_ROTULO = 20

// "SAN JOSÉ DE CÚCUTA" → "San José de Cúcuta"
const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'el', 'en'])
export const titulo = (texto: string | null | undefined) =>
  String(texto ?? '').toLowerCase().split(/(\s+)/)
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join('').trim()

const texto = (valor: unknown, maximo = 300) => (typeof valor === 'string' || typeof valor === 'number' ? String(valor).trim().slice(0, maximo) : '')
const numero = (valor: unknown) => (Number.isInteger(Number(valor)) && Number(valor) > 0 ? Number(valor) : null)

// Lo que llega del navegador, ya limpio (tipos y largos)
export const leerEntrada = (cuerpo: Record<string, unknown>): EntradaRotulo => {
  const c = cuerpo ?? {}
  const origen = (ORIGENES as readonly string[]).includes(String(c.origen)) ? c.origen as Origen : 'gpa'
  const destino = (DESTINOS as readonly string[]).includes(String(c.destino)) ? c.destino as Destino : 'cliente'
  const r = (c.remitente ?? {}) as Record<string, unknown>
  const d = (c.destinatario ?? {}) as Record<string, unknown>
  const vistos = new Set<number>()
  const tramites = (Array.isArray(c.tramites) ? c.tramites : [])
    .map(t => ({ id: numero((t as Record<string, unknown>)?.id), placa: texto((t as Record<string, unknown>)?.placa, 60) }))
    .filter((t): t is { id: number, placa: string } => t.id !== null && !vistos.has(t.id) && Boolean(vistos.add(t.id)))
    .slice(0, MAXIMO_TRAMITES_ROTULO)
  return {
    origen, destino, tramites,
    tipo: texto(c.tipo, 100), contenido: texto(c.contenido, 150), detalle: texto(c.detalle, 150),
    operacionId: numero(c.operacionId), solicitante: texto(c.solicitante, 120), transportadora: texto(c.transportadora, 100),
    contraentrega: c.contraentrega === true, asegurado: c.asegurado === true,
    valorDeclarado: Number(c.valorDeclarado) > 0 ? Math.min(Math.round(Number(c.valorDeclarado)), 1e12) : null,
    remitente: { sedeId: numero(r.sedeId), contacto: texto(r.contacto, 120), telefono: texto(r.telefono, 30), tramitadorId: numero(r.tramitadorId) },
    destinatario: {
      sedeId: numero(d.sedeId), tramitadorId: numero(d.tramitadorId), nombre: texto(d.nombre, 200), documento: texto(d.documento, 30),
      contacto: texto(d.contacto, 120), telefono: texto(d.telefono, 30), correo: texto(d.correo, 150), direccion: texto(d.direccion, 250),
      municipioId: numero(d.municipioId)
    },
    observaciones: c.observaciones == null ? null : texto(c.observaciones, 1500),
    tamano: c.tamano === 'carta' || c.tamano === 'peq' ? c.tamano : null
  }
}

// El modelo Transportadora declara sus campos como propiedades de clase, que tapan los de
// Sequelize en la instancia: el nombre se lee con get()
const nombreTransportadora = (t: Transportadora) => String(t.get('nombreTransportadora') ?? '').trim()

const sedesActivas = async (): Promise<SedeRotulo[]> =>
  (await SedeMensajeria.findAll({ where: { activo: true }, order: [['id', 'ASC']] }))
    .map(s => ({ id: s.id, nombre: s.nombre, ciudad: s.ciudad, direccion: s.direccion, celular: s.celular, horario: s.horario }))

const tramitadorParaRotulo = (t: Tramitador): TramitadorRotulo => ({
  id: t.id,
  nombre: String(t.nombreTramitador ?? '').trim(),
  cedula: t.identificacion ? String(t.identificacion).trim() : null,
  celular: t.numeroTramitador ?? null,
  direccion: t.direccion ?? null,
  municipio: t.municipioResidencia ? titulo(t.municipioResidencia.nombreMunicipio) : (t.ciudad ?? null),
  departamento: t.municipioResidencia ? titulo(t.municipioResidencia.departamento) : null,
  correo: t.correoPersonal || t.correoTramitador || null
})

const buscarTramitadores = async (ids: number[]) => {
  if (!ids.length) return new Map<number, TramitadorRotulo>()
  const filas = await Tramitador.findAll({
    where: { id: ids, activo: true },
    include: [{ model: Municipios, as: 'municipioResidencia', attributes: ['nombreMunicipio', 'departamento'] }]
  })
  return new Map(filas.map(t => [t.id, tramitadorParaRotulo(t)]))
}

// Registros que usa el rótulo. Los trámites que no existen se avisan como dato faltante
const cargarContexto = async (e: EntradaRotulo) => {
  const ids = [e.remitente?.tramitadorId, e.destinatario?.tramitadorId].filter((x): x is number => Boolean(x))
  const [sedes, tramitadores, operacion, municipio, existentes] = await Promise.all([
    sedesActivas(),
    buscarTramitadores(ids),
    e.operacionId ? Operaciones.findByPk(e.operacionId, { attributes: ['nombreOperacion', 'centroDeCostos'] }) : null,
    e.destinatario?.municipioId ? Municipios.findByPk(e.destinatario.municipioId, { attributes: ['nombreMunicipio', 'departamento'] }) : null,
    e.tramites.length ? SolicitudTramites.findAll({ where: { id: e.tramites.map(t => t.id) }, attributes: ['id'] }) : []
  ])
  const contexto: ContextoRotulo = {
    sedes, tramitadores,
    operacion: operacion ? { nombre: operacion.nombreOperacion, centroDeCostos: operacion.centroDeCostos } : null,
    municipioDestino: municipio ? { nombre: titulo(municipio.nombreMunicipio), departamento: titulo(municipio.departamento) } : null
  }
  const hay = new Set(existentes.map(t => t.id))
  const noExisten = e.tramites.filter(t => !hay.has(t.id)).map(t => `No existe el trámite #${t.id}`)
  return { contexto, noExisten }
}

const armar = async (e: EntradaRotulo) => {
  const { contexto, noExisten } = await cargarContexto(e)
  const { rotulo, faltan } = armarRotulo(e, contexto)
  return { rotulo, faltan: [...noExisten, ...faltan] }
}

// ── Opciones del formulario ──
export const opcionesRotulo = async () => {
  const [sedes, operaciones, transportadoras, tramitadores, solicitantes] = await Promise.all([
    sedesActivas(),
    Operaciones.findAll({ attributes: ['id', 'nombreOperacion', 'centroDeCostos'], order: [['nombreOperacion', 'ASC']] }),
    Transportadora.findAll({ attributes: ['id', 'nombreTransportadora'], order: [['nombreTransportadora', 'ASC']] }),
    Tramitador.findAll({
      where: { activo: true },
      include: [{ model: Municipios, as: 'municipioResidencia', attributes: ['nombreMunicipio', 'departamento'] }],
      order: [['nombreTramitador', 'ASC']]
    }),
    // Quienes han creado trámites en el último año (sugerencias para "Solicitante del envío")
    db.query<{ nombre: string }>(`
      SELECT DISTINCT TRIM(u."nombreUsuario") AS nombre
      FROM "SolicitudTramites" s JOIN "Usuarios" u ON u.id = s."usuarioId"
      WHERE s."createdAt" > NOW() - INTERVAL '365 days' AND TRIM(COALESCE(u."nombreUsuario", '')) <> ''
      ORDER BY 1
    `, { type: QueryTypes.SELECT })
  ])
  return {
    gpa: GPA,
    sedes,
    operaciones: operaciones.map(o => ({ id: o.id, nombre: o.nombreOperacion, centroDeCostos: o.centroDeCostos })),
    // Las del catálogo de Logística (así la logística del trámite queda con la misma); sin catálogo, las de siempre
    transportadoras: transportadoras.length ? transportadoras.map(nombreTransportadora).filter(Boolean) : TRANSPORTADORAS_SUGERIDAS,
    tramitadores: tramitadores.map(t => ({ ...tramitadorParaRotulo(t), esMensajero: t.esMensajero })),
    tipos: TIPOS_ENVIO,
    contenidos: CONTENIDOS,
    solicitantes: solicitantes.map(s => s.nombre)
  }
}

// ── Datos de un trámite para prellenar el rótulo o agregarlo al envío ──
export const tramiteParaRotulo = async (id: number) => {
  const t = await SolicitudTramites.findByPk(id, {
    attributes: ['id', 'placa', 'matriculaInmobiliaria', 'direccionTramite', 'operacionesId', 'tramitadorId', 'municipiosId'],
    include: [
      { model: Clientes, attributes: ['nombreCliente', 'identificacionCliente', 'telefono', 'telefonoMovil'] },
      { model: Municipios, attributes: ['id', 'nombreMunicipio', 'departamento'] },
      { model: Usuarios, attributes: ['nombreUsuario'] },
      { model: Tramite, attributes: ['nombreTramite'] }
    ]
  })
  if (!t) throw new ErrorGastos(`No existe el trámite #${id}`, 404)
  return {
    id: t.id,
    placa: String(t.placa || t.matriculaInmobiliaria || '').trim().toUpperCase(),
    nombreTramite: t.tramite?.nombreTramite ?? null,
    operacionId: t.operacionesId ?? null,
    tramitadorId: t.tramitadorId ?? null,
    solicitante: t.usuario?.nombreUsuario?.trim() ?? '',
    cliente: t.clientes ? {
      nombre: String(t.clientes.nombreCliente ?? '').trim(),
      identificacion: t.clientes.identificacionCliente ?? '',
      telefono: t.clientes.telefonoMovil || t.clientes.telefono || ''
    } : null,
    municipio: t.municipios ? { id: t.municipios.id, nombre: titulo(t.municipios.nombreMunicipio), departamento: titulo(t.municipios.departamento) } : null,
    direccion: t.direccionTramite ?? ''
  }
}

// ── Vista previa: el PDF tal como saldría (sin guardar) y lo que falta ──
export const vistaPreviaRotulo = async (e: EntradaRotulo) => {
  const { rotulo, faltan } = await armar(e)
  const pdf = await generarPdfRotulo(rotulo)
  return { faltan, tamano: rotulo.tamano, paga: rotulo.paga, contraentrega: rotulo.contraentrega, pdf: pdf.toString('base64') }
}

// Busca la transportadora del catálogo por nombre sin tildes ("Envía" → "Envía (Colvanes)"); si no está, no se pone
const transportadoraDelCatalogo = async (nombre: string) => {
  const buscado = normalizar(nombre)
  if (!buscado) return null
  const todas = (await Transportadora.findAll({ attributes: ['id', 'nombreTransportadora'] })).map(t => ({ id: t.id, nombre: normalizar(nombreTransportadora(t)) }))
  return (todas.find(t => t.nombre === buscado) ?? todas.find(t => t.nombre.startsWith(`${buscado} `)))?.id ?? null
}

// ── Generar: guarda el rótulo, deja el PDF en cada trámite y (si se pide) llena la logística ──
export const crearRotulo = async (e: EntradaRotulo, usuarioId: number, llenarLogistica: boolean) => {
  const { rotulo, faltan } = await armar(e)
  if (faltan.length) throw Object.assign(new ErrorGastos(`Faltan datos: ${faltan.join('; ')}`), { faltan })

  const pdf = await generarPdfRotulo(rotulo)
  const nombre = nombreArchivoRotulo(rotulo)
  const transportadoraId = llenarLogistica ? await transportadoraDelCatalogo(rotulo.transportadora) : null

  // Primero los archivos en Azure (uno por trámite: borrar el documento de uno no afecta a los otros)
  const subidos: { tramiteId: number, carpeta: string, archivo: string }[] = []
  try {
    for (const t of rotulo.tramites) {
      const carpeta = `solicitudes/${t.id}`
      const archivo = nombreSeguro(nombre)
      await subirArchivo(carpeta, archivo, pdf)
      subidos.push({ tramiteId: t.id, carpeta, archivo })
    }

    const creado = await db.transaction(async transaction => {
      const registro = await RotuloEnvio.create({
        usuarioId, origen: rotulo.origen, destino: rotulo.destino, destinatario: rotulo.dest.titulo.slice(0, 255),
        contraentrega: rotulo.contraentrega, paga: rotulo.paga, transportadora: rotulo.transportadora || null,
        tamano: rotulo.tamano, datos: rotulo as unknown as Record<string, unknown>
      }, { transaction })

      const logisticas: number[] = []
      for (const s of subidos) {
        const documento = await DocumentoSolicitud.create({
          solicitudTramiteId: s.tramiteId, usuarioId, tramitadorId: null, tipoDocumento: null,
          nombreOriginal: conPrefijo('Rótulo de envío', nombre), nombreArchivo: s.archivo,
          rutaArchivo: `${s.carpeta}/${s.archivo}`, tipoArchivo: 'application/pdf', tamano: pdf.length
        }, { transaction })
        await RotuloTramite.create({ rotuloId: registro.id, solicitudTramiteId: s.tramiteId, documentoId: documento.id }, { transaction })

        if (llenarLogistica) {
          const destinatario = rotulo.dest.titulo.slice(0, 50)
          const actual = await Logistica.findOne({ where: { solicitudTramiteId: s.tramiteId }, transaction })
          if (!actual) {
            await Logistica.create({ solicitudTramiteId: s.tramiteId, transportadoraId, destinatario }, { transaction })
            logisticas.push(s.tramiteId)
          } else {
            const cambios: Partial<Pick<Logistica, 'transportadoraId' | 'destinatario'>> = {}
            if (!actual.transportadoraId && transportadoraId) cambios.transportadoraId = transportadoraId
            if (!actual.destinatario) cambios.destinatario = destinatario
            if (Object.keys(cambios).length) { await actual.update(cambios, { transaction }); logisticas.push(s.tramiteId) }
          }
        }
      }
      return { id: registro.id, logisticas }
    })

    return {
      id: creado.id,
      nombre,
      tramites: rotulo.tramites.map(t => t.id),
      logisticas: creado.logisticas,
      transportadoraEnCatalogo: !llenarLogistica || !rotulo.transportadora || transportadoraId !== null
    }
  } catch (error) {
    await Promise.all(subidos.map(s => eliminarArchivo(s.carpeta, s.archivo).catch(() => undefined)))
    throw error
  }
}

// ── Historial ──
export const listarRotulos = async ({ tramiteId, q, limite = 50 }: { tramiteId?: number | null, q?: string, limite?: number }) => {
  const busqueda = String(q ?? '').trim()
  const porNumero = /^#?\d+$/.test(busqueda) ? Number(busqueda.replace('#', '')) : null
  const filtroTramite = tramiteId ?? porNumero
  const filas = await RotuloEnvio.findAll({
    where: {
      ...(filtroTramite ? { id: { [Op.in]: db.literal(`(SELECT rotulo_id FROM rotulos_envio_tramites WHERE solicitud_tramite_id = ${Number(filtroTramite)})`) } } : {}),
      ...(busqueda && !porNumero ? { destinatario: { [Op.iLike]: `%${busqueda.replace(/[%_]/g, '')}%` } } : {})
    },
    include: [
      { model: Usuarios, attributes: ['nombreUsuario'] },
      { model: RotuloTramite, attributes: ['solicitudTramiteId', 'documentoId'] }
    ],
    order: [['createdAt', 'DESC']],
    limit: Math.min(Math.max(limite, 1), 200)
  })
  return filas.map(r => {
    const datos = r.datos as unknown as Rotulo
    return {
      id: r.id,
      creado: r.createdAt,
      usuario: r.usuario?.nombreUsuario ?? null,
      flujo: datos.flujo,
      destinatario: r.destinatario,
      ciudad: [datos.dest?.ciudad, datos.dest?.dep].filter(Boolean).join(', '),
      contraentrega: r.contraentrega,
      paga: r.paga,
      transportadora: r.transportadora,
      tamano: r.tamano,
      contenido: datos.contenido,
      tramites: (r.tramites ?? []).map(t => t.solicitudTramiteId).sort((a, b) => a - b)
    }
  })
}

export const pdfDeRotulo = async (id: number) => {
  const r = await RotuloEnvio.findByPk(id)
  if (!r) throw new ErrorGastos('El rótulo no existe', 404)
  const datos = r.datos as unknown as Rotulo
  return { contenido: await generarPdfRotulo(datos), nombre: nombreArchivoRotulo(datos) }
}
