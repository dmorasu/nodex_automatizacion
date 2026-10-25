import type { FormEvent } from "react"

// React 19 vacía el <form action={...}> al terminar el envío, aunque el servidor
// responda con errores, y se perdía lo escrito. Cancelar el evento reset deja el
// formulario como en React 18 (los modales se cierran solos al guardar).
export const conservarCampos = (evento: FormEvent<HTMLFormElement>) => evento.preventDefault()
