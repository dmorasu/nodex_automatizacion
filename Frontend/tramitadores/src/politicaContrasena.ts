// Política de contraseñas: la misma del backend (Backend/src/utils/politicaContrasena.ts) y la de Nodex Trámites.
// Aquí sirve para mostrar los requisitos mientras se escribe y avisar antes de enviar.

export const MINIMO_CONTRASENA = 8

export const REGLAS_CONTRASENA: { cumple: (c: string) => boolean, texto: string }[] = [
  { cumple: c => c.length >= MINIMO_CONTRASENA, texto: `Mínimo ${MINIMO_CONTRASENA} caracteres` },
  { cumple: c => /[A-ZÁÉÍÓÚÑ]/.test(c), texto: "Una mayúscula" },
  { cumple: c => /[a-záéíóúñ]/.test(c), texto: "Una minúscula" },
  { cumple: c => /\d/.test(c), texto: "Un número" },
  { cumple: c => /[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s]/.test(c), texto: "Un carácter especial (! @ # $ % * . -)" }
]

// Lo que le falta (vacío = cumple)
export const faltantesContrasena = (contrasena: string) => {
  const faltan = REGLAS_CONTRASENA.filter(r => !r.cumple(contrasena)).map(r => r.texto.toLowerCase())
  if (contrasena !== contrasena.trim()) faltan.push("sin espacios al inicio ni al final")
  return faltan
}

export const errorContrasena = (contrasena: string) => {
  const faltan = faltantesContrasena(contrasena)
  return faltan.length ? `La contraseña debe tener: ${faltan.join(", ")}` : null
}
