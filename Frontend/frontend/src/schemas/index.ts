import { array, nullable, z, ZodString } from 'zod'
import { id } from 'zod/v4/locales'

export const RegistroSchema = z.object({
        correoUsuario: z.string().
                min(1, { message: 'El correo es obligatorio' })
                .email({ message: 'email no valido' }),
        nombreUsuario: z.string()
                .min(1, { message: 'El nombre no puede estar vacio' }),
        contrasena: z.string()
                .min(8, { message: 'La contraseña debe tener minimo 8 Caracteres' }),
        confirmacion_contrasena: z.string()


}).refine((data) => data.contrasena === data.confirmacion_contrasena, {
        message: 'Las contraseña no coincide',
        path: ['confirmacion_contrasena']


})

export const inicioSesionSchema = z.object({
        correoUsuario: z.string()
                .min(1, { message: 'El correo es Obligatorio' })
                .email({ message: 'correo  no válido' }),
        contrasena: z.string()
                .min(1, { message: 'La contraseña no puede ir vacia' })
})

export const CrearSolicitudSchema = z.object({
        detalleSolicitud: z.string()
                .min(1, { message: 'El detalle de la solicitud no puede estar vacio' }),
        /* amount: z.coerce. --> Me sirve para convertir de string a int para validacion 
                 number({message: 'Cantidad no válida'})*/
        direccionTramite: z.string()
                .min(1, { message: 'La direccion de Diligencia no puede estar vacia' }),
        municipiosId: z.string()
                .min(1, { message: 'El municipio no puede estar vacio' }),
        clienteId: z.string()
                .min(1, { message: 'El cliente no puede estar vacio' }),
        operacionesId: z.string()
                .min(1, { message: 'Debe Seleccionar la Operacion' }),
        fechaEntregaResultado: z.string()
                .min(1, "Debe seleccionar la fecha de entrega")
                .transform((value) => new Date(value)),
        tramiteId: z.string()
                .min(1, { message: 'El trámite no puede estar vacio.' }),
        placa: z.string().optional().nullable(),
        matriculaInmobiliaria: z.string().optional().nullable(),
        entidadId:z.string()
                  .min(1, { message: 'La Entidad no puede estar vacio' }),
        
        usuarioId:z.string()
                  .min(1, { message: 'El Usuario no puede estar vacio' }),
        
        
       



})
export const EditarSolicitudSchema = z.object({
        detalleSolicitud: z.string()
                .min(1, { message: 'El detalle de la solicitud no puede estar vacio' }),
        /* amount: z.coerce. --> Me sirve para convertir de string a int para validacion 
                 number({message: 'Cantidad no válida'})*/
        direccionTramite: z.string()
                .min(1, { message: 'La direccion de Diligencia no puede estar vacia' }),
        municipiosId: z.string()
                .min(1, { message: 'El municipio no puede estar vacio' }),
        clienteId: z.string()
                .min(1, { message: 'El cliente no puede estar vacio' }),
        operacionesId: z.string()
                .min(1, { message: 'Debe Seleccionar la Operacion' }),
        fechaEntregaResultado: z.string()
                .min(1, "Debe seleccionar la fecha de entrega")
                .transform((value) => new Date(value)),
        tramiteId: z.string()
                .min(1, { message: 'El trámite no puede estar vacio.' }),
        placa: z.string().optional().nullable(),
        matriculaInmobiliaria: z.string().optional().nullable(),
        entidadId:z.string()
                  .min(1, { message: 'La Entidad no puede estar vacio' }),
     
    
        
        
       



})

export const CrearClienteSchema = z.object({
        nombreCliente: z.string()
                .min(1, { message: 'El nombre del Cliente no puede estar vacio' }),
        identificacionCliente: z.string()
                .min(1, { message: 'La identificacion del Cliente no puede estar vacia' }),
        telefono: z.string()
                .min(1, { message: 'El telefono no puede estar vacio' }),
        telefonoMovil: z.string()
                .min(1, { message: 'El telefonoMovi no puede estar vacio' }),

})

export const ContrasenaValidacionSchema = z.string().min(1, { message: 'Ingrese una contraseña' })


export const SuccessSchema = z.string()
export const ErrorResponoseSchema = z.object({
        error: z.string()
})

export const UserSchema = z.object({
        id: z.number(),
        nombreUsuario: z.string(),
        correoUsuario: z.string().email()
})

export const ClienteSchema = z.object({
        id: z.number(),
        nombreCliente: z.string()
})

export const TramitadorSchema=z.object({
        id:z.number(),
        nombreTramitador:z.string()
})

export const MunicipioSchema = z.object({
        id: z.number(),
        nombreMunicipio: z.string(),
        responsable:z.string()
})


export const EstadosSchema = z.object({
        id: z.number(),
        nombreEstado: z.string()
})

export const estadosTramites = z.object({
        id: z.number(),
        estado: z.object({
                nombreEstado: z.string()
        })




})




export const Trazabilidad = z.object({
        id: z.number(),
        observacionTrazabilidad: z.string(),
        nombreUsuario: z.string(),
        createdAt: z.string()


})

export const Programacion = z.object({
        id: z.number(),

        fechaProbableEntrega: z.string().nullable().optional(),
        fechaFinalizacionServicio: z.string().nullable().optional(),
        fechaRealizacionDiligencia: z.string().nullable().optional(),

        valorTramite: z.string().nullable().optional(),
        valorViaticos: z.string().nullable().optional(),

        conceptoViaticos: z.string().nullable().optional(),
        conceptoHonorarios: z.string().nullable().optional(),

        requiereCita: z.boolean().optional(),

        fechaCita: z.string().nullable().optional(),

        horaCita: z.string().nullable().optional()
})

export const logistica = z.object({
  id: z.number(),

  numeroGuia: z.string().nullable().optional(),

  valorEnvio: z.string().nullable().optional(),
  destinatario: z.string().nullable().optional(),

  transportadoraId: z.number().nullable().optional(),

  fechaProgramacionLogistica: z.string().nullable().optional(),

  fechaEntregaTransportadora: z.string().nullable().optional(),

  transportadora: z.object({
    nombreTransportadora: z.string()
  }).optional().nullable()
})

export const  cuentaCobroSchema =z.object({
        
        fechaRecibidaCuentaCobroTramitador: z.string()
                .min(1, { message: 'La fecha de recibida no puede estar vacia' }),
        numeroCuentaCobro: z.string()
                .min(1, { message: 'Ingrese un numero de Cuenta de Cobro' }),
        valorCuentaCobro: z.string()
                .min(1, { message: 'El Valor de la cuenta de Cobro no puede estar cero' }),
                fechaMaximaPagoCuentaCobro: z.string().nullable().optional()
        
       
        
        

})

export const Entidad =z.object({
        id: z.number(),
        nombreEntidad:z.string()

})

export const operaciones =z.object({
        id:z.number(),
        nombreOperacion:z.string(),
        centroDeCostos:z.string().nullable().optional()
})

export const Tramites =z.object({
        id:z.number(),
        nombreTramite:z.string(),
        responsable:z.string().nullable().optional()
       
})

export const TrazabilidadSchema = z.object({
        observacionTrazabilidad: z.string()
                .min(1, { message: "Debe registar alguna observacion" }),

})

export const CuentaCobro = z.object({
        solicitudTramiteId: z.number(),

        fechaRadicacionCuentaCobro: z.string().nullable().optional(),
        fechaMaximaPagoCuentaCobro: z.string().nullable().optional(),

        fechaRecibidaCuentaCobroTramitador: z.string().nullable().optional(),
        fechaPagoCuentaCobro: z.string().nullable().optional(),
        numeroCuentaCobro: z.string().nullable().optional(),
        valorCuentaCobro: z.coerce.number().nullable().optional()
})
const emptyToNull = (val: unknown) => (val === "" ? null : val);
export const logisticaApiSchema = z.object({
        numeroGuia: z.preprocess(emptyToNull, z.string().nullable().optional()),
        valorEnvio: z.preprocess(emptyToNull, z.coerce.number().nullable().optional()),
        horaProgramda: z.preprocess(emptyToNull, z.string().nullable().optional()),
        fechaProgramacionLogistica: z.preprocess(emptyToNull, z.string().nullable().optional()),
        fechaEntregaTransportadora: z.preprocess(emptyToNull, z.string().nullable().optional()),


})

export const transportadoraSchema= z.object({
        id:z.number(),
        nombreTransportadora:z.string()

})
export const transportadorasSchema = z.array(transportadoraSchema)
export const logisticaSchema =z.object({
         numeroGuia:  z.string()
                .min(1, "Debe Digitar el nuemro de guia")
})


export const ProgramacionSchema = z.object({

        fechaProbableEntrega: z.string()
                .min(1, "Debe seleccionar la fecha de Entrega"),
        conceptoHonorarios: z.string()
                .min(1, "Debe inserta el concepto de los Honorarios"),
        valorTramite:z.number().min(0,"Debe ingresar el Valor del Trámite")

})

export const OperacionSchema = z.object({
  id: z.number(),
  nombreOperacion: z.string(),
  centroDeCostos:z.string().nullable().optional()
});
export const OperacionesSchema = z.array(OperacionSchema);

export const TramiteSchema= z.object({
        id:z.number(),
        nombreTramite:z.string()
});

export const TramitesSchema =z.array(TramiteSchema);

export const EntidadSchema = z.object({
  id: z.number(),
  nombreEntidad: z.string()
});
export const EntidadesSchema = z.array(EntidadSchema);




export const UsuarioSchema = z.object({
        id: z.number(),
        nombreUsuario: z.string(),
        correoUsuario: z.string()
})

export const SolicitudAPIRespuestaSchema = z.object({
  id: z.number(),
  detalleSolicitud: z.string(),
  direccionTramite: z.string(),
tramiteId: z.number(),
  fechaEntregaResultado: z.string().nullable(),
  matriculaInmobiliaria: z.string().nullable(),
  placa: z.string().nullable(),

  createdAt: z.string(),
  updatedAt: z.string(),

  clientes: ClienteSchema.optional(),
  usuario: UsuarioSchema.optional().nullable(),
  municipios: MunicipioSchema.optional(),

  estadosTramites: z.array(estadosTramites).optional(),

  trazabilidad: z.array(Trazabilidad).optional(),

  programacion: Programacion.optional().nullable(),

  logistica: logistica.optional().nullable(),

  cuentaCobro: CuentaCobro.optional().nullable(),
  operaciones: operaciones.optional().nullable(),
  entidad: Entidad.optional().nullable(),
  tramite: Tramites.optional().nullable(),
  tramitador: TramitadorSchema.optional().nullable()

})
        .passthrough()
export const SolicitudesPaginadasSchema = z.object({
        data: z.array(SolicitudAPIRespuestaSchema),
        total: z.number(),
        totalPages: z.number(),
        currentPage: z.number(),
}).passthrough();

export const EstadoTramitesSchema = z.object({
        estadoId: z.coerce.number().
                min(1, { message: "Debe selecionar un Estado" }),


}

)

export const SolicitudesAPIRespuestaSchema = z.array(SolicitudAPIRespuestaSchema)

export type Usuario = z.infer<typeof UserSchema>
export type SolicitudTramites = z.infer<typeof SolicitudAPIRespuestaSchema>
export type SolicitudType = z.infer<typeof SolicitudAPIRespuestaSchema> 