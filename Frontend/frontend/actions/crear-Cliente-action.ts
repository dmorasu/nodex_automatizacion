"use server";

import { encabezadosSesion } from "@/src/lib/sesionApi"
import { ErrorResponoseSchema, CrearClienteSchema, SuccessSchema } from "@/src/schemas";
import { success } from "zod";
type ActionStateType={
    errors:string[],
    success:string

} 
export async function crearCliente(prevSatate:ActionStateType,formData: FormData) {
  const datosCliente = CrearClienteSchema.safeParse({
    nombreCliente: formData.get("nombreCliente"),
    identificacionCliente: formData.get("identificacionCliente"),
    telefono: formData.get("telefono"),
    telefonoMovil: formData.get("telefonoMovil"),
  });
  // Valdacion
  

  

  if(!datosCliente.success){
     return {
            errors: datosCliente.error.issues.map(issue => issue.message),
            success: ''
        }

  }
  

  const url = `${process.env.API_URL}/clientes`;
  const req = await fetch(url, {
    method: "POST",
    headers: {
      ...(await encabezadosSesion()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nombreCliente: datosCliente.data.nombreCliente,
      identificacionCliente: datosCliente.data.identificacionCliente,
      telefono: datosCliente.data.telefono, 
      telefonoMovil: datosCliente.data.telefonoMovil
      
    }),
  });

 
  
  const json= await req.json()
  const success = SuccessSchema.parse(json)

    return {
        errors: [],
        success: success
    }
  

}
