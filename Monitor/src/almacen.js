'use strict'
// Lo que debe sobrevivir a un reinicio del monitor: las últimas 24 h de mediciones, las alertas
// activas (para no volver a avisarlas) y el historial. Un JSON basta: son unos cientos de KB.
const fs = require('fs')
const path = require('path')

const vacio = () => ({ historia: [], activas: {}, historial: [], eventos: [], ventana: [] })

const cargar = dir => {
  try {
    return { ...vacio(), ...JSON.parse(fs.readFileSync(path.join(dir, 'estado.json'), 'utf8')) }
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('[almacen] estado.json ilegible, se empieza de cero:', error.message)
    return vacio()
  }
}

// Escribir a un temporal y renombrar: si se corta la luz a mitad, queda el archivo anterior entero
const guardar = (dir, estado) => {
  fs.mkdirSync(dir, { recursive: true })
  const destino = path.join(dir, 'estado.json')
  fs.writeFileSync(`${destino}.tmp`, JSON.stringify(estado), { mode: 0o600 })
  fs.renameSync(`${destino}.tmp`, destino)
}

module.exports = { cargar, guardar }
