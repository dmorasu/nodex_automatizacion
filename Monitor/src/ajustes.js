'use strict'
// Ajustes que se cambian desde el panel (IPs conocidas, puertos permitidos y alertas ocultas).
// Van en ajustes.json junto a estado.json porque /opt/nodex-monitor es de root y nodexmon solo lo lee.
// Se suman a lo del .env: lo del .env no se puede quitar desde el panel.
const fs = require('fs')
const path = require('path')

const IP = /^(\d{1,3}\.){1,3}(\d{1,3}|)$|^[0-9a-f:]{2,39}$/i
const vacio = () => ({ ipsConocidas: [], puertosPermitidos: [], ocultas: {} })

const crearAjustes = config => {
  const archivo = path.join(config.dirDatos, 'ajustes.json')
  // Lo del .env, para no perderlo al recalcular
  const base = { ipsConocidas: [...config.ipsConocidas], puertosPermitidos: [...config.puertosPermitidos] }
  let datos = vacio()
  try {
    datos = { ...vacio(), ...JSON.parse(fs.readFileSync(archivo, 'utf8')) }
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('[ajustes] ajustes.json ilegible, se empieza de cero:', error.message)
  }

  // Las reglas leen config.ipsConocidas y config.puertosPermitidos: se reemplazan en el mismo objeto
  const aplicar = () => {
    config.ipsConocidas = [...new Set([...base.ipsConocidas, ...datos.ipsConocidas])]
    config.puertosPermitidos = [...new Set([...base.puertosPermitidos, ...datos.puertosPermitidos])]
  }

  const guardar = () => {
    fs.mkdirSync(config.dirDatos, { recursive: true })
    fs.writeFileSync(`${archivo}.tmp`, JSON.stringify(datos, null, 2), { mode: 0o600 })
    fs.renameSync(`${archivo}.tmp`, archivo)
    aplicar()
  }

  aplicar()

  return {
    oculta: id => Boolean(datos.ocultas[id]),
    resumen: () => ({
      env: base,
      panel: { ipsConocidas: datos.ipsConocidas, puertosPermitidos: datos.puertosPermitidos },
      ocultas: Object.entries(datos.ocultas).map(([id, o]) => ({ id, ...o })).sort((a, b) => b.cuando - a.cuando)
    }),
    agregarIp: ip => {
      ip = String(ip || '').trim()
      if (!IP.test(ip)) throw new Error('IP no válida')
      if (!datos.ipsConocidas.includes(ip)) datos.ipsConocidas.push(ip)
      guardar()
    },
    quitarIp: ip => { datos.ipsConocidas = datos.ipsConocidas.filter(x => x !== ip); guardar() },
    agregarPuerto: puerto => {
      puerto = Number(puerto)
      if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) throw new Error('Puerto no válido')
      if (!datos.puertosPermitidos.includes(puerto)) datos.puertosPermitidos.push(puerto)
      guardar()
    },
    quitarPuerto: puerto => { datos.puertosPermitidos = datos.puertosPermitidos.filter(x => x !== Number(puerto)); guardar() },
    ocultar: (id, titulo, usuario) => {
      if (typeof id !== 'string' || !id || id.length > 200) throw new Error('Alerta no válida')
      datos.ocultas[id] = { titulo: String(titulo || id).slice(0, 300), usuario, cuando: Date.now() }
      guardar()
    },
    mostrar: id => { delete datos.ocultas[id]; guardar() }
  }
}

module.exports = { crearAjustes }
