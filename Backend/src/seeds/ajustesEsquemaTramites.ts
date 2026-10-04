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

export const ajustarEsquemaTramites = async () => {
  await analistaAsignado()
  await ubicacionYMensajeros()
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
}
