// Números de WhatsApp de los tramitadores y mensajeros: se guardan con el indicativo y sin "+"
// (573001234567), como los ya registrados. Hasta el 2026-11-04 se aceptaba cualquier número de
// 10 a 15 dígitos y los mensajeros quedaron con 0000000000: los WhatsApp salían a Twilio, que
// los rechazaba, y nadie se enteraba (pedido del usuario: "a los mensajeros no les llega").

// Solo dígitos; un celular de 10 dígitos sin indicativo recibe el 57
export const normalizarWhatsapp = (valor: unknown) => {
  const digitos = String(valor ?? '').replace(/\D/g, '')
  return /^3\d{9}$/.test(digitos) ? `57${digitos}` : digitos
}

// Celular colombiano: 57 + 3 + 9 dígitos
export const whatsappValido = (valor: unknown) => /^573\d{9}$/.test(normalizarWhatsapp(valor))
