import { QueryTypes } from 'sequelize'
import { db } from '../config/db'
import { obtenerReintegrosPorTramitador } from './gastos/reintegrosTramitador'
import { sumarDiasHabiles } from '../utils/diasHabiles'

// =====================================
// TABLERO DE GESTIÓN DE TRÁMITES (Torre de control)
// Criterios acordados con los líderes (2026-10-03):
//   · Abierto: estado actual distinto de Finalizado y Desistido (sin estado = Sin iniciar).
//   · Vencido: abierto y pasaron más de DIAS_GRACIA días desde la fecha de programación
//     (fecha de diligencia). No hay tiempo meta por tipo de trámite. Los que están en espera
//     por novedad no cuentan (2026-10-13): dependen de un tercero y tienen su propia alerta.
//   · A tiempo: finalizado a más tardar DIAS_GRACIA días después de la fecha de programación.
//   · Alertas de "sin movimiento": más de DIAS_GRACIA días sin trazabilidad ni cambio de estado.
//   · Última gestión (2026-10-13): lo más reciente que se hizo en el trámite (estado, trazabilidad,
//     programación, logística, subestado, documento, asignación o edición). Solo se muestra: las
//     alertas de "sin movimiento" siguen con el criterio acordado (trazabilidad o cambio de estado).
//   · En espera por novedad (2026-10-13): todos los que están en novedad, con los días que llevan.
//   · Programación en plazo (2026-10-13, por analista): de los trámites creados en el período,
//     cuántos se programaron (se les puso fecha de diligencia) a más tardar el día hábil siguiente
//     a su creación (sin fines de semana ni festivos de Colombia). Los que aún están dentro del
//     plazo sin programar, y los desistidos sin programar, no cuentan.
//   · Vencen hoy (2026-10-13): abiertos cuya fecha de entrega del resultado (la que se pone al
//     crear el trámite) es hoy. Es la lista del día a día de las analistas.
// =====================================

export const DIAS_GRACIA = 2
const SEMANAS_TENDENCIA = 12
const MAXIMO_POR_ALERTA = 100
const MAXIMO_RANKING = 15
const ESTADOS_CERRADOS = ['Finalizado', 'Desistido']
const EN_NOVEDAD = 'En espera por novedad'

export type FiltrosTablero = {
  desde: string            // YYYY-MM-DD (período para finalizados, % a tiempo, ciclo, valor y causas)
  hasta: string
  analistaId?: number | 'sin'
  tramitadorId?: number
  operacionId?: number
  tramiteId?: number
  // Estado actual (id de Estados). "Sin Iniciar" incluye los que no tienen estado
  estadoId?: number
}

type Fila = {
  id: number
  creado: string           // YYYY-MM-DD (Bogotá)
  estado: string
  cerrado: boolean
  analistaId: number | null
  analista: string | null
  tramitadorId: number | null
  tramitador: string | null
  clienteId: number | null
  cliente: string | null
  identificacionCliente: string | null
  tipo: string | null
  placa: string | null
  municipioId: number | null
  municipio: string | null
  departamento: string | null
  latitud: number | null
  longitud: number | null
  valor: number            // valor trámite + viáticos de la programación
  fechaProgramada: string | null   // YYYY-MM-DD
  fechaEntrega: string | null      // YYYY-MM-DD: entrega del resultado prometida al crear el trámite
  finalizado: string | null        // YYYY-MM-DD (Bogotá)
  ultimaActividad: string          // YYYY-MM-DD (Bogotá)
  ultimoEstado: string | null      // YYYY-MM-DD (Bogotá): último cambio de estado
  programadoEl: string | null      // YYYY-MM-DD (Bogotá): día en que se le puso fecha de diligencia
  ultimaGestion: string            // YYYY-MM-DD HH:MI (Bogotá)
  ultimaGestionTipo: string        // Qué fue: Cambio de estado, Trazabilidad, Programación...
  reportadoRealizado: boolean
}

const DIA_MS = 24 * 60 * 60 * 1000

// Días entre dos fechas YYYY-MM-DD
const diasEntre = (desde: string, hasta: string) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA_MS)

const sumarDias = (fecha: string, dias: number) =>
  new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10)

// Lunes de la semana de una fecha YYYY-MM-DD
const lunesDe = (fecha: string) => {
  const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay() // 0 = domingo
  return sumarDias(fecha, -((dia + 6) % 7))
}

const redondear1 = (valor: number) => Math.round(valor * 10) / 10

// Condiciones de los filtros sobre SolicitudTramites (alias s)
const condicionesFiltro = (filtros: FiltrosTablero, replacements: Record<string, unknown>) => {
  const condiciones: string[] = []
  if (filtros.analistaId === 'sin') condiciones.push('s."analistaAsignado" IS NULL')
  else if (filtros.analistaId) { condiciones.push('s."analistaAsignado" = :analistaId'); replacements.analistaId = filtros.analistaId }
  if (filtros.tramitadorId) { condiciones.push('s."tramitadorId" = :tramitadorId'); replacements.tramitadorId = filtros.tramitadorId }
  if (filtros.operacionId) { condiciones.push('s."operacionesId" = :operacionId'); replacements.operacionId = filtros.operacionId }
  if (filtros.tramiteId) { condiciones.push('s."tramiteId" = :tramiteId'); replacements.tramiteId = filtros.tramiteId }
  // Sin estado = Sin Iniciar (id 1), como lo muestra el tablero
  if (filtros.estadoId) { condiciones.push('COALESCE(s."estadoActualTramite", 1) = :estadoId'); replacements.estadoId = filtros.estadoId }
  return condiciones
}

// Trámites del tablero: todos los abiertos y los creados o finalizados desde `inicio`
const consultarFilas = async (filtros: FiltrosTablero, inicio: string) => {
  const replacements: Record<string, unknown> = { inicio, cerrados: ESTADOS_CERRADOS }
  const condiciones = condicionesFiltro(filtros, replacements)

  const filas = await db.query<Fila>(`
    WITH base AS (
      SELECT
        s.id,
        to_char(s."createdAt" AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS creado,
        COALESCE(e."nombreEstado", 'Sin Iniciar') AS estado,
        COALESCE(e."nombreEstado" IN (:cerrados), false) AS cerrado,
        s."analistaAsignado" AS "analistaId",
        u."nombreUsuario" AS analista,
        s."tramitadorId",
        TRIM(t."nombreTramitador") AS tramitador,
        s."clienteId",
        c."nombreCliente" AS cliente,
        c."identificacionCliente",
        tr."nombreTramite" AS tipo,
        COALESCE(s.placa, s."matriculaInmobiliaria") AS placa,
        s."municipiosId" AS "municipioId",
        m."nombreMunicipio" AS municipio,
        m.departamento,
        m.latitud,
        m.longitud,
        COALESCE(p."valorTramite", 0) + COALESCE(p."valorViaticos", 0) AS valor,
        -- Se guarda como medianoche UTC del día programado (así la muestra también el frontend)
        to_char(p."fechaProbableEntrega" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS "fechaProgramada",
        to_char(p."fechaFinalizacionServicio" AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS finalizado,
        -- El formulario la guarda a medianoche UTC y el cargue masivo a medianoche de Bogotá
        -- (05:00 UTC): leída en UTC, las dos dan el mismo día
        to_char(s."fechaEntregaResultado" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS "fechaEntrega",
        s."createdAt",
        p."updatedAt" AS "programacionActualizada",
        p."createdAt" AS "programacionCreada",
        l."updatedAt" AS "logisticaActualizada"
      FROM "SolicitudTramites" s
      LEFT JOIN "Estados" e ON e.id = s."estadoActualTramite"
      LEFT JOIN "Programacion" p ON p."solicitudTramiteId" = s.id
      LEFT JOIN "Logistica" l ON l."solicitudTramiteId" = s.id
      LEFT JOIN "Usuarios" u ON u.id = s."analistaAsignado"
      LEFT JOIN "Tramitador" t ON t.id = s."tramitadorId"
      LEFT JOIN "Clientes" c ON c.id = s."clienteId"
      LEFT JOIN "Tramites" tr ON tr.id = s."tramiteId"
      LEFT JOIN "Municipios" m ON m.id = s."municipiosId"
      ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
    )
    SELECT
      b.*,
      -- Última actividad: el más reciente entre creación, trazabilidad y cambio de estado
      to_char(GREATEST(b."createdAt", z.ultima, x.ultima) AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS "ultimaActividad",
      to_char(x.ultima AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS "ultimoEstado",
      -- Cuándo se programó: la bitácora dice el momento exacto en que la fecha de diligencia pasó
      -- de vacía a tener valor; antes de la bitácora, la creación de la programación (si tiene fecha)
      to_char(COALESCE(hp.primera, CASE WHEN b."fechaProgramada" IS NOT NULL THEN b."programacionCreada" END)
        AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS "programadoEl",
      to_char(g.fecha AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS "ultimaGestion",
      g.tipo AS "ultimaGestionTipo",
      (r.solicitud_tramite_id IS NOT NULL) AS "reportadoRealizado"
    FROM base b
    LEFT JOIN (SELECT "solicitudTramiteId", MAX("createdAt") AS ultima FROM "Trazabilidad" GROUP BY 1) z ON z."solicitudTramiteId" = b.id
    LEFT JOIN (SELECT "solicitudTramiteId", MAX("createdAt") AS ultima FROM "EstadosTramites" GROUP BY 1) x ON x."solicitudTramiteId" = b.id
    LEFT JOIN (
      SELECT solicitud_tramite_id, MIN(created_at) AS primera FROM historial_tramites
      WHERE seccion = 'PROGRAMACION'
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(cambios) c WHERE c->>'campo' = 'Fecha de diligencia' AND c->>'antes' IS NULL)
      GROUP BY 1
    ) hp ON hp.solicitud_tramite_id = b.id
    LEFT JOIN (SELECT "solicitudTramiteId", MAX("createdAt") AS ultima FROM "SubEstadosSolicitud" GROUP BY 1) se ON se."solicitudTramiteId" = b.id
    LEFT JOIN (SELECT "solicitudTramiteId", MAX("createdAt") AS ultima FROM "DocumentosSolicitud" GROUP BY 1) d ON d."solicitudTramiteId" = b.id
    -- Bitácora (desde 2026-10-13): asignaciones, ediciones, cuenta de cobro... con su sección
    LEFT JOIN (
      SELECT DISTINCT ON (solicitud_tramite_id) solicitud_tramite_id, created_at AS ultima, seccion
      FROM historial_tramites ORDER BY solicitud_tramite_id, created_at DESC
    ) h ON h.solicitud_tramite_id = b.id
    -- Última gestión: la más reciente de todas las fuentes (programación y logística por su
    -- última modificación, así cuentan también los cambios anteriores a la bitácora)
    LEFT JOIN LATERAL (
      SELECT v.fecha, v.tipo
      FROM (VALUES
        (b."createdAt", 'Creación'),
        (x.ultima, 'Cambio de estado'),
        (z.ultima, 'Trazabilidad'),
        (b."programacionActualizada", 'Programación'),
        (b."logisticaActualizada", 'Logística'),
        (se.ultima, 'Subestado'),
        (d.ultima, 'Documento'),
        (h.ultima, CASE h.seccion
          WHEN 'TRAMITADOR' THEN 'Asignación de tramitador'
          WHEN 'ANALISTA' THEN 'Asignación de analista'
          WHEN 'DATOS' THEN 'Edición del trámite'
          WHEN 'CUENTA_COBRO' THEN 'Cuenta de cobro'
          WHEN 'PROGRAMACION' THEN 'Programación'
          WHEN 'LOGISTICA' THEN 'Logística'
          WHEN 'ESTADO' THEN 'Cambio de estado'
          WHEN 'SUBESTADO' THEN 'Subestado'
          ELSE 'Trazabilidad' END)
      ) AS v(fecha, tipo)
      WHERE v.fecha IS NOT NULL
      ORDER BY v.fecha DESC
      LIMIT 1
    ) g ON true
    -- Un reporte devuelto al tramitador no cuenta: el trámite vuelve a estar en sus manos
    LEFT JOIN (SELECT DISTINCT solicitud_tramite_id FROM tramitadores_reportes_realizado WHERE estado <> 'DEVUELTO') r ON r.solicitud_tramite_id = b.id
    WHERE NOT b.cerrado OR b.creado >= :inicio OR b.finalizado >= :inicio
  `, { type: QueryTypes.SELECT, replacements })

  // DECIMAL y DOUBLE llegan como texto desde Postgres
  return filas.map(f => ({
    ...f,
    valor: Number(f.valor) || 0,
    latitud: f.latitud === null ? null : Number(f.latitud),
    longitud: f.longitud === null ? null : Number(f.longitud)
  }))
}

// Causas de novedad: cada paso a "En espera por novedad" registrado en el período,
// con su tipo de rechazo, entidad y municipio
const consultarCausasNovedad = async (filtros: FiltrosTablero) => {
  const replacements: Record<string, unknown> = { desde: filtros.desde, hasta: filtros.hasta, novedad: EN_NOVEDAD }
  const condiciones = condicionesFiltro(filtros, replacements)

  return db.query<{ tipoRechazo: string | null, entidad: string | null, municipio: string | null }>(`
    SELECT tr.nombre AS "tipoRechazo", en."nombreEntidad" AS entidad, m."nombreMunicipio" AS municipio
    FROM "EstadosTramites" et
    JOIN "Estados" e ON e.id = et."estadoId" AND e."nombreEstado" = :novedad
    JOIN "SolicitudTramites" s ON s.id = et."solicitudTramiteId"
    LEFT JOIN "TiposRechazo" tr ON tr.id = et."tipoRechazoId"
    LEFT JOIN "Entidades" en ON en.id = s."entidadId"
    LEFT JOIN "Municipios" m ON m.id = s."municipiosId"
    WHERE (et."createdAt" AT TIME ZONE 'America/Bogota')::date BETWEEN CAST(:desde AS DATE) AND CAST(:hasta AS DATE)
      ${condiciones.length ? `AND ${condiciones.join(' AND ')}` : ''}
  `, { type: QueryTypes.SELECT, replacements })
}

// Cuántas veces aparece cada valor, de mayor a menor
const contar = (valores: (string | null)[], sinValor: string, maximo = MAXIMO_RANKING) => {
  const conteo = new Map<string, number>()
  for (const v of valores) conteo.set(v ?? sinValor, (conteo.get(v ?? sinValor) ?? 0) + 1)
  return [...conteo].map(([nombre, cantidad]) => ({ nombre, cantidad })).sort((a, b) => b.cantidad - a.cantidad).slice(0, maximo)
}

// Datos de un trámite para las listas de alertas
const resumenTramite = <E extends object = {}>(f: Fila, extra?: E) => ({
  id: f.id,
  cliente: f.cliente,
  tipo: f.tipo,
  placa: f.placa,
  estado: f.estado,
  analista: f.analista,
  tramitador: f.tramitador,
  municipio: f.municipio,
  fechaProgramada: f.fechaProgramada,
  fechaEntrega: f.fechaEntrega,
  ultimaGestion: f.ultimaGestion,
  ultimaGestionTipo: f.ultimaGestionTipo,
  ...(extra as E)
})

export const obtenerTablero = async (filtros: FiltrosTablero, hoy: string, opciones: { sinLimite?: boolean } = {}) => {
  const inicioTendencia = sumarDias(lunesDe(hoy), -7 * (SEMANAS_TENDENCIA - 1))
  const inicio = filtros.desde < inicioTendencia ? filtros.desde : inicioTendencia

  const [filas, causas, reintegros] = await Promise.all([
    consultarFilas(filtros, inicio),
    consultarCausasNovedad(filtros),
    // Reintegros pendientes de Nodex Gastos (por tramitador, sin importar el período)
    obtenerReintegrosPorTramitador({ soloPendientes: true }).catch(error => {
      console.error('Tablero: no se pudieron leer los reintegros de Gastos', error)
      return null
    })
  ])

  // Lista de alerta: total y los primeros (en la exportación a Excel, todos)
  const alerta = <T>(items: T[]) => ({ total: items.length, items: opciones.sinLimite ? items : items.slice(0, MAXIMO_POR_ALERTA) })

  const abiertos = filas.filter(f => !f.cerrado)
  const diasVencido = (f: Fila) => (f.fechaProgramada ? diasEntre(f.fechaProgramada, hoy) - DIAS_GRACIA : 0)
  const esVencido = (f: Fila) => !f.cerrado && f.estado !== EN_NOVEDAD && diasVencido(f) > 0
  const enPeriodo = (fecha: string | null) => !!fecha && fecha >= filtros.desde && fecha <= filtros.hasta
  // Los desistidos no cuentan como finalizados
  const finalizadoEnPeriodo = (f: Fila) => f.estado === 'Finalizado' && enPeriodo(f.finalizado)

  // Métricas de un grupo de trámites (todos, un analista, un tramitador, un cliente…)
  const desempeno = (grupo: Fila[]) => {
    const abiertosG = grupo.filter(f => !f.cerrado)
    const finalizadosG = grupo.filter(finalizadoEnPeriodo)
    const conFecha = finalizadosG.filter(f => f.fechaProgramada)
    const aTiempo = conFecha.filter(f => diasEntre(f.fechaProgramada!, f.finalizado!) <= DIAS_GRACIA)
    const ciclos = finalizadosG.map(f => diasEntre(f.creado, f.finalizado!)).filter(d => d >= 0)
    return {
      abiertos: abiertosG.length,
      vencidos: abiertosG.filter(esVencido).length,
      enNovedad: abiertosG.filter(f => f.estado === EN_NOVEDAD).length,
      finalizados: finalizadosG.length,
      finalizadosConFecha: conFecha.length,
      porcentajeATiempo: conFecha.length ? redondear1((aTiempo.length / conFecha.length) * 100) : null,
      cicloPromedioDias: ciclos.length ? redondear1(ciclos.reduce((s, d) => s + d, 0) / ciclos.length) : null,
      // Honorarios + viáticos de lo finalizado en el período
      valorFinalizado: finalizadosG.reduce((s, f) => s + f.valor, 0)
    }
  }

  // Agrupa por una clave (id) y calcula el desempeño de cada grupo
  const agrupar = (clave: (f: Fila) => number | string | null) => {
    const grupos = new Map<string, Fila[]>()
    for (const f of filas) {
      const k = String(clave(f) ?? 'sin')
      grupos.set(k, [...(grupos.get(k) ?? []), f])
    }
    return [...grupos.values()]
  }

  const indicadores = desempeno(filas)

  // ── Requiere atención ──
  const sinMovimiento = (f: Fila) => diasEntre(f.ultimaActividad, hoy)
  const atencion = {
    vencenHoy: alerta(abiertos.filter(f => f.fechaEntrega === hoy).map(f => resumenTramite(f))),
    vencidos: alerta(abiertos.filter(esVencido)
      .map(f => resumenTramite(f, { diasAtraso: diasVencido(f) }))
      .sort((a, b) => b.diasAtraso - a.diasAtraso)),
    // Todos los que están en novedad (ya no cuentan como vencidos), los que más llevan primero
    enNovedad: alerta(abiertos
      .filter(f => f.estado === EN_NOVEDAD)
      .map(f => resumenTramite(f, { diasEnNovedad: f.ultimoEstado ? diasEntre(f.ultimoEstado, hoy) : 0 }))
      .sort((a, b) => b.diasEnNovedad - a.diasEnNovedad)),
    realizadoSinFinalizar: alerta(abiertos.filter(f => f.reportadoRealizado).map(f => resumenTramite(f))),
    sinTramitador: alerta(abiertos.filter(f => !f.tramitadorId).map(f => resumenTramite(f))),
    sinProgramacion: alerta(abiertos.filter(f => !f.fechaProgramada).map(f => resumenTramite(f))),
    sinMovimiento: alerta(abiertos
      .filter(f => f.estado !== EN_NOVEDAD && sinMovimiento(f) > DIAS_GRACIA)
      .map(f => resumenTramite(f, { diasSinMovimiento: sinMovimiento(f) }))
      .sort((a, b) => b.diasSinMovimiento - a.diasSinMovimiento)),
    sinAnalista: alerta(abiertos.filter(f => !f.analistaId).map(f => resumenTramite(f)))
  }

  // ── Por analista ──
  // Programación en plazo: creados en el período que ya se pueden evaluar
  const programacionEnPlazo = (grupo: Fila[]) => {
    let evaluados = 0, enPlazo = 0
    for (const f of grupo) {
      if (!enPeriodo(f.creado)) continue
      const plazo = sumarDiasHabiles(f.creado, 1)
      if (f.programadoEl) {
        evaluados++
        if (f.programadoEl <= plazo) enPlazo++
      } else if (f.estado !== 'Desistido' && plazo < hoy) {
        evaluados++ // venció el plazo sin programar
      }
    }
    return {
      programacionEvaluados: evaluados,
      programacionEnPlazo: enPlazo,
      porcentajeProgramacionEnPlazo: evaluados ? redondear1((enPlazo / evaluados) * 100) : null
    }
  }

  const porAnalista = agrupar(f => f.analistaId).map(grupo => {
    const { valorFinalizado, finalizadosConFecha, ...metricas } = desempeno(grupo)
    return { analistaId: grupo[0].analistaId, analista: grupo[0].analista ?? 'Sin analista', ...metricas, ...programacionEnPlazo(grupo) }
  }).sort((a, b) => b.abiertos - a.abiertos)

  // ── Por tramitador (con reintegros pendientes de Nodex Gastos) ──
  type ReintegroTramitador = { pendiente: number, gastosConReintegro: number }
  const reintegroDe = new Map<number | null, ReintegroTramitador>(
    (reintegros?.tramitadores ?? []).map(t => [t.tramitadorId, t])
  )
  const porTramitador = agrupar(f => f.tramitadorId).map(grupo => {
    const { valorFinalizado, finalizadosConFecha, ...metricas } = desempeno(grupo)
    const id = grupo[0].tramitadorId
    const reintegro = id ? reintegroDe.get(id) : undefined
    return {
      tramitadorId: id,
      tramitador: grupo[0].tramitador ?? 'Sin tramitador',
      ...metricas,
      realizadoSinFinalizar: grupo.filter(f => !f.cerrado && f.reportadoRealizado).length,
      reintegroPendiente: reintegro?.pendiente ?? 0,
      gastosConReintegro: reintegro?.gastosConReintegro ?? 0
    }
  })
    .filter(t => t.abiertos > 0 || t.finalizados > 0)
    .sort((a, b) => b.abiertos - a.abiertos)

  // ── Por cliente (volumen y valor) ──
  // Por identificación: hay clientes repetidos con nombres distintos (ej: "BANCOLOMBIA SA" y "S.A")
  const porCliente = agrupar(f => f.identificacionCliente?.trim() || f.clienteId).map(grupo => {
    const { abiertos: a, vencidos, finalizados, valorFinalizado, porcentajeATiempo } = desempeno(grupo)
    return {
      clienteId: grupo[0].clienteId,
      cliente: grupo[0].cliente ?? 'Sin cliente',
      identificacion: grupo[0].identificacionCliente,
      abiertos: a,
      vencidos,
      finalizados,
      porcentajeATiempo,
      valorFinalizado
    }
  })
    .filter(c => c.abiertos > 0 || c.finalizados > 0)
    .sort((a, b) => (b.abiertos + b.finalizados) - (a.abiertos + a.finalizados))

  // ── Mapa: abiertos y vencidos por municipio (con coordenadas del municipio) ──
  const porMunicipio = agrupar(f => f.municipioId)
    .map(grupo => {
      const f = grupo[0]
      const abiertosM = grupo.filter(x => !x.cerrado)
      return {
        municipioId: f.municipioId,
        municipio: f.municipio ?? 'Sin municipio',
        departamento: f.departamento,
        latitud: f.latitud,
        longitud: f.longitud,
        abiertos: abiertosM.length,
        vencidos: abiertosM.filter(esVencido).length
      }
    })
    .filter(m => m.abiertos > 0)
    .sort((a, b) => b.abiertos - a.abiertos)

  // ── Causas de novedad en el período ──
  const causasNovedad = {
    total: causas.length,
    porTipo: contar(causas.map(c => c.tipoRechazo), 'Sin tipo de rechazo'),
    porEntidad: contar(causas.map(c => c.entidad), 'Sin entidad', 10),
    porMunicipio: contar(causas.map(c => c.municipio), 'Sin municipio', 10)
  }

  // ── Tendencia semanal: creados vs finalizados ──
  const semanas = Array.from({ length: SEMANAS_TENDENCIA }, (_, i) => sumarDias(inicioTendencia, 7 * i))
  const tendencia = semanas.map(semana => {
    const fin = sumarDias(semana, 6)
    const dentro = (fecha: string | null) => !!fecha && fecha >= semana && fecha <= fin
    return {
      semana,
      creados: filas.filter(f => dentro(f.creado)).length,
      finalizados: filas.filter(f => f.estado === 'Finalizado' && dentro(f.finalizado)).length
    }
  })

  // ── Antigüedad de los abiertos (días desde la creación) ──
  const RANGOS = [
    { clave: '0-7', hasta: 7 },
    { clave: '8-15', hasta: 15 },
    { clave: '16-30', hasta: 30 },
    { clave: '>30', hasta: Infinity }
  ]
  const estadosAbiertos = [...new Set(abiertos.map(f => f.estado))].sort()
  const antiguedad = RANGOS.map((rango, i) => {
    const desdeRango = RANGOS[i - 1]?.hasta ?? -1
    const enRango = abiertos.filter(f => {
      const edad = diasEntre(f.creado, hoy)
      return edad > desdeRango && edad <= rango.hasta
    })
    return {
      rango: rango.clave,
      total: enRango.length,
      porEstado: Object.fromEntries(estadosAbiertos.map(e => [e, enRango.filter(f => f.estado === e).length]))
    }
  })

  return {
    hoy,
    diasGracia: DIAS_GRACIA,
    filtros,
    indicadores,
    atencion,
    porAnalista,
    porTramitador,
    porCliente: opciones.sinLimite ? porCliente : porCliente.slice(0, MAXIMO_RANKING),
    porMunicipio,
    causasNovedad,
    reintegrosDisponibles: reintegros !== null,
    tendencia,
    antiguedad: { estados: estadosAbiertos, rangos: antiguedad }
  }
}

export type TableroTramites = Awaited<ReturnType<typeof obtenerTablero>>
