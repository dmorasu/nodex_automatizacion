// app.ts
import express from 'express'
import colors from 'colors'
import morgan from 'morgan'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { db } from './config/db'


// Routers existentes
import usuarioRouter from "./routes/usuarioRouter"
import entidadRouter from "./routes/entidadRouter"
import clienteRouter from "./routes/clienteRouter"
import municipiosRouter from "./routes/municipiosRouter"
import operacionesRouter from "./routes/operacionesRouter"
import tarifaRouter from "./routes/tarifaRouter"
import tramitadorRouter from "./routes/tramitadorRouter"
import transportadoraRouter from "./routes/transportadoraRouter"
import solicitudTramiteRouter from "./routes/solicitudTramiteRouter"
import estadosRouter from './routes/estadosRouter'
import authRouter from './routes/authRouter'
import tramiteRouter from './routes/tramiteRouter'
import evaluacionRoutes from "./routes/evaluacionRouter"
import tramitadorActualizacionesRouter from './routes/tramitadorBulkRouter'
import logisticaBulkRouter from './routes/logisticaBulkRouter'
import programacionActualizacionesRouter from './routes/programacionBulkRouter'
import trazabilidadActualizacionesRouter from './routes/trazabilidadBulkRouter'
import estadosActualizacionesRouter from './routes/estadosBulkRouter'
import tiposRechazoRoutes from "./routes/tipoRechazosRouter";
import subEstadosRouter from './routes/subEstadosRouter'
import documentoSolicitudRouter from "./routes/documentoSolicitudRouter";
import notificacionesPruebaRouter from "./routes/notificacionesPruebaRouter"
import notificacionesRouter from "./routes/notificacionesRouter"

// Módulo de gastos
import gastosRouter from "./routes/gastos"
import appTramitadoresRouter from "./routes/tramitadores"
import seguimientoTramitadorRouter from "./routes/tramitadores/seguimiento"
import { seedGastos } from "./seeds/gastosSeed"
import { ajustarEsquemaGastos } from "./seeds/ajustesEsquemaGastos"
import { ajustarEsquemaTramitadores } from "./seeds/ajustesEsquemaTramitadores"
import { ajustarEsquemaMensajeria, ajustarEsquemaTramites } from "./seeds/ajustesEsquemaTramites"
import gestionMasivaRouter from "./routes/gestionMasivaRouter"
import catalogosTramitesRouter from "./routes/catalogosTramitesRouter"
import apiExternaRouter from "./routes/apiExternaRouter"
import mensajeriaRouter from "./routes/mensajeriaRouter"
import direccionesRouter from "./routes/direccionesRouter"
import notificacionesProgramadasRouter from "./routes/notificacionesProgramadasRouter"
import { iniciarNotificacionesProgramadas } from "./services/notificacionesProgramadas"
import { modoEnsayo } from "./utils/modoEnsayo"
import { autenticacion } from "./middleware/auth"
import { requiereRol } from "./middleware/gastos/requiereRol"
import { activarHistorialTramites } from "./services/historialTramites"


// Bitácora de cambios de los trámites (hooks de los modelos): antes de atender peticiones
activarHistorialTramites()

async function connectDB() {
    try {
        await db.authenticate()
        // Antes de sync(): ajusta columnas que los modelos ya esperan
        await ajustarEsquemaTramitadores()
        await ajustarEsquemaTramites()
        await db.sync()
        await ajustarEsquemaMensajeria()
        await ajustarEsquemaGastos()
        await seedGastos()
        console.log(colors.blue.bold('Conexion Exitosa'))
    } catch (error) {
        console.log(colors.red.bold('Fallo la Conexion a la base de Datos'))
        console.error(error)
    }
}

// Las notificaciones automáticas (WhatsApp de diligencias y push de reintegros) leen su hora
// de la base, por eso se programan después de sync(). Si la base falló, usan los valores por defecto.
// En modo ensayo no se programan los WhatsApp automáticos (la base es una copia con datos reales);
// las push sí, porque solo llegan a los celulares que las activaron en la app del ensayo
connectDB().then(() => {
    if (modoEnsayo()) console.log(colors.yellow.bold('🧪 MODO ENSAYO: WhatsApp automáticos NO programados; WhatsApp bloqueado y correos a CORREO_ENSAYO'))
    return iniciarNotificacionesProgramadas({ soloPush: modoEnsayo() })
})

const app = express()
// No anunciar con qué está hecho el servidor (encabezado X-Powered-By)
app.disable('x-powered-by')

app.use(morgan('dev'))

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true)

    const allowedPatterns = [
      /^http:\/\/localhost(:\d+)?$/,
      /^http:\/\/127\.0\.0\.1(:\d+)?$/,
      /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
      /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/
    ]

    const isAllowed = allowedPatterns.some(pattern => pattern.test(origin))

    if (isAllowed) return callback(null, true)

    return callback(new Error('Not allowed by CORS'))
  },
  credentials: true
}))

// 2 MB: la gestión masiva en pantalla envía hasta 500 filas en JSON
app.use(express.json({ limit: "2mb" }))
app.use(cookieParser())

// 🔹 Rutas existentes
// ── Permisos ──────────────────────────────────────────────────
// Trámites: sesión + perfil Gestión de activos o Torre de control (Admin siempre pasa).
// Lo que solo puede hacer Torre de control se marca dentro de cada router.
const accesoTramites = [autenticacion, requiereRol('GESTION_ACTIVOS', 'TORRE_CONTROL')]
const soloTorreControl = [autenticacion, requiereRol('TORRE_CONTROL')]
const soloAdmin = [autenticacion, requiereRol('ADMIN')]

// 🔹 Públicas: login y registro (una cuenta nueva no tiene perfil hasta que se le asigne)
app.use('/api/auth', authRouter)

// 🔹 API para otras plataformas: sin sesión, con API key (X-API-Key = API_KEY_EXTERNA)
app.use('/api/externa', apiExternaRouter)

// 🔹 Usuarios: solo Admin
app.use('/api/usuarios', ...soloAdmin, usuarioRouter)

// 🔹 Trámites y sus catálogos
app.use('/api/entidad', ...accesoTramites, entidadRouter)
app.use('/api/clientes', ...accesoTramites, clienteRouter)
app.use('/api/municipios', ...accesoTramites, municipiosRouter)
app.use('/api/operaciones', ...accesoTramites, operacionesRouter)
app.use('/api/tramites', ...accesoTramites, tramiteRouter)
app.use('/api/tarifa', ...accesoTramites, tarifaRouter)
app.use('/api/tramitador', ...accesoTramites, tramitadorRouter)
app.use('/api/solicitudTramites', ...accesoTramites, solicitudTramiteRouter)
app.use('/api/direcciones', ...accesoTramites, direccionesRouter)
app.use('/api/estados', ...accesoTramites, estadosRouter)
app.use("/api/solicitudes", ...accesoTramites, evaluacionRoutes)
app.use("/api/transportadora", ...accesoTramites, transportadoraRouter)
app.use("/api/tiposRechazo", ...accesoTramites, tiposRechazoRoutes);
app.use('/api/subEstados', ...accesoTramites, subEstadosRouter)
// Crear, editar y borrar catálogos: Administrador de Torre de control o Admin (se revisa en el router)
app.use('/api/catalogos-tramites', ...soloTorreControl, catalogosTramitesRouter)
app.use('/api/documentos', ...accesoTramites, documentoSolicitudRouter)
app.use('/api/notificaciones', ...accesoTramites, notificacionesRouter)
app.use('/api/seguimiento-tramitador', ...accesoTramites, seguimientoTramitadorRouter)

// 🔹 Notificaciones automáticas de WhatsApp: Admin y Torre de control (sin analistas);
// el permiso se revisa dentro del router
app.use('/api/notificaciones-programadas', autenticacion, notificacionesProgramadasRouter)

// 🔹 Gestión masiva: solo Torre de control
app.use('/api/bulk/logistica', ...soloTorreControl, logisticaBulkRouter)
app.use('/api/bulk/programacion', ...soloTorreControl, programacionActualizacionesRouter)
app.use('/api/bulk/trazabilidad', ...soloTorreControl, trazabilidadActualizacionesRouter)
app.use('/api/bulk/estados', ...soloTorreControl, estadosActualizacionesRouter)
app.use('/api/bulk/tramitador', ...soloTorreControl, tramitadorActualizacionesRouter)
app.use('/api/bulk/tramites', ...soloTorreControl, gestionMasivaRouter)
app.use('/api/mensajeria', ...soloTorreControl, mensajeriaRouter)

// 🔹 Gastos: cada ruta valida sesión y rol dentro de su router
app.use('/api/gastos', gastosRouter)

// 🔹 App Nodex Tramitadores: login propio; cada ruta valida la sesión del tramitador
app.use('/api/app-tramitadores', appTramitadoresRouter)

// 🔹 Pruebas de notificaciones automáticas: solo Admin
app.use(
  "/api/test/notificaciones",
  ...soloAdmin,
  notificacionesPruebaRouter
)



export default app