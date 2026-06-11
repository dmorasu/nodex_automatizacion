"use server";

import {
  ErrorResponoseSchema,
  SuccessSchema,
  ProgramacionSchema
} from "@/src/schemas";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

type ActionStateType = {
  errors: string[];
  success: string;
};

export default async function CrearProgramacion(
  solicitudTramiteId: number,
  prevState: ActionStateType,
  formData: FormData
) {

  const valorTramite = formData.get("valorTramite")?.toString() ?? "";
  const valorViaticos = formData.get("valorViaticos")?.toString() ?? "";

  const programacionData = {
    solicitudTramiteId,

    fechaProbableEntrega:
      formData.get("fechaProbableEntrega")?.toString() ?? "",

    valorTramite:
      valorTramite.trim() === ""
        ? 0
        : Number(valorTramite),

    valorViaticos:
      valorViaticos.trim() === ""
        ? 0
        : Number(valorViaticos),

    conceptoHonorarios:
      formData.get("conceptoHonorarios")?.toString() ?? "",

    conceptoViaticos:
      formData.get("conceptoViaticos")?.toString() ?? "",

    requiereCita:
      formData.get("requiereCita") === "true",

    fechaCita:
      formData.get("fechaCita")?.toString() || null,

    horaCita:
      formData.get("horaCita")?.toString() || null
  };

  console.log("PROGRAMACION DATA:", programacionData);

  const programacion = ProgramacionSchema.safeParse({
    fechaProbableEntrega: programacionData.fechaProbableEntrega,
    conceptoHonorarios: programacionData.conceptoHonorarios,
    valorTramite: programacionData.valorTramite
  });

  if (!programacion.success) {
    return {
      errors: programacion.error.issues.map(issue => issue.message),
      success: ""
    };
  }

  const token = cookies().get("TOKEN")?.value;

  const url = `${process.env.API_URL}/solicitudTramites/${solicitudTramiteId}/programacion`;

  try {
    const req = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(programacionData)
    });

    const responseText = await req.text();

    let json;

    try {
      json = JSON.parse(responseText);
    } catch {
      json = { error: responseText };
    }

    console.log("RESPUESTA:", json);

    if (!req.ok) {
      if (typeof json === "object" && json?.error) {
        return {
          errors: [json.error],
          success: ""
        };
      }

      return {
        errors: ["Hubo un error al guardar la programación"],
        success: ""
      };
    }

    revalidatePath(`/center/solicitudTramites/${solicitudTramiteId}`);

    const success = SuccessSchema.parse(json);

    return {
      errors: [],
      success
    };

  } catch (error) {
    console.error("ERROR PROGRAMACION ACTION:", error);

    return {
      errors: ["Error de conexión con el servidor"],
      success: ""
    };
  }
}