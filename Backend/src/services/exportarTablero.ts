import XLSX from 'xlsx'
import type { TableroTramites } from './tableroTramites'

// =====================================
// EXCEL DEL TABLERO DE GESTIÓN
// Una hoja por sección, con las listas completas (en pantalla se muestran las 100 primeras)
// =====================================

const NOMBRES_ALERTA: Record<string, string> = {
  vencenHoy: 'Vencen hoy',
  vencidos: 'Vencidos',
  enNovedad: 'En espera por novedad',
  realizadoSinFinalizar: 'Realizado sin finalizar',
  sinTramitador: 'Sin tramitador',
  sinProgramacion: 'Sin programación',
  sinMovimiento: 'Sin movimiento',
  sinAnalista: 'Sin analista'
}

const porcentaje = (valor: number | null) => (valor === null ? '' : valor / 100)

// Hoja con encabezados en español y ancho de columnas según el contenido
const hoja = (filas: Record<string, unknown>[], formatoPorcentaje: string[] = [], formatoMoneda: string[] = []) => {
  const ws = XLSX.utils.json_to_sheet(filas.length ? filas : [{ 'Sin datos': '' }])
  const encabezados = Object.keys(filas[0] ?? { 'Sin datos': '' })
  ws['!cols'] = encabezados.map(e => ({
    wch: Math.min(50, Math.max(e.length, ...filas.map(f => String(f[e] ?? '').length)) + 2)
  }))
  // Formatos de celda por columna
  encabezados.forEach((e, c) => {
    const formato = formatoPorcentaje.includes(e) ? '0.0%' : formatoMoneda.includes(e) ? '"$"#,##0' : null
    if (!formato) return
    for (let r = 1; r <= filas.length; r++) {
      const celda = ws[XLSX.utils.encode_cell({ r, c })]
      if (celda && typeof celda.v === 'number') celda.z = formato
    }
  })
  return ws
}

export const generarExcelTablero = (t: TableroTramites, alcance: string) => {
  const libro = XLSX.utils.book_new()
  const i = t.indicadores

  XLSX.utils.book_append_sheet(libro, hoja([
    { Indicador: 'Alcance', Valor: alcance },
    { Indicador: 'Período', Valor: `${t.filtros.desde} a ${t.filtros.hasta}` },
    { Indicador: 'Generado', Valor: t.hoy },
    { Indicador: 'Abiertos', Valor: i.abiertos },
    { Indicador: `Vencidos (más de ${t.diasGracia} días desde la programación, sin contar los de novedad)`, Valor: i.vencidos },
    { Indicador: 'En espera por novedad', Valor: i.enNovedad },
    { Indicador: 'Finalizados en el período', Valor: i.finalizados },
    { Indicador: '% a tiempo', Valor: i.porcentajeATiempo === null ? '' : `${i.porcentajeATiempo} %` },
    { Indicador: 'Ciclo promedio (días)', Valor: i.cicloPromedioDias ?? '' },
    { Indicador: 'Valor finalizado (honorarios + viáticos)', Valor: i.valorFinalizado }
  ]), 'Resumen')

  for (const [clave, lista] of Object.entries(t.atencion)) {
    XLSX.utils.book_append_sheet(libro, hoja(lista.items.map((x: any) => ({
      'Trámite': x.id,
      'Tipo': x.tipo ?? '',
      'Cliente': x.cliente ?? '',
      'Placa / matrícula': x.placa ?? '',
      'Municipio': x.municipio ?? '',
      'Estado': x.estado,
      'Analista': x.analista ?? '',
      'Tramitador': x.tramitador ?? '',
      'Fecha programada': x.fechaProgramada ?? '',
      'Entrega del resultado': x.fechaEntrega ?? '',
      'Última gestión': x.ultimaGestion ?? '',
      'Tipo de última gestión': x.ultimaGestionTipo ?? '',
      ...(x.diasEnNovedad !== undefined ? { 'Días en novedad': x.diasEnNovedad } : {}),
      ...(x.diasAtraso !== undefined ? { 'Días de atraso': x.diasAtraso } : {}),
      ...(x.diasSinMovimiento !== undefined ? { 'Días sin movimiento': x.diasSinMovimiento } : {})
    }))), NOMBRES_ALERTA[clave] ?? clave)
  }

  XLSX.utils.book_append_sheet(libro, hoja(t.porAnalista.map(a => ({
    'Analista': a.analista,
    'Abiertos': a.abiertos,
    'Vencidos': a.vencidos,
    'En novedad': a.enNovedad,
    'Finalizados': a.finalizados,
    '% a tiempo': porcentaje(a.porcentajeATiempo),
    'Ciclo promedio (días)': a.cicloPromedioDias ?? '',
    '% programación en plazo (1 día hábil)': porcentaje(a.porcentajeProgramacionEnPlazo),
    'Programados en plazo': a.programacionEnPlazo,
    'Evaluados': a.programacionEvaluados
  })), ['% a tiempo', '% programación en plazo (1 día hábil)']), 'Por analista')

  XLSX.utils.book_append_sheet(libro, hoja(t.porTramitador.map(x => ({
    'Tramitador': x.tramitador,
    'Abiertos': x.abiertos,
    'Vencidos': x.vencidos,
    'En novedad': x.enNovedad,
    'Finalizados': x.finalizados,
    '% a tiempo': porcentaje(x.porcentajeATiempo),
    'Realizado sin finalizar': x.realizadoSinFinalizar,
    'Reintegro pendiente': x.reintegroPendiente,
    'Gastos con reintegro': x.gastosConReintegro
  })), ['% a tiempo'], ['Reintegro pendiente']), 'Por tramitador')

  XLSX.utils.book_append_sheet(libro, hoja(t.porCliente.map(c => ({
    'Cliente': c.cliente,
    'Identificación': c.identificacion ?? '',
    'Abiertos': c.abiertos,
    'Vencidos': c.vencidos,
    'Finalizados': c.finalizados,
    '% a tiempo': porcentaje(c.porcentajeATiempo),
    'Valor finalizado': c.valorFinalizado
  })), ['% a tiempo'], ['Valor finalizado']), 'Por cliente')

  XLSX.utils.book_append_sheet(libro, hoja(t.porMunicipio.map(m => ({
    'Municipio': m.municipio,
    'Departamento': m.departamento ?? '',
    'Abiertos': m.abiertos,
    'Vencidos': m.vencidos
  }))), 'Por municipio')

  XLSX.utils.book_append_sheet(libro, hoja([
    ...t.causasNovedad.porTipo.map(c => ({ 'Agrupado por': 'Tipo de rechazo', 'Nombre': c.nombre, 'Novedades': c.cantidad })),
    ...t.causasNovedad.porEntidad.map(c => ({ 'Agrupado por': 'Entidad', 'Nombre': c.nombre, 'Novedades': c.cantidad })),
    ...t.causasNovedad.porMunicipio.map(c => ({ 'Agrupado por': 'Municipio', 'Nombre': c.nombre, 'Novedades': c.cantidad }))
  ]), 'Causas de novedad')

  XLSX.utils.book_append_sheet(libro, hoja(t.tendencia.map(s => ({
    'Semana del': s.semana,
    'Creados': s.creados,
    'Finalizados': s.finalizados
  }))), 'Tendencia semanal')

  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
