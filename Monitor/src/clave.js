'use strict'
// Genera MONITOR_CLAVE_HASH: node src/clave.js  (la contraseña no queda en el historial de la terminal)
const crypto = require('crypto')
const readline = require('readline')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl._writeToOutput = texto => { if (texto.includes('Contraseña')) process.stdout.write(texto) }

rl.question('Contraseña del monitor (mínimo 12 caracteres): ', clave => {
  rl.close()
  process.stdout.write('\n')
  if (clave.length < 12) { console.error('Muy corta.'); process.exit(1) }
  const sal = crypto.randomBytes(16)
  const hash = crypto.scryptSync(clave, sal, 64)
  console.log(`MONITOR_CLAVE_HASH=scrypt$${sal.toString('hex')}$${hash.toString('hex')}`)
})
