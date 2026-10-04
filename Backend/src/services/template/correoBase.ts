// =====================================
// BASE DE LOS CORREOS DE NODEX
// Tarjeta blanca sobre gris claro, franja con el degradado del módulo y textos en slate.
// Solo tablas y estilos en línea: es lo que respetan Gmail, Outlook y los celulares.
// =====================================

export type Marca = {
  nombre: string     // "Nodex Gastos" (pie del correo)
  modulo: string     // "GASTOS", "TRÁMITES"
  color: string      // color principal (textos de marca, montos, botón)
  oscuro: string     // final del degradado
  claro: string      // inicio del degradado
}

export const MARCAS = {
  GASTOS: { nombre: 'Nodex Gastos', modulo: 'GASTOS', color: '#059669', oscuro: '#0f766e', claro: '#34d399' },   // esmeralda → teal
  TRAMITES: { nombre: 'Nodex Trámites', modulo: 'TRÁMITES', color: '#0284c7', oscuro: '#0369a1', claro: '#38bdf8' } // sky-400 → sky-700 (el azul de la app)
} satisfies Record<string, Marca>

export type Tono = 'info' | 'exito' | 'alerta' | 'peligro' | 'neutro'

const TONOS: Record<Tono, { fondo: string, color: string, borde: string }> = {
  info: { fondo: '#f0f9ff', color: '#0369a1', borde: '#bae6fd' },     // sky
  exito: { fondo: '#ecfdf5', color: '#047857', borde: '#a7f3d0' },    // emerald
  alerta: { fondo: '#fffbeb', color: '#b45309', borde: '#fde68a' },   // amber
  peligro: { fondo: '#fef2f2', color: '#b91c1c', borde: '#fecaca' },  // red
  neutro: { fondo: '#f8fafc', color: '#475569', borde: '#e2e8f0' }    // slate
}

export const COLOR = {
  fondo: '#f8fafc',        // slate-50
  borde: '#e2e8f0',        // slate-200
  texto: '#1e293b',        // slate-800
  textoSuave: '#64748b',   // slate-500
  etiqueta: '#94a3b8'      // slate-400
}

const FUENTE = `-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`

// Escapa texto del usuario antes de ponerlo en el HTML del correo
export const html = (texto: unknown) =>
  String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

// ── Piezas ─────────────────────────────────

// [etiqueta, valor ya escapado]. Los valores vacíos no se muestran
export type Detalle = [string, string | number | null | undefined]

const visible = (valor: Detalle[1]) => valor !== null && valor !== undefined && valor !== ''

// Detalles en dos columnas
export const gridDetalles = (detalles: Detalle[]) => {
  const visibles = detalles.filter(([, valor]) => visible(valor))
  const filas: string[] = []
  for (let i = 0; i < visibles.length; i += 2) {
    filas.push(`<tr>${visibles.slice(i, i + 2).map(([etiqueta, valor]) => `
      <td width="50%" valign="top" style="padding: 6px 8px 6px 0;">
        <div style="font-size: 10px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase; color: ${COLOR.etiqueta};">${etiqueta}</div>
        <div style="font-size: 13px; line-height: 1.45; color: ${COLOR.texto}; padding-top: 2px;">${valor}</div>
      </td>`).join('')}</tr>`)
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas.join('')}</table>`
}

// Tarjeta con borde: encabezado opcional (título, subtítulo y valor a la derecha) y detalles
export const ficha = ({ titulo, subtitulo, valor, colorValor, detalles }: {
  titulo?: string, subtitulo?: string, valor?: string, colorValor?: string, detalles: Detalle[]
}) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid ${COLOR.borde}; border-radius: 12px; margin-top: 12px;">
    ${titulo ? `
    <tr>
      <td style="padding: 16px 20px 4px;">
        <div style="font-size: 15px; font-weight: 700; color: ${COLOR.texto};">${titulo}</div>
        ${subtitulo ? `<div style="font-size: 13px; color: ${COLOR.textoSuave}; padding-top: 2px;">${subtitulo}</div>` : ''}
      </td>
      <td align="right" valign="top" style="padding: 16px 20px 4px; font-size: 16px; font-weight: 700; color: ${colorValor ?? COLOR.texto}; white-space: nowrap;">${valor ?? ''}</td>
    </tr>` : ''}
    <tr>
      <td colspan="2" style="padding: ${titulo ? '4px' : '12px'} 20px 14px;">${gridDetalles(detalles)}</td>
    </tr>
  </table>`

// Bloque de texto destacado (observación, acción requerida…)
export const nota = (tono: Tono, contenido: string, titulo?: string) => {
  const t = TONOS[tono]
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px; background: ${t.fondo}; border: 1px solid ${t.borde}; border-radius: 12px;">
    <tr>
      <td style="padding: 14px 18px; font-size: 13px; line-height: 1.6; color: ${t.color};">
        ${titulo ? `<div style="font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; padding-bottom: 4px;">${titulo}</div>` : ''}
        ${contenido}
      </td>
    </tr>
  </table>`
}

// Total en grande sobre fondo gris
export const resumen = (etiqueta: string, valor: string, lateral?: string) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${COLOR.fondo}; border-radius: 12px;">
    <tr>
      <td style="padding: 18px 20px;">
        <div style="font-size: 12px; color: ${COLOR.textoSuave};">${etiqueta}</div>
        <div style="font-size: 26px; font-weight: 800; color: ${COLOR.texto}; letter-spacing: -0.5px; padding-top: 2px;">${valor}</div>
      </td>
      ${lateral ? `<td align="right" style="padding: 18px 20px; font-size: 13px; color: ${COLOR.textoSuave}; white-space: nowrap;">${lateral}</td>` : ''}
    </tr>
  </table>`

// ── Correo completo ────────────────────────

export type DatosCorreo = {
  marca: Marca
  estado: { texto: string, tono: Tono }
  titulo: string          // texto plano (se escapa)
  saludo?: string         // HTML
  intro?: string          // HTML
  cuerpo: string          // HTML
  preencabezado?: string  // texto plano que el buzón muestra junto al asunto
  boton?: { texto: string, url?: string | null }
}

export const correoBase = ({ marca, estado, titulo, saludo, intro, cuerpo, preencabezado, boton }: DatosCorreo) => {
  const tono = TONOS[estado.tono]
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${html(titulo)}</title>
</head>
<body style="margin: 0; padding: 0; background: ${COLOR.fondo}; font-family: ${FUENTE}; -webkit-font-smoothing: antialiased;">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">${html(preencabezado ?? titulo)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${COLOR.fondo};">
    <tr>
      <td align="center" style="padding: 32px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background: #ffffff; border: 1px solid ${COLOR.borde}; border-radius: 16px; font-family: ${FUENTE};">
          <tr>
            <td style="height: 4px; line-height: 4px; font-size: 0; background-color: ${marca.color}; background-image: linear-gradient(90deg, ${marca.claro}, ${marca.color}, ${marca.oscuro}); border-radius: 16px 16px 0 0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding: 28px 32px 0;">
              <span style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: ${marca.color};">Nodex</span>
              <span style="font-size: 10px; font-weight: 700; letter-spacing: 3px; color: ${marca.oscuro}; padding-left: 6px;">${marca.modulo}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px 0;">
              <span style="display: inline-block; padding: 4px 10px; border-radius: 999px; background: ${tono.fondo}; color: ${tono.color}; font-size: 11px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase;">${html(estado.texto)}</span>
              <h1 style="margin: 12px 0 0; font-size: 22px; line-height: 1.3; font-weight: 700; color: ${COLOR.texto}; letter-spacing: -0.3px;">${html(titulo)}</h1>
              ${saludo ? `<p style="margin: 14px 0 0; font-size: 14px; line-height: 1.6; color: ${COLOR.texto};">${saludo}</p>` : ''}
              ${intro ? `<p style="margin: 4px 0 0; font-size: 14px; line-height: 1.6; color: ${COLOR.textoSuave};">${intro}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 32px 20px;">${cuerpo}</td>
          </tr>
          ${boton?.url ? `
          <tr>
            <td style="padding: 4px 32px 4px;">
              <a href="${html(boton.url)}" style="display: inline-block; padding: 11px 22px; border-radius: 10px; background: ${marca.color}; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none;">${html(boton.texto)}</a>
            </td>
          </tr>` : ''}
          <tr>
            <td style="padding: 20px 32px 28px;">
              <div style="border-top: 1px solid ${COLOR.borde}; padding-top: 16px; font-size: 12px; line-height: 1.5; color: ${COLOR.etiqueta};">
                ${marca.nombre} · Gómez Pineda Abogados<br>
                Mensaje automático, por favor no responder.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
