import { QueryTypes } from 'sequelize'
import { db } from '../config/db'

// =====================================
// DIRECTORIO DE TRAMITADORES (Ayudas Torre de Control, fase 2, 2026-11-04)
// Lo que antes era el HTML con el Excel de Torre de control incrustado: quién atiende cada
// municipio y cómo contactarlo. Solo tramitadores activos. La pantalla calcula distancias con las
// coordenadas de los municipios. Los municipios repetidos de la tabla se ven como uno solo
// (la copia de menor id, como el buscador): la cobertura y la residencia apuntan a esa copia.
// =====================================

// Copia que representa a cada municipio (mismo nombre y departamento)
const CANONICO = (alias: string) => `(
  SELECT MIN(c.id) FROM "Municipios" c
  WHERE UPPER(TRIM(c."nombreMunicipio")) = UPPER(TRIM(${alias}."nombreMunicipio"))
    AND UPPER(TRIM(c.departamento)) = UPPER(TRIM(${alias}.departamento))
)`

export const datosDirectorio = async () => {
  const [municipios, tramitadores, cobertura, sedes] = await Promise.all([
    db.query<{ id: number, nombre: string, departamento: string, regional: string | null, latitud: number | null, longitud: number | null }>(`
      SELECT DISTINCT ON (UPPER(TRIM(m."nombreMunicipio")), UPPER(TRIM(m.departamento)))
        m.id, m."nombreMunicipio" AS nombre, m.departamento,
        COALESCE(m.regional, (SELECT d.regional FROM "Municipios" d WHERE UPPER(TRIM(d."nombreMunicipio")) = UPPER(TRIM(m."nombreMunicipio"))
          AND UPPER(TRIM(d.departamento)) = UPPER(TRIM(m.departamento)) AND d.regional IS NOT NULL LIMIT 1)) AS regional,
        COALESCE(m.latitud, (SELECT d.latitud FROM "Municipios" d WHERE UPPER(TRIM(d."nombreMunicipio")) = UPPER(TRIM(m."nombreMunicipio"))
          AND UPPER(TRIM(d.departamento)) = UPPER(TRIM(m.departamento)) AND d.latitud IS NOT NULL LIMIT 1)) AS latitud,
        COALESCE(m.longitud, (SELECT d.longitud FROM "Municipios" d WHERE UPPER(TRIM(d."nombreMunicipio")) = UPPER(TRIM(m."nombreMunicipio"))
          AND UPPER(TRIM(d.departamento)) = UPPER(TRIM(m.departamento)) AND d.longitud IS NOT NULL LIMIT 1)) AS longitud
      FROM "Municipios" m
      ORDER BY UPPER(TRIM(m."nombreMunicipio")), UPPER(TRIM(m.departamento)), m.id
    `, { type: QueryTypes.SELECT }),
    db.query<Record<string, unknown>>(`
      SELECT t.id, t."nombreTramitador" AS nombre, t.identificacion, t."esMensajero", t.region,
        t."numeroTramitador" AS whatsapp, t."correoTramitador" AS correo, t."correoPersonal", t.direccion, t.ciudad,
        t.banco, t."tipoCuenta", t."tarjetaAmparada", t."tiempoPago", t."notaDirectorio" AS nota,
        t."cumpleDia", t."cumpleMes", s.nombre AS sede,
        ${CANONICO('r')} AS "residenciaId"
      FROM "Tramitador" t
      LEFT JOIN "Municipios" r ON r.id = t."municipioResidenciaId"
      LEFT JOIN mensajeria_sedes s ON s.id = t."sedeId"
      WHERE t.activo
      ORDER BY t."nombreTramitador"
    `, { type: QueryTypes.SELECT }),
    db.query<{ tramitadorId: number, municipioId: number }>(`
      SELECT DISTINCT c.tramitador_id AS "tramitadorId", ${CANONICO('m')} AS "municipioId"
      FROM tramitadores_cobertura c
      JOIN "Tramitador" t ON t.id = c.tramitador_id AND t.activo
      JOIN "Municipios" m ON m.id = c.municipio_id
    `, { type: QueryTypes.SELECT }),
    db.query(`
      SELECT id, nombre, direccion, ciudad, celular, horario FROM mensajeria_sedes WHERE activo ORDER BY nombre
    `, { type: QueryTypes.SELECT })
  ])

  const porTramitador = new Map<number, number[]>()
  for (const c of cobertura) porTramitador.set(c.tramitadorId, [...(porTramitador.get(c.tramitadorId) ?? []), Number(c.municipioId)])

  return {
    municipios,
    tramitadores: tramitadores.map(t => ({
      ...t,
      residenciaId: t.residenciaId === null ? null : Number(t.residenciaId),
      cobertura: porTramitador.get(Number(t.id)) ?? []
    })),
    sedes
  }
}
