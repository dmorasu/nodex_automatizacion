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


async function connectDB() {
    try {
        await db.authenticate()
        await db.sync()
        console.log(colors.blue.bold('Conexion Exitosa'))
    } catch (error) {
        console.log(colors.red.bold('Fallo la Conexion a la base de Datos'))
    }
}

connectDB()

const app = express()

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

app.use(express.json())
app.use(cookieParser())

// 🔹 Rutas existentes
app.use('/api/usuarios', usuarioRouter)
app.use('/api/entidad', entidadRouter)
app.use('/api/clientes', clienteRouter)
app.use('/api/municipios', municipiosRouter)
app.use('/api/operaciones', operacionesRouter)
app.use('/api/tramites', tramiteRouter)
app.use('/api/tarifa', tarifaRouter)
app.use('/api/tramitador', tramitadorRouter)
app.use('/api/solicitudTramites', solicitudTramiteRouter)
app.use('/api/estados', estadosRouter)
app.use('/api/auth', authRouter)
app.use("/api/solicitudes", evaluacionRoutes)
app.use("/api/transportadora", transportadoraRouter)
//app.use('/api/estados', estadosBulkRouter)
app.use('/api/bulk/logistica', logisticaBulkRouter)
app.use('/api/bulk/programacion', programacionActualizacionesRouter)
app.use('/api/bulk/trazabilidad', trazabilidadActualizacionesRouter)
app.use('/api/bulk/estados', estadosActualizacionesRouter)
app.use('/api/bulk/tramitador', tramitadorActualizacionesRouter)
app.use("/api/tiposRechazo", tiposRechazoRoutes);
app.use('/api/subEstados',subEstadosRouter)
app.use('/api/documentos', documentoSolicitudRouter)


export default app