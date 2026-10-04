// Error de negocio con su código HTTP. Los controladores lo responden
// tal cual; cualquier otro error se responde como 500.
export class ErrorGastos extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}
