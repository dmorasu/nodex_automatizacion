import { db } from '../config/db'

// =====================================
// AJUSTES DE ESQUEMA DEL MÓDULO DE TRÁMITES
// sync() no modifica tablas existentes. Cada ajuste revisa antes si hace falta,
// así que se puede ejecutar en cada arranque.
// =====================================

const columnasDe = async (tabla: string) => {
  try {
    return await db.getQueryInterface().describeTable(tabla)
  } catch {
    return null // la tabla aún no existe: sync() la crea con el modelo actual
  }
}

// Responsables que estaban escritos como texto en Municipios.responsable → id en Usuarios.
// Solo se usa una vez, al crear las columnas.
const ANALISTAS_POR_NOMBRE: Record<string, number> = {
  'Maria Orlinda': 24,
  'Jenny Velosa': 45,
  'Johan Diaz': 55
}

// 2026-10-03 · El analista se asigna en cada trámite (SolicitudTramites.analistaAsignado,
// id de Usuarios) y no por el nombre escrito en el municipio. El municipio solo guarda el
// analista por defecto (Municipios.analistaId) que toman los trámites nuevos.
const analistaAsignado = async () => {
  const municipios = await columnasDe('Municipios')
  if (municipios && !municipios.analistaId) {
    await db.query(`
      ALTER TABLE "Municipios"
      ADD COLUMN "analistaId" INTEGER REFERENCES "Usuarios" (id) ON UPDATE CASCADE ON DELETE SET NULL
    `)
    for (const [nombre, usuarioId] of Object.entries(ANALISTAS_POR_NOMBRE)) {
      await db.query(
        `UPDATE "Municipios" SET "analistaId" = :usuarioId WHERE TRIM(responsable) = :nombre`,
        { replacements: { usuarioId, nombre } }
      )
    }
  }

  const solicitudes = await columnasDe('SolicitudTramites')
  if (solicitudes && !solicitudes.analistaAsignado) {
    await db.query(`
      ALTER TABLE "SolicitudTramites"
      ADD COLUMN "analistaAsignado" INTEGER REFERENCES "Usuarios" (id) ON UPDATE CASCADE ON DELETE SET NULL
    `)
    await db.query(`CREATE INDEX IF NOT EXISTS "solicitud_tramites_analista_asignado" ON "SolicitudTramites" ("analistaAsignado")`)

    // Los trámites existentes toman el analista de su municipio (lo que se hacía hasta hoy)
    await db.query(`
      UPDATE "SolicitudTramites" s
      SET "analistaAsignado" = m."analistaId"
      FROM "Municipios" m
      WHERE m.id = s."municipiosId" AND s."analistaAsignado" IS NULL
    `)
  }
}

// 2026-10-03 · Rutas de mensajeros: ubicación de la dirección de cada trámite y marca de
// mensajero en el tramitador. (La sede del mensajero se agrega después de sync(), porque su
// llave foránea apunta a mensajeria_sedes, que crea sync().)
const ubicacionYMensajeros = async () => {
  const solicitudes = await columnasDe('SolicitudTramites')
  if (solicitudes) {
    const nuevas: [string, string][] = [
      ['latitud', 'DOUBLE PRECISION'],
      ['longitud', 'DOUBLE PRECISION'],
      ['ubicacionFuente', 'VARCHAR(20)'],
      ['ubicacionPrecisa', 'BOOLEAN'],
      ['ubicacionDireccion', 'TEXT']
    ]
    for (const [columna, tipo] of nuevas) {
      if (!solicitudes[columna]) await db.query(`ALTER TABLE "SolicitudTramites" ADD COLUMN "${columna}" ${tipo}`)
    }
  }

  const tramitadores = await columnasDe('Tramitador')
  if (tramitadores && !tramitadores.esMensajero) {
    await db.query(`ALTER TABLE "Tramitador" ADD COLUMN "esMensajero" BOOLEAN NOT NULL DEFAULT false`)
  }
}

// 2026-10-12 · Versión de sesión del usuario: va dentro del token y se sube al cambiar o
// restablecer la contraseña o al cerrar sesión, así esos tokens dejan de servir de inmediato
const versionSesion = async () => {
  const usuarios = await columnasDe('Usuarios')
  if (usuarios && !usuarios.versionSesion) {
    await db.query(`ALTER TABLE "Usuarios" ADD COLUMN "versionSesion" INTEGER NOT NULL DEFAULT 0`)
  }
}

export const ajustarEsquemaTramites = async () => {
  await analistaAsignado()
  await ubicacionYMensajeros()
  await versionSesion()
  await areasDeUsuarios()
  await descargaPagoUnificada()
  await regionalDeMunicipios()
}

// Regional de cada departamento, tomada del listado de municipios entregado el 2026-10-21
// (Municipios(Hoja1).csv). Claves en mayúsculas y sin tildes.
const REGIONAL_POR_DEPARTAMENTO: Record<string, string> = {
  'ANTIOQUIA': 'ANTIOQUIA',
  'CHOCO': 'ANTIOQUIA',
  'BOGOTA, D.C.': 'BOGOTÁ Y SABANA',
  'CUNDINAMARCA': 'BOGOTÁ Y SABANA',
  'ARCHIPIELAGO DE SAN ANDRES, PROVIDENCIA Y SANTA CATALINA': 'CARIBE',
  'ATLANTICO': 'CARIBE',
  'BOLIVAR': 'CARIBE',
  'CESAR': 'CARIBE',
  'CORDOBA': 'CARIBE',
  'LA GUAJIRA': 'CARIBE',
  'MAGDALENA': 'CARIBE',
  'SUCRE': 'CARIBE',
  'ARAUCA': 'CENTRO',
  'BOYACA': 'CENTRO',
  'CALDAS': 'CENTRO',
  'CASANARE': 'CENTRO',
  'META': 'CENTRO',
  'NORTE DE SANTANDER': 'CENTRO',
  'QUINDIO': 'CENTRO',
  'RISARALDA': 'CENTRO',
  'SANTANDER': 'CENTRO',
  'TOLIMA': 'CENTRO',
  'AMAZONAS': 'SUR',
  'CAQUETA': 'SUR',
  'CAUCA': 'SUR',
  'GUAINIA': 'SUR',
  'GUAVIARE': 'SUR',
  'HUILA': 'SUR',
  'NARIÑO': 'SUR',
  'PUTUMAYO': 'SUR',
  'VALLE DEL CAUCA': 'SUR',
  'VAUPES': 'SUR',
  'VICHADA': 'SUR'
}

// Municipios que el listado pone en otra regional que la de su departamento
const REGIONAL_POR_MUNICIPIO: { municipio: string, departamento: string, regional: string }[] = [
  { municipio: 'YAGUARA', departamento: 'HUILA', regional: 'CARIBE' }
]

// En SQL: mayúsculas y sin tildes (la Ñ se conserva), para comparar con las claves de arriba
const sinTildes = (columna: string) => `TRANSLATE(UPPER(TRIM(${columna})), 'ÁÉÍÓÚÜ', 'AEIOUU')`

// 2026-10-21 · La tabla Municipios está cargada dos veces y solo una copia traía la regional
// (en desarrollo 1.123 de 2.244 sin regional, entre ellas las que usan la mayoría de trámites).
// Llena la regional que falte según el departamento; nunca cambia una que ya tenga valor, así que
// en cada arranque solo toca los municipios nuevos que lleguen sin regional.
const regionalDeMunicipios = async () => {
  const municipios = await columnasDe('Municipios')
  if (!municipios?.regional) return

  for (const { municipio, departamento, regional } of REGIONAL_POR_MUNICIPIO) {
    await db.query(`
      UPDATE "Municipios" SET regional = :regional
      WHERE regional IS NULL AND ${sinTildes('"nombreMunicipio"')} = :municipio AND ${sinTildes('departamento')} = :departamento
    `, { replacements: { regional, municipio, departamento } })
  }
  for (const [departamento, regional] of Object.entries(REGIONAL_POR_DEPARTAMENTO)) {
    await db.query(
      `UPDATE "Municipios" SET regional = :regional WHERE regional IS NULL AND ${sinTildes('departamento')} = :departamento`,
      { replacements: { regional, departamento } }
    )
  }

  const [[{ faltan }]] = await db.query(`SELECT COUNT(*)::int AS faltan FROM "Municipios" WHERE regional IS NULL`) as [{ faltan: number }[], unknown]
  if (faltan) console.log(`Municipios: ${faltan} sin regional (departamento no reconocido)`)
}

// 2026-10-19 · Operaciones cuyos gastos Legalización descarga como un solo PDF de pago por gasto.
// Solo al crear la columna se marca Finalizaciones Leasing Vehículos (centro de costos 1301);
// después se cambia en Catálogos → Operaciones
const descargaPagoUnificada = async () => {
  const operaciones = await columnasDe('Operaciones')
  if (!operaciones || operaciones.descargaPagoUnificada) return
  await db.query(`ALTER TABLE "Operaciones" ADD COLUMN "descargaPagoUnificada" BOOLEAN NOT NULL DEFAULT false`)
  await db.query(`UPDATE "Operaciones" SET "descargaPagoUnificada" = true WHERE TRIM("centroDeCostos") = '1301'`)
}

// Áreas iniciales del catálogo (después se crean, renombran y eliminan en Catálogos → Áreas)
const AREAS_INICIALES = [
  'Vehículos', 'TI', 'Gestión de activos', 'Talento humano', 'Torre de control',
  'Administración', 'Contabilidad', 'Tesorería', 'GPA Legal', 'Tutelas'
]

// "Gestión de activos", "gestion_activos" y "GESTION ACTIVOS" → "gestionactivos"
const claveArea = (texto: string) =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\bde\b/g, '').replace(/\s/g, '')

// 2026-10-19 · Catálogo de áreas (tabla Areas y Usuarios.areaId). Hasta hoy el área era un texto
// libre (Usuarios.area, con valores como "gestion_activos", "TORRE CONTROL" o "Torre de control").
// Solo la primera vez (al crear la columna): crea las áreas y pasa cada usuario a la suya por el
// texto; los textos que no corresponden a ninguna quedan sin área (se listan en el log).
const areasDeUsuarios = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS "Areas" (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `)

  const usuarios = await columnasDe('Usuarios')
  if (!usuarios || usuarios.areaId) return

  await db.transaction(async transaction => {
    await db.query(`
      ALTER TABLE "Usuarios"
      ADD COLUMN "areaId" INTEGER REFERENCES "Areas" (id) ON UPDATE CASCADE ON DELETE SET NULL
    `, { transaction })
    await db.query(`CREATE INDEX IF NOT EXISTS "usuarios_area_id" ON "Usuarios" ("areaId")`, { transaction })

    const ids = new Map<string, number>()
    for (const nombre of AREAS_INICIALES) {
      const [[fila]] = await db.query(`INSERT INTO "Areas" (nombre) VALUES (:nombre) RETURNING id`, { replacements: { nombre }, transaction }) as [{ id: number }[], unknown]
      ids.set(claveArea(nombre), fila.id)
    }

    const [textos] = await db.query(`SELECT DISTINCT area FROM "Usuarios" WHERE TRIM(COALESCE(area, '')) <> ''`, { transaction }) as [{ area: string }[], unknown]
    const sinArea: string[] = []
    for (const { area } of textos) {
      const areaId = ids.get(claveArea(area))
      if (!areaId) { sinArea.push(area); continue }
      await db.query(
        `UPDATE "Usuarios" SET "areaId" = :areaId, area = (SELECT nombre FROM "Areas" WHERE id = :areaId) WHERE area = :area`,
        { replacements: { areaId, area }, transaction }
      )
    }
    if (sinArea.length) console.log(`Áreas: usuarios sin área por texto no reconocido: ${sinArea.join(', ')}`)
  })
}

// Después de sync(): la sede del mensajero (mensajeria_sedes ya existe)
export const ajustarEsquemaMensajeria = async () => {
  const tramitadores = await columnasDe('Tramitador')
  if (tramitadores && !tramitadores.sedeId) {
    await db.query(`
      ALTER TABLE "Tramitador"
      ADD COLUMN "sedeId" INTEGER REFERENCES mensajeria_sedes (id) ON UPDATE CASCADE ON DELETE SET NULL
    `)
  }

  // 2026-10-21 · Tiempo por diligencia (PESV): inicio de la diligencia y la ruta en que se hizo.
  // mensajeria_jornadas ya existe (la crea sync()).
  const paradas = await columnasDe('mensajeria_paradas')
  if (paradas) {
    const nuevas: [string, string][] = [
      ['inicio_diligencia', 'TIMESTAMP WITH TIME ZONE'],
      ['latitud_inicio', 'DOUBLE PRECISION'],
      ['longitud_inicio', 'DOUBLE PRECISION'],
      ['jornada_id', 'INTEGER REFERENCES mensajeria_jornadas (id) ON UPDATE CASCADE ON DELETE SET NULL'],
      // 2026-10-25 · Desplazamiento de la diligencia realizada: moto o transporte intermunicipal
      ['transporte', 'VARCHAR(20)']
    ]
    for (const [columna, tipo] of nuevas) {
      if (!paradas[columna]) await db.query(`ALTER TABLE mensajeria_paradas ADD COLUMN ${columna} ${tipo}`)
    }
  }
}
