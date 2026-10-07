# Nodex: resumen técnico para continuar

_Actualizado: 2026-10-06_

## Arquitectura

| Proyecto | Ruta | Puerto | Tecnología |
|---|---|---|---|
| Backend | `Backend/` | 4000 | Express + Sequelize-typescript + Postgres. Archivos en Azure File Share. Arranca con `nodemon src/index.ts` |
| Nodex Trámites | `Frontend/frontend` | 3000 | Next 14, color sky. Usa el proxy `/api/backend/[...ruta]` y `encabezadosSesion()` |
| Nodex Gastos | `Frontend/gastos` | 3001 | Next 14, color emerald. Usa `fetchApi`, zod en `src/schemas/gastos.ts` y server actions que devuelven `{ok, datos \| errores}` |
| Nodex Tramitadores | `Frontend/tramitadores` | 3002 | App web instalable (PWA), pensada para celular, color indigo. Cookie `TOKEN_TRAMITADOR` y API `/api/app-tramitadores` |

**Arranque del backend:** `authenticate` → `ajustarEsquemaTramitadores()` y `ajustarEsquemaTramites()` (antes de sync) → `db.sync()` → `ajustarEsquemaMensajeria()` → `ajustarEsquemaGastos()` → `seedGastos()`.
- Si cualquier paso falla, `connectDB()` (`server.ts`) solo imprime "Fallo la Conexion a la base de Datos" y **el servidor sigue arriba**: los pasos siguientes no corren. Revisar siempre el log de arranque.
- Los ajustes de esquema son `ALTER` idempotentes.
- `seedGastos` inserta catálogos y roles si no existen.

## Convenciones y reglas de trabajo
- **Código:** en español; los comentarios explican el porqué.
- **Dinero:** se calcula en centavos.
- **Movimientos de bolsa:** pasan por `registrarMovimientos` (bloqueo de fila).
- **Estados del gasto:** cambian con `cambiarEstadoGasto` (deja trazabilidad).
- **Errores de negocio:** `ErrorGastos(msg, status)` y `responderError`.
- **Listados con includes:** en `order`, usar `{ model, as }`. Con límite y `hasMany`, usar `separate: true` o filtrar en el include. Un `$nested$` en el `where` superior falla.
- **El build revisa tipos y lint (2026-10-06):** en Nodex Trámites se quitaron `eslint.ignoreDuringBuilds` y `typescript.ignoreBuildErrors` de `next.config.js` (las otras dos apps nunca los tuvieron). Un error de tipos o de lint frena `next build`; antes de subir, correr `npx tsc --noEmit` y `npx next lint` (los avisos no frenan). Quedaron 0 errores y 5 avisos. Se borró código muerto (`app/center/prueba.tsx`, `PaginaTedTable`, `seleccionarMunicipios`, `CargaMasivaSolicitudes`, `EliminarSolicitudTramiteModal` y `ConfirmarContraseña`).
- **No compilar con el servidor corriendo:** no ejecutar `next build` mientras el servidor de esa app esté encendido (daña `.next`; se arregla con Ctrl+C, borrar `.next` y `npm run dev`). Validar con `npx tsc --noEmit`.
- **No arrancar el backend completo:** carga el programador de notificaciones de WhatsApp. Probar los servicios con scripts aislados: `TS_NODE_TRANSPILE_ONLY=1 npx ts-node src/_x.ts`, y borrar el script después.
- **Pruebas sin efectos:** no ejecutar pagos reales. Para Azure, reemplazar con un stub `require('./services/azureFileStorage').subirArchivo = async()=>{}`.
- **Windows:** no se pueden mover carpetas mientras el dev server corre (`EPERM`).
- **Detrás de Nginx, no armar URLs con `request.url`** en middleware o route handlers de Next: trae la dirección interna (`localhost:900x`). Usar la pública con los encabezados `Host` / `X-Forwarded-Proto` (ver `Frontend/tramitadores/middleware.ts`). `redirect("/ruta")` relativo no tiene el problema.

## Módulos construidos

### 1. App Nodex Tramitadores
**Backend:**
- **Modelos** en `src/models/tramitadores/`:
  - `accesoTramitador` (tabla `tramitadores_acceso`: bcrypt, contraseña temporal, intentos fallidos con bloqueo de 15 min, `versionSesion`).
  - `comentarioTramite`, `reporteRealizado`, `soporteTramitador` y `archivoSoporte`.
- **Servicios** en `src/services/tramitadores/`:
  - `accesoTramitadores`: login, token tipo `TRAMITADOR`; `middleware/auth.ts` rechaza ese tipo.
  - `tramitesTramitador`: lista, detalle, comentarios, reporte "realizado" y documentos del trámite. Una Factura o Boleta de reintegro subida en el trámite llega sola al gasto que la necesita.
  - `soportesTramitador`: gastos del tramitador (solo los que tienen reintegro pendiente), soportes y revisión aprobar/rechazar.
  - `documentosTramite`: `registrarDocumentosTramite`.
  - `nombresDocumento`: tipos y `conPrefijo`, que nombra los archivos como `"Factura - x.pdf"`.
- **Middleware:** `middleware/tramitadores/autenticacionTramitador.ts` revisa en cada petición que el tramitador siga activo y la versión de sesión.
- **Rutas:**
  - `routes/tramitadores/index.ts` (`/api/app-tramitadores`).
  - `routes/tramitadores/seguimiento.ts` (`/api/seguimiento-tramitador`, para Nodex Trámites).
- **Admin de accesos** en `TramitadorController` y `tramitadorRouter` (Torre de Control): `POST/DELETE /tramitador/:id/acceso`.
- **Esquema:** `seeds/ajustesEsquemaTramitadores.ts` cambia `DocumentosSolicitud`: `usuarioId` pasa a ser opcional y se agregan `tramitadorId` y `tipoDocumento`.
- **Tipos de documento del trámite:** SOPORTE, FACTURA, BOLETA_REINTEGRO, INGRESO y OTRO. Los soportes del gasto son FACTURA, REINTEGRO y OTRO.

**Nodex Trámites:**
- Página Tramitadores: `components/tramitador/ModalAccesoApp.tsx`.
- Pestaña "Tramitador" en el detalle del trámite: `SeguimientoTramitador.tsx`.
- Bandeja `/center/reportesRealizado`.
- Documentos: muestran quién los subió y su tipo; el visor acepta PNG.

**Frontend `Frontend/tramitadores`:**
- **Pantallas:** login, cambiar contraseña, inicio, trámites (filtros activos / sinFactura / cerrados / todos), detalle con "Gastos de este trámite", subir documentos con selector de tipo y gasto, comentarios, reportar realizado. "Reintegros" en `/gastos`.
- **Componentes de interfaz:** `HojaInferior`, `SelectorArchivos` (cámara y compresión), `SelectorTipo`.
- **Corrección del scroll horizontal:** campos de 16 px, `overflow-x: clip` y `overflow-wrap: anywhere`.
- **Logo** `public/nodextramitador.png` en el encabezado, junto al texto "Nodex Tramitadores". Ícono en `app/iconos/[tamano]` (recorte del emblema).

### 2. Nodex Gastos: cambios de lógica
- **No reembolsables:**
  - Con la factura pasan a LEGALIZADO y la bolsa asume el gasto.
  - Se contabilizan uno por uno: `contabilizarGastos` y `POST /contabilidad/contabilizar-gastos`.
  - Columnas `documento_contable`, `fecha_contabilizacion` y `contabilizado_por`.
- **Reparto entre áreas:**
  - Legalización: solo gastos reembolsables.
  - Contabilidad: no reembolsables (registra la factura y revisa sus soportes).
  - Se controla con `puedeGestionarFactura` en `controllers/gastos/utilidades.ts`.
- **Listado `/gastos/solicitudes`:**
  - `condicionesListado` en `SolicitudesGastoController` acepta los filtros `pagados`, `certificados`, `soporteTramitador` (si/no), `conTramite`, `reintegroPendiente`, `tramitadorId`, `creadoPor`, `operacionId`, `desde`/`hasta`, `pagoDesde`/`pagoHasta`, `orden` y `totales=si`.
  - Atributos de seguimiento: `soporteTramitador`, `estadoTramite` y `reporteRealizado`.
- **Tablero:**
  - `gastoAsumido`.
  - Resumen gerencial de reintegros en `services/gastos/reintegrosTramitador.ts`.
  - Pestaña "Reintegros por tramitador" en Tesorería, Legalización y Contabilidad (`GET /gastos/reintegros-tramitador`).
- **Descarga masiva:** `services/gastos/descargaDocumentos.ts` arma un ZIP con jszip (agregado a `package.json`).
  - Ruta `POST /gastos/documentos/descargar`.
  - Pestaña "Descargar documentos" y botón en el detalle de la cuenta de cobro.
- **Carga masiva de facturas:**
  - `components/legalizacion/CargaMasivaFacturas.tsx` y `src/lib/asignarArchivos.ts`: asigna cada archivo por código, N° de trámite, placa o matrícula.
  - Reutiliza la acción `registrarFactura` gasto por gasto.
- **Certificados (último cambio):**
  - Tipos de gasto `CTL` y `CAMARA_COMERCIO`; lista `TIPOS_GASTO_CERTIFICADOS` en `services/gastos/constantes.ts`.
  - Rol `TESORERIA_CERTIFICADOS`.
  - Helpers `soloCertificados` e `idsTiposCertificados` en `utilidades.ts`.
  - `PagosController.verificarQuienPaga`; los lotes se filtran según el rol.
  - Frontend: bandeja `/tesoreria/certificados` (`components/tesoreria/BandejaPorPagar.tsx`), pestañas de Tesorería según el rol y `requiereAcceso([TESORERIA])` en bolsas, cuentas y reintegros.

- **Retención al crear el gasto (2026-10-02):**
  - Solo gastos de tipo INMUEBLE. Columnas nuevas en `gastos_solicitudes`: `retencion_base` (por defecto 0), `retencion_porcentaje` (fracción; por defecto el parámetro RETENCION_FUENTE = 11 %, editable), `retencion_valor` y `retencion_total_pagar`. Se crean en `retencionAlCrearGasto` (`ajustesEsquemaGastos.ts`); las columnas viejas `base_retencion`, etc. no se tocan.
  - Cálculo en `prepararRetencion` (`services/gastos/solicitudesGasto.ts`). La API recibe `baseRetencion` y `porcentajeRetencion` en % (0–100).
  - **Es informativa:** Tesorería paga el valor solicitado completo, sin deducción.
  - Legalización (`registrarFactura`, `ModalFactura`, `CargaMasivaFacturas`) ya no pide base: solo el 4x1000. La factura copia la retención del gasto (`retencionDeLaFactura`); las facturas viejas conservan la suya.
  - Formularios: `FormularioGasto.tsx` (Gastos) y `CrearGastoTramite.tsx` (Trámites); detalle del gasto en "Valores"; reporte Excel toma la del gasto o, si no tiene, la de la factura.
  - El cargue masivo deja los inmuebles con base 0 y 11 %.
- **Tesorería - Certificados:** su bandeja no muestra las tarjetas de saldo de las bolsas.

### Nodex Trámites: analista asignado (2026-10-03)
- **Datos:** `SolicitudTramites.analistaAsignado` y `Municipios.analistaId` (ids de Usuarios). Los crea `seeds/ajustesEsquemaTramites.ts` (antes de sync). La primera vez mapeó `Municipios.responsable` (texto) → Maria Orlinda 24, Jenny Velosa 45, Johan Diaz 55, y asignó a cada trámite el analista de su municipio.
- **Sin `@BelongsTo` a Usuarios** para el analista (obligaría a usar `as` en los include de Usuarios existentes). El nombre sale como atributo `nombreAnalista` con `ATRIBUTO_NOMBRE_ANALISTA` (`services/analistasTramites.ts`).
- **Trámites nuevos:** hook `@BeforeCreate` del modelo toma `Municipios.analistaId`. `create` y `updateById` ignoran `analistaAsignado` del body.
- **Roles nuevos:** `ANALISTA_TRAMITES` y `ADMIN_TORRE_CONTROL`. En `middleware/auth.ts` ambos reciben implícitamente `TORRE_CONTROL`. Helpers `esAnalistaTramites` y `puedeAsignarAnalistas`.
- **Listados** (`/solicitudTramites` y `/filtrar`): el analista ve solo los suyos salvo cuando busca por número o identificación; filtro `analistaId` (id o `sin`).
- **API:** `GET /solicitudTramites/analistas`; solo Admin Torre de control: `/analistas/resumen`, `POST /analistas/reasignar`, `GET|PUT /analistas/municipios`, `PATCH /:id/analista`.
- **Frontend:** `usePermisosAnalistas()` (contexto), dashboard con filtro y aviso, detalle con `CambiarAnalista`, página `/center/analistas`.
- **Notificaciones:** `crearNotificacion` reemplaza `data.programador` por el nombre del analista asignado (si el trámite no tiene, queda el que venía).

### Notificaciones de WhatsApp: texto real (2026-10-03)
- `Notificaciones.mensaje` guardaba un texto armado en el código (`construirMensaje().text`), distinto de la plantilla aprobada.
- `services/plantillasWhatsapp.ts` → `textoDePlantilla(templateSid, variables)`: lee la plantilla de Twilio Content API (caché 1 h; copia local de respaldo de las 5 plantillas) y reemplaza `{{n}}`. Si la plantilla lleva PDF, agrega "📎 Adjunto: url".
- `enviarWhatsapp` guarda ese texto; el worker lo reemplaza por `message.body` que devuelve Twilio al enviar (conserva la nota del adjunto).
- Históricos: `src/scripts/corregirMensajesWhatsapp.ts` empareja cada notificación con el mensaje del registro de Twilio (mismo número, ventana de 15 min, solo mensajes que empiezan con 📢). Sin `--aplicar` solo muestra lo que cambiaría. **Pendiente de ejecutar** (la BD no respondía).

### Nodex Trámites: gestión masiva en pantalla (2026-10-03)
- `/center/gestionMasiva` tiene dos modos: **En pantalla** (nuevo, `components/gestionMasiva/GestionEnPantalla.tsx` + `camposAcciones.ts`) y **Cargar Excel** (el panel de siempre).
- En pantalla: se pegan números de trámite → `GET /api/bulk/tramites?ids=` (`routes/gestionMasivaRouter.ts`) trae cada trámite con sus valores actuales (programación y logística precargadas, porque el proceso reemplaza campos y un vacío borra) → se elige la acción → "mismo valor para todos" o fila por fila → guarda.
- **Guardar usa las mismas rutas del Excel** (`/api/bulk/<tipo>/validar|procesar`) enviando `{ filas }` en JSON: `utils/filasMasivas.ts` (`filasDeLaPeticion`) lee Excel o JSON (máx. 500; no lanza errores). `express.json` subió a 2 MB.
- **Estados unificados:** `services/estadoTramite.ts` (`cambiarEstadoTramite`) lo usan el cambio individual (`EstadosTramitesController.create`), el Excel y la pantalla: actualiza `estadoActualTramite`, fecha de finalización y notifica Desistido/Novedad/Finalizado. Antes el Excel de estados no actualizaba el estado actual y solo notificaba Finalizado.
- En pantalla, "Cambiar estado" acepta una observación que se guarda primero como trazabilidad (la notificación de novedad usa la última).
- Trazabilidad sin `nombreUsuario` toma el del usuario que hace el cargue.
- **Varias acciones en un solo guardado (2026-10-05):** el paso 2 permite marcar varias acciones (estado, trazabilidad, programación, logística, tramitador). La tabla agrupa columnas por acción; cada fila entra solo en las acciones donde tiene algo que aplicar (`tieneCambios` en `camposAcciones.ts`: estado elegido, observación escrita, tramitador distinto del actual, programación/logística distinta de lo que ya tiene → no reenvía correos de lo que no cambió). Se guarda en `ORDEN_GUARDADO` (tramitador → programación → logística → trazabilidad → estado: el estado al final para que su notificación salga con lo demás guardado); si una acción falla, las siguientes no se aplican y cada fila muestra qué se guardó y qué falló. Si se eligen estado y trazabilidad juntos, el estado no muestra su propia observación (usa la de trazabilidad). Filas con casilla: "Mismo valor" se aplica solo a las marcadas (o a todas si no hay marcadas).
- **Buscar con filtros (2026-10-05):** en "En pantalla", el paso 1 tiene dos modos: "Por número" (el de siempre) y "Buscar con filtros" (tramitador o "sin tramitador", operación, estado actual —por defecto Abiertos = ni Finalizado ni Desistido—, y rango de fechas de creación / diligencia `Programacion.fechaProbableEntrega` / finalización). Los resultados reemplazan la lista o se agregan. Backend `GET /api/bulk/tramites/buscar` (`routes/gestionMasivaRouter.ts`): exige al menos tramitador, operación o fecha; si pasa de 500 pide acotar; el analista solo encuentra los suyos. Filtra por `estadoActualTramite` (como el tablero), así que en producción depende de correr antes `sincronizarEstadoActual`.

### Nodex Trámites: detalle del trámite rediseñado (2026-10-03)
- Mismo esquema que el detalle de Nodex Gastos: encabezado (volver, "Trámite #id" + `EstadoTramite`, tipo · cliente, creado por) con acciones a la derecha; columna principal (pestañas en `DetalleSolicitudTabs.tsx`, información en tarjetas) y columna lateral (Estado con historial, Asignación con `CambiarAnalista`, Programación, Logística).
- Componentes nuevos en Trámites: `components/ui/Seccion.tsx`, `components/ui/Dato.tsx` (copias de Gastos) y `components/solicitudTramites/EstadoTramite.tsx`.
- Backend `getById` incluye `estadoActual` y el `tipoRechazo` de cada estado; el historial se ordena en el frontend.

### Nodex Trámites: tablero de gestión (2026-10-03)
- Reemplaza la página `/center/torreControl` (nadie la usaba). Menú: "Tablero de gestión". Se borraron `components/torreControl/*`, `hooks/usePanelControl.ts`, `hooks/useTorreControl.ts` y los endpoints `/solicitudTramites/torre-control` y `/panel-control`. La vista `vw_torre_control` queda en la base sin uso (se puede eliminar después).
- Backend: `services/tableroTramites.ts` (`obtenerTablero`) + `GET /solicitudTramites/tablero` (Torre de control). Una consulta trae los abiertos y los creados/finalizados desde el inicio del período o de la tendencia; los cálculos se hacen en JS (~0,4 s en desarrollo).
- **Criterios** (acordados con los líderes): vencido = abierto y más de `DIAS_GRACIA` (2) días desde la fecha de programación; a tiempo = finalizado ≤ 2 días después de la fecha programada; sin movimiento = más de 2 días sin trazabilidad ni cambio de estado. No hay tiempo meta por tipo de trámite.
- **Vistas:** Administrador de Torre de control y Admin ven todo (filtro por analista y tabla por analista); el analista ve "Mi tablero" solo con sus trámites (el backend fuerza `analistaId`).
- Secciones: filtros (período con presets, analista, tramitador, operación, tipo), indicadores, "Requiere atención" (vencidos, novedad sin movimiento, realizado sin finalizar, sin tramitador, sin programación, sin movimiento, sin analista), carga por analista, creados vs finalizados (12 semanas) y antigüedad de los abiertos.
- Gráficas en HTML/CSS (`components/tablero/*`); paleta validada con el validador de dataviz: creados `#0284c7`, finalizados `#7c3aed`.
- **Fase 2 (hecha):**
  - Desempeño por tramitador, con "realizado sin finalizar" y reintegros pendientes de Nodex Gastos (reutiliza `obtenerReintegrosPorTramitador`; si Gastos falla, el tablero sigue y lo avisa con `reintegrosDisponibles: false`).
  - Causas de novedad: pasos a "En espera por novedad" registrados en el período, por tipo de rechazo, entidad y municipio.
  - Clientes agrupados por **identificación** (hay clientes duplicados con nombres distintos, ej. "BANCOLOMBIA SA" / "S.A"), con valor finalizado (honorarios + viáticos).
  - Mapa de abiertos por municipio con **Leaflet + react-leaflet 4 + OpenStreetMap** (gratis, sin clave; `MapaMunicipiosLeaflet.tsx` se carga con `dynamic`, sin SSR) usando la latitud/longitud de Municipios.
  - Exportar a Excel: `GET /solicitudTramites/tablero/exportar` (`services/exportarTablero.ts`, librería `xlsx`), 14 hojas con las listas completas y los mismos filtros.
  - `filtrosTablero(req)` en `SolicitudTramitesController` arma los filtros de ambos endpoints (el analista siempre queda limitado a sus trámites).

### Rutas de mensajeros (2026-10-03)
- **Decisiones:** Google solo para convertir direcciones (Geocoding) y optimizar (Routes API); mapas en pantalla con Leaflet + OpenStreetMap (gratis); navegación con enlaces a la app de Google Maps/Waze (gratis). Día de la ruta = fecha de diligencia (`Programacion.fechaProbableEntrega`). Mensajeros salen de su sede (Medellín y Bogotá); la ruta optimizada va de la sede a la sede y el analista puede reordenar. Sin clave de Google todo funciona en modo manual (pin en el mapa, orden por cercanía).
- **Datos:** `SolicitudTramites` + `latitud`, `longitud`, `ubicacionFuente` (GOOGLE/MANUAL), `ubicacionPrecisa`, `ubicacionDireccion`; `Tramitador` + `esMensajero`, `sedeId`. Tablas `mensajeria_sedes` y `mensajeria_paradas` (una por trámite y día: orden, estado PENDIENTE/ENTREGADO/NO_SE_PUDO, observación, GPS y foto en Azure `mensajeria/<fecha>/<tramite>`). Ajustes en `seeds/ajustesEsquemaTramites.ts`; `sedeId` en `ajustarEsquemaMensajeria()` **después** de `sync()`.
- **Backend:** `services/mensajeria/ubicacion.ts` (geocodificar, ubicar al crear/editar el trámite en segundo plano, ubicación manual) y `services/mensajeria/rutas.ts` (las paradas se sincronizan solas al consultar: entran los trámites del día, salen los que cambiaron de fecha/mensajero si no se visitaron; orden manual; optimizar con Google o por vecino más cercano; confirmar visita). API Torre de control `/api/mensajeria/*`; app `/api/app-tramitadores/ruta*`. `/auth/me` de la app devuelve `esMensajero`.
- **Nodex Trámites:** `/center/rutas` (día, sede, mapa por mensajero con paradas numeradas por estado, subir/bajar, Optimizar, enlaces a Google Maps por tramos de 9 paradas, ubicar/corregir con pin, confirmaciones con foto y distancia GPS a la dirección), gestión de sedes, casilla "Es mensajero" + sede en Tramitadores, sección "Ubicación" en el detalle del trámite. `src/lib/apiCliente.ts` = llamadas desde el navegador por el proxy.
- **App Tramitadores:** "Mi ruta" (solo mensajeros) con la ruta completa en Google Maps, navegar a cada parada (Google Maps o Waze) y "Confirmar visita" (Entregado/No se pudo, observación, foto comprimida y GPS del celular). Sin mapa embebido a propósito.
- **Autocompletar dirección al crear/editar trámite:** `components/direcciones/CampoDireccion.tsx` sugiere lugares/direcciones de Google mientras se escribe (Places API New, con token de sesión) o toma la ubicación de un enlace pegado de Google Maps (también `maps.app.goo.gl`, solo se siguen dominios de Google). Llena la dirección, manda `latitud`/`longitud` con el formulario (se guardan con fuente GOOGLE, sin volver a geocodificar) y propone el municipio de Nodex (`buscarMunicipio`: compara nombres sin tildes; "Bogotá" → "BOGOTÁ, D.C."). Backend: `services/mensajeria/lugares.ts` + `routes/direccionesRouter.ts` (`/api/direcciones`, Torre de control y Gestión de activos).
- **Municipios duplicados:** la tabla tiene cada municipio dos veces (una copia sin `regional`, otra con `regional`; 2.244 filas, 1.124 municipios; 1.120 parejas idénticas salvo la regional). El buscador (`MunicipioController.search`) ya devuelve una sola (la de menor id, completando la regional). Para limpiar los datos: `src/scripts/unificarMunicipios.ts` (sin `--aplicar` solo informa; con `--aplicar` completa la que queda, mueve los trámites y borra las copias, en una transacción). En desarrollo: 1.120 copias y 194 trámites a mover. **Pendiente de autorización para ejecutar.**
- **Mapa del día con Google (2026-10-05):** `/center/rutas` tiene un solo mapa (`components/rutas/PanelRutas.tsx`) con las rutas de los mensajeros marcados (casillas; "Ver en el mapa" en cada tarjeta deja solo ese), un color por mensajero (`colorMensajero`) y el borde del número según el estado de la parada. Las tarjetas ya no tienen mapa propio (avisan su orden con `onParadas`). La línea va **por las calles**: `POST /mensajeria/trazado` (`services/mensajeria/trazado.ts`, Google Routes con FieldMask solo de polyline/distancia/duración = tarifa Essentials) con caché en memoria de 12 h por puntos; máx. 27 puntos (si hay más, línea recta punteada). Mapa: Google Maps JavaScript (`MapaRutasGoogle.tsx`, `src/lib/googleMaps.ts`, marcadores avanzados) si existe `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` en Nodex Trámites; si no, OpenStreetMap (`MapaRutaLeaflet.tsx`, también con el trazado). Se agregó `@types/google.maps` (dev).
  - **Costos (precios oficiales 2026):** cada SKU Essentials tiene 10.000 usos gratis al mes; Dynamic Maps (cada carga del mapa) cuesta USD 7 por 1.000 después de eso y Compute Routes Essentials USD 5 por 1.000. Con 4 mensajeros y un mapa por visita a la página, el uso esperado está muy por debajo de lo gratis. Recomendado: poner cuotas diarias en Google Cloud para no pasar del gratis.
  - **Para activar el mapa de Google:** en Google Cloud habilitar **Maps JavaScript API**, crear una clave de navegador restringida por dominio (HTTP referrer) y solo a esa API, y ponerla en `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` de Nodex Trámites (reiniciar el dev server). Opcional: Map ID propio en `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` (sin él usa `DEMO_MAP_ID`).
- **Pendiente para activar Google:** variable `GOOGLE_MAPS_API_KEY` en el backend con Geocoding API, Routes API y **Places API (New)** habilitadas (clave restringida a la IP del servidor). Crear las sedes, marcar los 4 mensajeros con su sede y darles acceso a la app.

### Notificaciones por correo de Gastos y rediseño de correos (2026-10-04)
- **Gasto creado → Tesorería:** `notificarGastosCreados(ids)` en `services/gastos/notificacionesGastos.ts`. Un solo correo a `CORREO_TESORERIA` con todos los gastos (en el cargue masivo, uno por cargue). Lo llaman `SolicitudesGastoController.create` y `CargueMasivoGastosController.cargar` **después** de la transacción (`cargarGastos` ahora devuelve también `ids`). Tipo `GASTO_CREADO`.
- **Gasto pagado:** `notificarGastosPagados(ids)` (desde `PagosController.pagar`) agrupa por destinatario:
  - Creador del gasto (`GASTO_PAGADO`, ya existía).
  - Analista asignado al trámite del gasto (`SolicitudTramites.analistaAsignado` → `Usuarios.correoUsuario`), con copia a la torre de control (`GASTO_PAGADO_ANALISTA`).
  - Gastos sin trámite, sin analista o con analista sin correo → directo a `CORREO_TORRE_CONTROL` (`GASTO_PAGADO_TORRE_CONTROL`).
  - Un fallo en los correos no revierte el gasto ni el pago (todo va en `try/catch`).
- **Trámite desistido → quien lo creó:** tipo nuevo `DESISTIDO_SOLICITANTE` (correo, está en `TIPOS_EMAIL`). Lo envía `cambiarEstadoTramite` (`services/estadoTramite.ts`) a `solicitud.usuario`, con copia a la torre de control como los demás correos de trámites. Datos: tipo de trámite, cliente, municipio, operación, corresponsal, programador (analista), fecha y última trazabilidad. El WhatsApp `DESISTIDO` al tramitador sigue igual.
- **Trámite finalizado con factura → Legalización:** `notificarFacturasParaLegalizacion(solicitudTramiteId)`, llamada al final de `cambiarEstadoTramite` cuando el estado es Finalizado (individual, Excel y pantalla). Un correo por trámite a `CORREO_LEGALIZACION` (legalizaciongastos@), tipo `GASTO_FACTURA_LEGALIZACION`.
  - **Solo se envía si** el trámite tiene gastos **reembolsables** con un soporte FACTURA del tramitador no rechazado (PENDIENTE o APROBADO) y sin `FacturasGasto` registrada. Si no hay ninguno, no se envía nada.
  - Muestra cada gasto con valor pagado, tramitador, beneficiario, bolsa y estado de la factura del tramitador ("Pendiente de revisión" / "Aprobada").
  - No exige el reporte "Realizado" del tramitador.
- **Reintegro del tramitador → Tesorería:** `notificarReintegroTramitador(soporteId)`, llamada en `subirSoporte` (`services/tramitadores/soportesTramitador.ts`) cuando el soporte es REINTEGRO. Cubre las dos vías de la app: el gasto y los documentos del trámite (Boleta de reintegro). Correo a `CORREO_TESORERIA`, tipo `GASTO_REINTEGRO_TRAMITADOR`, con valor del reintegro, trámite, tramitador, beneficiario, bolsa y observación.
- **Base común de correos:** `services/template/correoBase.ts` (`correoBase`, `ficha`, `gridDetalles`, `nota`, `resumen`, `html`). Tarjeta blanca de 600 px sobre slate-50, franja con degradado del módulo, etiqueta de estado (tonos info/éxito/alerta/peligro/neutro), detalles en dos columnas que ocultan los vacíos. Solo tablas y estilos en línea (Gmail, Outlook, celular); fuerza modo claro; sin imágenes externas.
  - Colores por módulo en `MARCAS`: Gastos `#34d399 → #059669 → #0f766e`; Trámites `#38bdf8 → #0284c7 → #0369a1` (se quitó `#1d4ed8`, que se veía morado).
  - Gastos: `services/gastos/plantillaCorreo.ts` (`correoGastos`: resumen con total + una ficha por gasto).
  - Trámites: `services/template/notificacionesPlantilla.ts` rehecho para FINALIZADO, PROGRAMACION, EN_ESPERA_POR_NOVEDAD, TRAZABILIDAD, LOGISTICA y DESISTIDO_SOLICITANTE. Asuntos y textos de WhatsApp sin cambios. Ahora se escapa todo el texto del usuario (antes solo la trazabilidad).
  - Botón "Abrir Nodex…" solo si existe `URL_NODEX_GASTOS` / `URL_NODEX_TRAMITES`.
- **Correos fijos en `.env`** (si faltan, se usa el valor de siempre; se leen al enviar, no al cargar el módulo):
  - `CORREO_TESORERIA` (grupotesoreria@), `CORREO_LEGALIZACION` (legalizaciongastos@), `CORREO_TORRE_CONTROL` (torredecontrol@; también la copia de `emailServices.ts`), `CORREO_NOVEDADES_VEHICULOS` (novedadesvehiculos@, `notificacionesServices.ts`).
  - Ya no queda ningún correo escrito a mano en `src`.
- **Probado:** compila (`tsc --noEmit`) y se revisaron vistas previas renderizadas. **No se ha enviado un correo real** todavía. Las consultas de Legalización y reintegro no se pudieron probar contra la base (`10.0.4.4` no respondía).
- **Corrección (2026-10-04):** el correo de programación individual mostraba "Tipo de diligencia: N/A" porque `ProgramacionController` enviaba `tipoTramite` y la plantilla lee `tipo`. Ahora envía `tipo` (como la programación masiva).

### Notificaciones automáticas de WhatsApp configurables (2026-10-05)
- Las dos tareas de cron (diligencias de hoy 08:00 y vencidas 13:00, todos los días) ya no están fijas en el código: se borró `Schedulers/notificacionesDiligenciasScheduler.ts`.
- **Datos:** tabla `notificaciones_programadas` (modelo `models/notificacionProgramada.ts`, la crea `sync()`): una fila por `clave` (`DILIGENCIA_HOY`, `DILIGENCIA_VENCIDA`) con `hora` ("HH:MM", Colombia), `dias` (0 = domingo … 6, como cron), `activa`, quién hizo el último cambio y la última ejecución (origen PROGRAMADA/MANUAL, quién y resultado: encontradas, enviadas, sin teléfono, errores).
- **Servicio** `services/notificacionesProgramadas.ts`: `iniciarNotificacionesProgramadas()` se llama **después** de `connectDB()` (`server.ts`), crea las filas que falten con los valores de siempre y programa cada tarea con `node-cron` (zona `America/Bogota`). Si la tabla no responde, programa los valores por defecto. Al guardar un cambio la tarea se destruye y se reprograma en caliente, sin reiniciar. Un envío manual y uno programado de la misma tarea no corren a la vez.
- **API** `/api/notificaciones-programadas` (`GET /`, `PUT /:clave` con `{hora, dias, activa}`, `POST /:clave/enviar-ahora`). Permiso `puedeConfigurarNotificaciones` (`middleware/auth.ts`): Admin, Administrador de Torre de control y Torre de control; **el analista no**, aunque reciba Torre de control implícito.
- **Nodex Trámites:** página `/center/notificaciones` ("Notificaciones automáticas" en el menú) con `components/notificaciones/TarjetaNotificacionProgramada.tsx`: interruptor, hora, días (atajos "Lunes a viernes" / "Todos"), próximo envío, último envío y botón "Enviar ahora" (pide confirmación; envía aunque esté desactivada). Guard `requiereConfigurarNotificaciones` en `src/auth/dal.ts`.
- **Riesgo:** el programador vive en memoria. Con más de una instancia del backend cada una enviaría los mensajes y el cambio de hora solo se aplicaría en la que atendió la petición. Debe haber una sola instancia (ya era así).
- **Probado** contra la base de desarrollo: creación de filas, cambio de hora y días, desactivar y validaciones. No se probó "Enviar ahora" (enviaría WhatsApp reales).

### Nodex Trámites: `/center` reemplazado por el Dashboard (2026-10-05)
- `app/center/page.tsx` solo redirige a `/center/dashboard`; se borró `CenterPageClient.tsx` (listado viejo, el Dashboard ya tiene búsqueda, menú y eliminar, además de filtros).
- Se quitó la opción "Trámites" del menú (duplicaba el Dashboard) y todos los enlaces/redirecciones a `/center` apuntan a `/center/dashboard`.
- **Dashboard rediseñado al estilo de Nodex Gastos** (`DashboardSolicitudes.tsx`): encabezado con el total, panel de filtros con etiquetas (los mismos de antes) que se aplican con "Filtrar"/Enter, y tabla (Trámite, Estado con `EstadoTramite`, Cliente, Ubicación, Responsables, Fechas, menú). Los filtros y la página viajan en la URL (se conservan al volver del detalle). Estilos compartidos en `components/ui/estilos.ts` (copia de Gastos en sky). El menú de la fila usa `anchor` de Headless UI para no recortarse dentro de la tabla. `useSolicitudesFiltradas` ahora devuelve `total`.
- Corrección en `services/mensajeria/lugares.ts`: Google puede mandar componentes de dirección sin `types` (rompía la sugerencia "Data File S.A."); si no se puede proponer el municipio, el lugar se usa igual. `CampoDireccion` muestra un aviso cuando el lugar o el enlace fallan.

### Nodex Trámites: catálogos (2026-10-05)
- Página `/center/catalogos` ("Catálogos" en el menú; Administrador de Torre de control o Admin, guard `requiereAsignarAnalistas`): pestañas Tipos de trámite (cada uno despliega y administra sus subestados), Operaciones (con centro de costos) y Tipos de rechazo. Crear, renombrar y eliminar; muestra el uso de cada registro. Componente `components/catalogos/AdministrarCatalogos.tsx`.
- Backend `services/catalogosTramites.ts` + `routes/catalogosTramitesRouter.ts` (`/api/catalogos-tramites`: `GET /`, `POST /:tipo`, `PUT|DELETE /:tipo/:id`, tipo = tramites|operaciones|subestados|rechazos; permiso `puedeAsignarAnalistas`). Evita duplicados sin importar mayúsculas/espacios.
- **Tramitadores dentro de Catálogos:** las pestañas van en la URL (`/center/catalogos?pestana=tramitadores|tramites|operaciones|rechazos`). Tramitadores la ve todo Torre de control (como antes); las otras tres solo Administrador de Torre de control/Admin. `/center/tramitadores` redirige ahí; las acciones de tramitadores revalidan `/center/catalogos`. `AdministrarCatalogos` recibe la pestaña por prop.
- **Menú rehecho** (`components/menuCenter/centerMenu.tsx`): opciones en una lista por secciones (Seguimiento, Crear y cargar, Configuración) con la página actual resaltada, iniciales del usuario, scroll si no cabe y "Nuevo trámite". Mismas reglas de visibilidad de antes.
- **Solo se elimina lo que no se usa.** En la base las llaves tienen `ON DELETE CASCADE`: Operaciones → SolicitudTramites (¡borraría los trámites!), Tramites → SubEstados y SubEstados → SubEstadosSolicitud. TiposRechazo → EstadosTramites es SET NULL. Por eso se quitaron `POST/PUT/DELETE` de `/api/operaciones` y `/api/tramites` (cualquiera con acceso a trámites podía borrar; nadie los usaba desde el frontend); quedan solo los GET.

### API externa: trámites de los mensajeros (2026-10-05)
- `GET /api/externa/mensajeros/tramites` para otra plataforma. Sin sesión: encabezado `X-API-Key` = `API_KEY_EXTERNA` (.env; sin la variable responde 503). Solo lectura. `routes/apiExternaRouter.ts` + `services/apiExterna/tramitesMensajeros.ts`.
- Solo trámites de tramitadores con `esMensajero = true`, de cualquier estado. Campos: `tramitadorId`, `nombreTramitador`, `tramiteId`, `fechaInicio` (día de la diligencia, `fechaProbableEntrega` como en rutas), `horaInicio` (`horaCita`, "HH:MM" o null), `fechaFin` (`fechaFinalizacionServicio`, ISO o null), `municipio`, `departamento`, `direccion`, `latitud`, `longitud`, `tipoDiligencia`, `estado` (estado actual; "Sin iniciar" si no tiene).
- Filtros opcionales: `tramitadorId`, `estadoId`, `desde`/`hasta` (día de la diligencia, YYYY-MM-DD), `pagina`, `tamano` (100 por defecto, máx. 500). Respuesta `{ pagina, tamano, total, paginas, datos }`; errores de filtros → 400 `{ errores }`.
- Probado contra desarrollo: 903 trámites de mensajeros. **Para producción:** definir `API_KEY_EXTERNA` y entregarla a la otra plataforma por un canal seguro; si el backend queda detrás de Nginx con lista de IPs, permitir la IP de esa plataforma para `/api/externa`.

### Corrección: índices de `mensajeria_paradas` (2026-10-04)
- El arranque fallaba en `db.sync()` con `column "solicitudTramiteId" does not exist`: el modelo tiene `underscored: true` y `@Index` en la propiedad le pasa a Postgres el nombre del atributo, no el de la columna (`solicitud_tramite_id`).
- Los índices `mensajeria_paradas_tramite_fecha` (único) y `mensajeria_paradas_fecha_tramitador` pasaron a `@Table({ indexes })` con los nombres reales de columna (`models/mensajeria/paradaMensajeria.ts`). Ya se crearon en la base de desarrollo.
- El error existía también en Windows (misma base, mismas versiones de librerías) pero no se veía porque `connectDB()` no detiene el servidor; por eso `ajustarEsquemaMensajeria()`, `ajustarEsquemaGastos()` y `seedGastos()` no estaban corriendo. **Regla:** con `underscored: true`, definir índices en `@Table({ indexes })` con nombres de columna.

### Entorno de desarrollo en Mac (2026-10-04)
- Rama de trabajo: `desarrollo` (local, sigue a `origin/desarrollo`).
- Node.js LTS (v24) en `~/.local/node` y Redis 8 compilado en `~/redis`, ambos sin permisos de administrador; el `PATH` está en `~/.zshrc`.
- Redis no arranca solo al reiniciar: `~/redis/bin/redis-server --daemonize yes --dir ~/redis --logfile ~/redis/redis.log`; comprobar con `redis-cli ping`.
- Redis lo usa BullMQ (cola `notifications`). El worker **no** lo arranca `index.ts`: `npx ts-node src/workers/notificacionesWorker.ts` en otra terminal.
- `.env` creados en `Backend/` y en las tres apps de `Frontend/` (`API_URL=http://localhost:4000/api`; Trámites además `GASTOS_URL=http://localhost:3001`).
- **`node_modules` ya no está en git** (se sacaron 20.157 archivos de `Backend/node_modules` el 2026-10-06; el `.gitignore` los excluye). Cada equipo los instala con `npm ci`.

### Nodex Gastos: pago en tres pasos con aprobación de Dirección de Negocio (2026-10-06)
- **Flujo (gastos generales):**
  1. **Tesorería programa** (`POST /gastos/lotes`, `programarPago`): crea el lote `PROGRAMADO` con bolsa, fecha programada y `valorProgramado` por gasto; los gastos pasan a `PROGRAMADO`. **No descuenta la bolsa**, pero valida el disponible = saldo − total de lotes `PROGRAMADO`/`APROBADO` de esa bolsa.
  2. **Dirección de Negocio aprueba o rechaza** en Nodex (`POST /lotes/:id/aprobar` con `gastoIds` opcional = todos; `POST /lotes/:id/rechazar` con `gastoIds` y `motivo`). Aprobado → gasto `APROBADO_PAGO`; rechazado → vuelve a `SOLICITADO` (sale del lote, `valorProgramado` = null). Con todos los gastos restantes aprobados el lote pasa a `APROBADO` (`aprobadoPor`, `fechaAprobacion`); sin gastos, `RECHAZADO`. Después la Dirección aprueba en la plataforma del banco.
  3. **Tesorería confirma** (`POST /lotes/:id/confirmar` con `fechaPago` real): exige el lote `APROBADO` y **al menos un soporte del banco** adjunto al lote (`POST /lotes/:id/documentos`). Descuenta la bolsa (`registrarMovimientos`), gastos → `PAGADO` (`valorRealmentePagado` = `valorProgramado`, `fechaPago`, `bolsaId`), lote `PAGADO` (`confirmadoPor`, `fechaConfirmacion`).
  - Tesorería puede **quitar gastos** de un lote `PROGRAMADO` o `APROBADO` con motivo (`POST /lotes/:id/quitar`); vuelven a `SOLICITADO`.
- **Compras de certificados (CTL y Cámara de Comercio): pago directo, sin Dirección.** `POST /gastos/pagos` (`pagarDirecto`) crea el lote ya `PAGADO`, descuenta la bolsa y el soporte es opcional, como antes. `verificarFlujo` en `PagosController` impide programar certificados o pagar directo gastos generales.
- **Datos:** `gastos_lotes_pago` + `estado` (PROGRAMADO/APROBADO/PAGADO/RECHAZADO; los 12 lotes previos quedaron `PAGADO` por el DEFAULT), `aprobado_por`, `fecha_aprobacion`, `confirmado_por`, `fecha_confirmacion`; `gastos_solicitudes` + `valor_programado`. Estados de gasto nuevos `PROGRAMADO` ("Programado para pago") y `APROBADO_PAGO` ("Aprobado para pago"), reordenados (orden 1–8). Rol nuevo `DIRECCION_NEGOCIO`. Todo en `pagoProgramado()` (`ajustesEsquemaGastos.ts`) y el seed.
- **Transiciones** (`estadosGasto.ts`): SOLICITADO → PROGRAMADO | PAGADO (solo certificados) | ANULADO; PROGRAMADO → APROBADO_PAGO | SOLICITADO; APROBADO_PAGO → PAGADO | SOLICITADO.
- **"Pagado" ya no es "todo menos SOLICITADO/ANULADO":** `ESTADOS_SIN_PAGO` (constantes) se usa en el filtro `pagados=si`, el tablero (pagado; "Por pagar" incluye programado y aprobado) y reintegros por tramitador. `GET /lotes?egreso=` (Contabilidad) devuelve solo lotes `PAGADO`; `GET /lotes?estado=A,B` filtra por estado.
- **Permisos:** Dirección de Negocio ve todos los gastos y sus documentos (`ROLES_GASTOS` en `utilidades.ts`) y los lotes (`verLotes`).
- **Correos** (`notificacionesGastos.ts`):
  - Lote programado → todos los usuarios con perfil `DIRECCION_NEGOCIO` (`LOTE_PROGRAMADO`).
  - Lote aprobado completo → Tesorería (`LOTE_APROBADO`); gastos rechazados → Tesorería con el motivo (`LOTE_GASTOS_RECHAZADOS`).
  - **Gasto pagado** (creador, analista con copia a torre de control, torre de control): sale **solo al confirmar** (o en el pago directo). Dice "Tesorería confirmó el pago", quién aprobó en la Dirección y que el soporte del banco está en el detalle del gasto; fichas con "Lote de pago" y "Aprobado por" ("Pago directo (certificados)" si no hubo aprobación).
- **Frontend Gastos:**
  - Tesorería: "Por pagar" → botón **Programar pago** (`ModalPago` sin soporte, con "Valor a pagar" y fecha programada); en Certificados sigue **Pagar seleccionados** (`ModalPago directo`, con soporte). Pestaña nueva **Programados** (lotes PROGRAMADO/APROBADO, solo Tesorería general); "Pagos realizados" = lotes PAGADO.
  - Módulo nuevo **Aprobación de pagos** (`/direccion`, pestañas Por aprobar / Historial, detalle en `/direccion/lotes/[id]`).
  - `DetalleLote` según estado y modo (`tesoreria` | `direccion` | `contabilidad`): `GastosLote.tsx` (selección, aprobar todos/seleccionados, rechazar o quitar con motivo) y `ConfirmarPagoLote.tsx` (soporte + fecha real; el botón se activa solo con soporte). `ListadoLotes.tsx` reutilizable para las cuatro listas.
  - Inicio: Tesorería "por programar" y "aprobados por confirmar"; Dirección "por aprobar". Colores de los estados nuevos en `EstadoGasto.tsx`.
- **Probado en desarrollo:** esquema, estados, rol y rechazo de acciones sobre lotes ya pagados; correo de pagado con datos reales (sin enviar). **Falta la prueba completa** programar → aprobar → confirmar (no hay gastos SOLICITADO en desarrollo; descuenta una bolsa).

### Administración de usuarios en Nodex Trámites (2026-10-05)
- `/center/admin`: lista paginada (15 por página) con búsqueda y filtros por **perfil** (incluye "Sin acceso a trámites" y "Sin ningún perfil") y por **área**. Los perfiles del formulario de nuevo usuario van en cuadrícula por grupo.
- **Administrador de Torre de control** entra a Administración (`requiereAdministrarUsuarios`, menú) y solo maneja perfiles de trámites (`ROLES_TRAMITES` en constantes). El backend (`RolesGastosController`) responde 403 si intenta asignar o quitar perfiles de Gastos/Administración, o editar o cambiar la contraseña de usuarios que los tengan. Al guardar perfiles de un usuario de Gastos conserva sus perfiles de Gastos.
- Grupo Gastos de la tabla con `TESORERIA_CERTIFICADOS` y `DIRECCION_NEGOCIO`.

### 3. Nodex Gastos: pantallas
- **Legalización:**
  - Gastos sin factura: PAGADO, reembolsable y sin soporte del tramitador; muestra el estado del trámite.
  - Gastos con factura: la sección "Factura subida por el tramitador" más el FACTURADO de siempre.
  - Carga masiva de facturas, Soportes de tramitadores (`BandejaSoportes`), Reintegros, Reintegros por tramitador y Descargar documentos.
  - Componentes compartidos: `TablaGastosPorFacturar`, `SeguimientoTramitador.tsx` (etiquetas) y `ui/Buscador.tsx`.
- **Contabilidad → No reembolsables:** vistas `sin-factura`, `soportes` y `por-contabilizar`.
- **Administración `/admin`:** todos los gastos, con filtros, totales y paginación. Solo ADMIN.
- **Usuarios `/usuarios`:** módulo aparte (antes en admin).
- **Inicio:** rediseñado con tarjetas animadas y pendientes en vivo por rol. Las clases `aparecer` y `latido` están en `globals.css`.
- **Pestañas:** `components/ui/Pestanas.tsx` sin scroll; los títulos se parten en líneas centradas; se corrigió que se marcaran dos pestañas a la vez.

## Despliegue de ensayo en nodexgpa.com (2026-10-06)
Ensayo en el **mismo servidor Ubuntu** donde corre la producción actual (PM2, puertos 4000 y 3000), con una **copia de la base de producción**. Comandos completos en `deploy/GUIA_DESPLIEGUE_ENSAYO.md`; archivos listos en `deploy/` (`ecosystem.ensayo.config.js` para PM2 y `nginx-nodexgpa.conf`).

| App | Puerto (solo 127.0.0.1) | Dirección |
|---|---|---|
| API | 9000 | https://api.nodexgpa.com |
| Nodex Trámites | 9001 | https://tramites.nodexgpa.com |
| Nodex Gastos | 9002 | https://gastos.nodexgpa.com |
| Nodex Tramitadores | 9003 | https://tramitadores.nodexgpa.com |
| Worker de notificaciones | — | — |

**Cómo convive con producción sin cruzarse**
- **Puertos 9000–9003** escuchando solo en 127.0.0.1 (`HOST=127.0.0.1` en la API; `-H 127.0.0.1` en las apps Next). Al público se llega por Nginx con HTTPS; no abrir 9000–9003 en Azure ni en `ufw`.
- **Redis:** producción usa la base 0; el ensayo `REDIS_DB=1` (`config/redis.ts` lee `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB` y carga el `.env` por su cuenta). Antes la cola `notifications` era la misma y un worker podía tomar los trabajos del otro.
- **Modo ensayo** (`MODO_ENSAYO=si`, `utils/modoEnsayo.ts`): no programa los WhatsApp automáticos; `whatsappService` no llama a Twilio; `emailServices` manda todo **solo** a `CORREO_ENSAYO` (asunto `[ENSAYO · para …]`, sin copias; sin `CORREO_ENSAYO` no sale nada); el worker marca la notificación como `ERROR` "No enviado: modo ensayo", nunca `ENVIADO`. **Quitar al pasar a producción.**
- **Azure Files:** recurso compartido aparte (`AZURE_FILE_SHARE_NAME=nodex-ensayo`) para no sobrescribir ni borrar archivos de producción; los documentos viejos no abren en el ensayo.
- Procesos PM2 con prefijo `nodex-ensayo-` (se detienen con `pm2 stop /^nodex-ensayo-/` sin tocar producción).

**Paso a paso**
1. **Revisar el servidor:** `node -v` (≥ 18.17), `pm2 list`, puertos 80/443/9000–9003 libres, `redis-cli ping`.
2. **DNS:** registros A `tramites`, `gastos`, `tramitadores` y `api` → IP pública estática del servidor. NSG de Azure con 80 y 443 abiertos.
3. **Base de ensayo:** `nodex_pruebas` en el mismo Postgres (`10.0.4.4`), recreada el 2026-10-06 como copia de `nodex` (producción) a nombre de `desarrolloti` (`pg_restore --no-owner --role=desarrolloti`), para que los `ALTER TABLE` del arranque funcionen.
   - **Antes del primer arranque, asignación de analistas:** verificar que los ids 24, 45 y 55 sean Maria Orlinda, Jenny Velosa y Johan Diaz, y que `TRIM(Municipios.responsable)` diga exactamente esos nombres (corregir con `UPDATE` si no). El relleno de `analistaId` corre **una sola vez**.
4. **Código:** `git clone -b desarrollo` en `/home/desarrolloti/nodex5.0` (el repositorio ya no trae `node_modules`: los instala `npm ci`).
5. **`.env`** (no están en git; se crean a mano en el servidor):
   - Backend: `PORT=9000`, `HOST=127.0.0.1`, `NODE_ENV=production`, `JWT_SECRET` nuevo, `DB_HOST=10.0.4.4`, `DB_NAME=nodex_pruebas`, `DB_USER=desarrolloti`, `REDIS_DB=1`, `MODO_ENSAYO=si`, `CORREO_ENSAYO`, `AZURE_FILE_SHARE_NAME=nodex-ensayo`, correos de áreas, `URL_NODEX_GASTOS` y `URL_NODEX_TRAMITES` (botón "Abrir Nodex" en los correos; opcionales), Google y `API_KEY_EXTERNA` nueva.
   - Frontends: `API_URL=http://127.0.0.1:9000/api`; en Trámites además `GASTOS_URL`, `NEXT_PUBLIC_URL_APP_TRAMITADORES` y las claves de Google del navegador, **antes** de compilar.
   - Aunque un `.env` diga `PORT=4000`, PM2 arranca la API con `PORT=9000` (dotenv no reemplaza variables ya definidas).
6. **Instalar y compilar:** `npm ci && npm run build` en Backend y en las tres apps (sin `--production`). La API corre desde `dist/` (probado: los modelos cargan bien con `declaration: true`).
7. **Arrancar:** `pm2 start deploy/ecosystem.ensayo.config.js`; en el log de `nodex-ensayo-api`: "REST API en el puerto 9000", "Conexion Exitosa" y "🧪 MODO ENSAYO…". Luego `pm2 save`.
8. **Nginx y HTTPS:** copiar `deploy/nginx-nodexgpa.conf` a `sites-available`, `nginx -t`, recargar y `certbot --nginx` con los 4 subdominios. `ufw allow 'Nginx Full'`.
9. **Después del arranque:** `node dist/scripts/sincronizarEstadoActual.js` (sin y con `--aplicar`); asignar perfiles (Analista, Administrador Torre de control, Tesorería - Certificados, Dirección de Negocio); revisar la asignación de analistas.
10. **Pruebas:** login en las 3 apps con cada perfil; pago en tres pasos y pago directo de certificados; trámites (desistir, finalizar, programar); correos llegando solo a `CORREO_ENSAYO` y WhatsApp "NO enviado" en `pm2 logs nodex-ensayo-worker`; app de tramitadores desde un celular.

**Estado (2026-10-06): desplegado y funcionando** en https://tramites.nodexgpa.com, https://gastos.nodexgpa.com y https://tramitadores.nodexgpa.com (certificados Let's Encrypt con renovación automática).
- **Servidor:** `SRVWEBNOX02`, IP pública `20.186.19.92` (estática), privada `10.0.4.4`. Postgres local con `nodex` (producción), `nodex_do` (desarrollo) y `nodex_pruebas` (ensayo). PM2 corre como **root** (`/root/.pm2`); el ensayo se compila y arranca como root. Producción 4.5 en `/home/desarrolloti/nodex4.0` (`apiNodex4.5`, `Nodex4.5`, `worker4.5`, puertos 4000/3000). Otras apps en 3001, 3002, 5000, 5001 y 6001 (Vehículos, Inmuebles, `nodex_ga4.0`).
- **Nginx:** el sitio `app` (de la 4.5, `server_name _` → 3000/4000) sigue igual; el del ensayo es `/etc/nginx/sites-enabled/nodexgpa`. `api.nodexgpa.com` **solo publica `/api/externa`** (límite de 5 peticiones/s por IP); el resto da 404, porque las apps llaman a la API por `127.0.0.1:9000`.
- **Azure:** reglas de entrada 80 y 443 creadas; recurso compartido `nodex-ensayo` creado en la misma cuenta de almacenamiento que producción.
- **Base:** `nodex_pruebas` sin `analistaId` antes del primer arranque; los tres textos de `responsable` coincidían y cubren los 2.244 municipios. Se aplicaron `sincronizarEstadoActual` y la revisión de analistas.

**Lo que se aprendió en el ensayo** (ya está en las guías):
- **El `.env` del backend se arma, no se copia:** el primero que se puso era el de desarrollo (sin `MODO_ENSAYO`, sin `REDIS_DB`, con el recurso de Azure y el puerto de producción). Y al rehacerlo se perdieron `AZURE_STORAGE_CONNECTION_STRING`, `DB_PASSWORD`, `JWT_SECRET`, `SENDGRID_API_KEY`, `EMAIL_FROM` y las de Twilio: la API quedó en un ciclo de reinicios (`No está configurada AZURE_STORAGE_CONNECTION_STRING`) y sin `DB_PASSWORD` se queda esperando sin mensaje. Comparar siempre los nombres de variables con producción: `comm -23 <(grep -oE '^[A-Z_]+' prod/.env | sort -u) <(grep -oE '^[A-Z_]+' nuevo/.env | sort -u)`.
- **El worker lee el `.env` solo al arrancar:** después de corregir el `.env` hay que reiniciar también `nodex-ensayo-worker`.
- **El error real de la API no sale en `pm2 logs` cuando hay un ciclo de reinicios** (lo tapa el aviso de dotenv): arrancarla a mano con `timeout 30 node dist/index.js` desde `Backend/`.
- **Primer acceso:** la 4.5 no tiene perfiles; tras el arranque nadie tiene rol y todos ven "Sin acceso". Hay que darle ADMIN por SQL a quien administra (`dmorasu@gmail.com`) y asignar el resto desde Administración.
- **App de tramitadores redirigía a `localhost`:** el middleware armaba la URL del login con `request.url`. Corregido (commit `7886502f`): usa `Host` y `X-Forwarded-Proto`.

**Para volver el ensayo producción:** procedimiento completo en `deploy/GUIA_PASO_A_PRODUCCION.md` (respaldo, perfiles reutilizados del ensayo con `perfiles.sql`, apagar la 4.5, `.env` a `nodex` sin modo ensayo y con el recurso de Azure de producción, scripts de datos, redirección de la dirección vieja y plan B). Lo configurado en las pantallas del ensayo (catálogos, sedes y mensajeros, accesos a la app, Gastos) no pasa solo: se repite a mano.

## Checklist de paso a producción
> El procedimiento del día del cambio (del ensayo `nodex5.0` a la base `nodex`, con respaldo, perfiles, scripts y plan B) está en `deploy/GUIA_PASO_A_PRODUCCION.md`.
Todo se probó contra la base de **desarrollo**. Para producción, en este orden:

**Antes de desplegar**
1. Copia de seguridad de la base de producción.
2. **Ids de los analistas:** `seeds/ajustesEsquemaTramites.ts` convierte `Municipios.responsable` a ids (`'Maria Orlinda' → 24`, `'Jenny Velosa' → 45`, `'Johan Diaz' → 55`) y **solo corre una vez** (al crear la columna). **Confirmado por el usuario (2026-10-03): los ids son los mismos en producción.** Solo falta confirmar que el texto de `responsable` sea idéntico (sin contar espacios al inicio o al final); un nombre distinto deja esos municipios y sus trámites sin analista:
   ```sql
   SELECT responsable, COUNT(*) FROM "Municipios" GROUP BY 1;
   ```
3. **Permisos de la base:** los ajustes de esquema hacen `ALTER TABLE`. Si el usuario de producción no es dueño de las tablas, el arranque falla y un DBA debe crear las columnas a mano (y luego llenar los analistas con un script):
   ```sql
   ALTER TABLE "Municipios" ADD COLUMN "analistaId" INTEGER REFERENCES "Usuarios"(id) ON UPDATE CASCADE ON DELETE SET NULL;
   ALTER TABLE "SolicitudTramites" ADD COLUMN "analistaAsignado" INTEGER REFERENCES "Usuarios"(id) ON UPDATE CASCADE ON DELETE SET NULL;
   CREATE INDEX IF NOT EXISTS "solicitud_tramites_analista_asignado" ON "SolicitudTramites"("analistaAsignado");
   ```
   (Mismo caso para los ajustes previos: columnas de retención en `gastos_solicitudes` y `tramitadorId`/`tipoDocumento` en `DocumentosSolicitud`; y para el pago en tres pasos:)
   ```sql
   ALTER TABLE gastos_lotes_pago ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'PAGADO';
   ALTER TABLE gastos_lotes_pago ADD COLUMN aprobado_por INTEGER REFERENCES "Usuarios"(id);
   ALTER TABLE gastos_lotes_pago ADD COLUMN fecha_aprobacion TIMESTAMP WITH TIME ZONE;
   ALTER TABLE gastos_lotes_pago ADD COLUMN confirmado_por INTEGER REFERENCES "Usuarios"(id);
   ALTER TABLE gastos_lotes_pago ADD COLUMN fecha_confirmacion TIMESTAMP WITH TIME ZONE;
   ALTER TABLE gastos_solicitudes ADD COLUMN valor_programado DECIMAL(15, 2);
   ```
4. **Claves de Google separadas y restringidas** (paso a paso en "Seguridad: claves y accesos" más abajo):
   - Clave del **servidor** (`GOOGLE_MAPS_API_KEY` del backend): restringida a la **IP pública del servidor** y solo a Geocoding API, Routes API y Places API (New).
   - Clave del **navegador** (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` de Nodex Trámites): restringida al **dominio** de Nodex Trámites y solo a Maps JavaScript API.
   - **Nunca la misma clave para los dos:** la del navegador la ve cualquiera que abra la página.
   - Cuotas diarias y alerta de presupuesto en Google Cloud.
5. **Clave nueva de la API externa:** generar una distinta a la de desarrollo (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`) y pedir a la otra plataforma la IP pública desde la que va a consultar.

**Desplegar**
6. Backend, **worker de notificaciones** (proceso aparte, cambió; necesita Redis) y Nodex Trámites (y Nodex Gastos / Tramitadores con los cambios previos).
   - En Nodex Trámites correr `npm install` **con dependencias de desarrollo** (no `--production`): Leaflet y react-leaflet para los mapas y `@types/google.maps`, que necesita `next build`.
7. **Variables del backend** (`Backend/.env`):
   - `GOOGLE_MAPS_API_KEY`: la clave del servidor (paso 4). Sin ella, las rutas funcionan en modo manual y sin trazado por calles.
   - `API_KEY_EXTERNA`: la clave nueva del paso 5. Sin ella, `/api/externa` responde 503.
   - Correos: `CORREO_TESORERIA`, `CORREO_LEGALIZACION`, `CORREO_TORRE_CONTROL`, `CORREO_NOVEDADES_VEHICULOS` y, si se quiere el botón en los correos, `URL_NODEX_GASTOS` y `URL_NODEX_TRAMITES`.
   - **No** poner `NEXT_PUBLIC_...` en el `.env` del backend (no se usa ahí).
8. **Variables de Nodex Trámites** (`Frontend/frontend/.env`), **antes** de `next build` (las `NEXT_PUBLIC_` quedan fijas en el build; si se cambian hay que volver a compilar):
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: la clave del navegador (paso 4). Sin ella el mapa de rutas usa OpenStreetMap.
   - `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`: Map ID propio (opcional; sin él usa `DEMO_MAP_ID`).
   - `NEXT_PUBLIC_URL_APP_TRAMITADORES` (ya pendiente de antes).
9. Arranque: confirmar en el log "Conexion Exitosa" y no "Fallo la Conexion…" (crea los índices de `mensajeria_paradas`); columnas de analistas y retención, y roles creados (`ANALISTA_TRAMITES`, `ADMIN_TORRE_CONTROL`, `TESORERIA_CERTIFICADOS`, `DIRECCION_NEGOCIO`); estados de gasto `PROGRAMADO` y `APROBADO_PAGO`. Deben salir también "⏰ Diligencias de hoy…" y "⏰ Diligencias vencidas…".
10. **Una sola instancia del backend** (PM2 sin modo cluster): el programador de WhatsApp y la caché del trazado de rutas viven en memoria.

**Después de desplegar**
11. **Primero darle ADMIN a quien administre** (la versión 4.5 no tiene perfiles: tras el arranque nadie tiene rol y todos ven "Sin acceso"; SQL en la guía de despliegue, paso 9). Luego, desde Administración, asignar roles en Usuarios: Analista de trámites, Administrador Torre de control, Tesorería - Certificados y **Dirección de Negocio** (con su correo: le llegan los lotes por aprobar).
    - **Antes de desplegar el pago en tres pasos**, que Tesorería pague lo que tenga en curso: después, todo gasto general debe pasar por la aprobación de Dirección.
12. Mensajes de WhatsApp ya guardados (primero sin `--aplicar`):
    `TS_NODE_TRANSPILE_ONLY=1 npx ts-node src/scripts/corregirMensajesWhatsapp.ts [--aplicar]`
13. Estado actual de los trámites (el Excel de estados no lo actualizaba; primero sin `--aplicar`). **Necesario también para** el filtro "Estado" de la búsqueda de gestión masiva, el tablero y la API externa:
    `TS_NODE_TRANSPILE_ONLY=1 npx ts-node src/scripts/sincronizarEstadoActual.ts [--aplicar]`
14. **Verificar permisos con un usuario de cada perfil:**
    - Gestión de activos: no ve Gestión masiva (ni en el menú ni el botón del Dashboard), ni Reportados como realizados, ni Catálogos; en el detalle del trámite ve el reporte de "realizado" pero no el botón de revisar.
    - Analista: en el Dashboard ve solo sus trámites y encuentra cualquiera buscando por número o identificación (con la etiqueta "No asignado a ti").
    - Torre de control: ve Catálogos solo con la pestaña Tramitadores. Admin / Administrador de Torre de control: las cuatro pestañas.
15. **Verificar Google:** abrir Rutas de mensajeros con un día que tenga diligencias; el mapa debe ser de Google y las líneas ir por las calles. Si sale un recuadro rojo, ver la consola (F12): `RefererNotAllowedMapError` = falta el dominio en la clave del navegador; `ApiNotActivatedMapError` = falta habilitar Maps JavaScript API. Probar también el autocompletado de dirección al crear un trámite (usa la clave del servidor: si falla con "REQUEST_DENIED", la IP del servidor no está en la lista de la clave).
16. **Verificar la API externa** desde el servidor de la otra plataforma (paso a paso abajo) y entregar la clave por un canal seguro (no correo ni chat).
17. Avisar a Torre de control: el cargue de estados por Excel ahora notifica (Desistido por WhatsApp; Novedad y Finalizado por correo), y el "Programador" de las notificaciones es el analista asignado. Además: gestión masiva con varias acciones a la vez y búsqueda por filtros, Catálogos (tipos de trámite, subestados, operaciones, rechazos y tramitadores) y el menú nuevo.
18. Explicar a Tesorería y a Dirección de Negocio el pago en tres pasos (programar → aprobar en Nodex y en el banco → adjuntar soporte y confirmar) y que los certificados se siguen pagando directo. Avisar a Tesorería, Legalización, analistas y torre de control de los correos nuevos: gasto creado y reintegro del tramitador (grupotesoreria@), trámite finalizado con factura (legalizaciongastos@), gasto pagado (analista con copia a torredecontrol@) y trámite desistido (a quien lo creó).
19. **No borrar operaciones, tipos de trámite ni subestados directamente en la base:** las llaves tienen `ON DELETE CASCADE` (borrar una operación borra sus trámites). Hacerlo solo desde Catálogos, que bloquea lo que está en uso.

### Seguridad: claves y accesos (paso a paso)

**A. Averiguar la IP pública de salida del servidor**
Es la IP con la que el backend llega a Google (puede ser distinta de la IP por la que entran los usuarios). Desde el servidor:
```bash
curl -s https://api.ipify.org; echo
```
En Azure, la VM debe tener **IP pública estática** (Recurso de IP pública → Configuración → Asignación: Estática). Si la salida es por NAT Gateway o Firewall, la IP es la de ese recurso. Si la IP cambia, Google rechaza las consultas del backend.

**B. Clave del servidor (backend) restringida por IP**
1. [Google Cloud Console](https://console.cloud.google.com/) → elegir el proyecto → **APIs y servicios → Biblioteca**: verificar habilitadas **Geocoding API**, **Routes API** y **Places API (New)**.
2. **APIs y servicios → Credenciales → Crear credenciales → Clave de API**. Renombrarla, por ejemplo "Nodex backend (producción)".
3. En **Restricciones de aplicaciones** elegir **Direcciones IP** y agregar la IP del paso A (una por línea; se puede agregar también la IP de desarrollo de la oficina si se quiere usar la misma clave allí — mejor una clave aparte para desarrollo).
4. En **Restricciones de API** elegir **Restringir clave** y marcar solo Geocoding API, Routes API y Places API (New).
5. Guardar (puede tardar hasta 5 minutos en aplicar) y ponerla en `GOOGLE_MAPS_API_KEY` del backend.
6. Probar desde el servidor (debe responder `"status" : "OK"`; si responde `REQUEST_DENIED` con "This IP … is not authorized", la IP no coincide):
   ```bash
   curl -s "https://maps.googleapis.com/maps/api/geocode/json?address=Medellin&key=LA_CLAVE" | head -5
   ```

**C. Clave del navegador (Nodex Trámites) restringida por dominio**
1. Habilitar **Maps JavaScript API** en el mismo proyecto.
2. Crear otra clave ("Nodex Trámites mapa (producción)").
3. **Restricciones de aplicaciones → Sitios web (referentes HTTP)** y agregar el dominio de Nodex Trámites, por ejemplo `https://tramites.midominio.com/*` (y `http://localhost:3000/*` solo en la clave de desarrollo).
4. **Restricciones de API → Restringir clave**: solo **Maps JavaScript API**.
5. Ponerla en `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` de Nodex Trámites y compilar.
6. Opcional: **Google Maps Platform → Administración de mapas → Crear ID de mapa** (tipo JavaScript, vectorial) y ponerlo en `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`.

**D. Cuotas y presupuesto (evita cobros sorpresa)**
1. **Facturación → Presupuestos y alertas → Crear presupuesto** (por ejemplo USD 10) con alertas al 50 %, 90 % y 100 % al correo de sistemas.
2. **APIs y servicios → (cada API) → Cuotas y límites del sistema**: poner un tope diario por debajo del cupo gratis (10.000/mes ≈ 300/día), por ejemplo:
   - Maps JavaScript API (cargas del mapa): 300 por día.
   - Routes API (trazado y optimización): 300 por día.
   - Geocoding API y Places API (New): 300 por día.
   Si se llega al tope, Google rechaza las consultas de ese día (el mapa cae a líneas rectas y la ubicación queda manual) en lugar de cobrar.
3. Cada mes revisar **Google Maps Platform → Métricas** para ver el uso real y ajustar.

**E. API externa (`/api/externa`) solo desde la IP de la otra plataforma**
La API ya exige la clave `X-API-Key`. Como segunda barrera, permitir solo la IP de la plataforma que la consume:
1. Pedirle a esa plataforma su **IP pública de salida** (la obtienen igual que en el paso A).
2. Si el backend queda detrás de Nginx (arquitectura propuesta), agregar en el `server` del backend:
   ```nginx
   location /api/externa/ {
       allow 203.0.113.10;   # IP de la otra plataforma
       deny all;
       limit_req zone=externa burst=20 nodelay;   # opcional: límite de peticiones
       proxy_pass http://127.0.0.1:4000;
   }
   ```
   (y en el bloque `http`: `limit_req_zone $binary_remote_addr zone=externa:1m rate=5r/s;`). Recargar con `sudo nginx -t && sudo systemctl reload nginx`.
3. Si no hay Nginx, hacer lo mismo en el **Grupo de seguridad de red (NSG)** de Azure: regla de entrada al puerto del backend permitida solo desde esa IP (esto cierra todo el puerto, no solo `/api/externa`, así que solo sirve si el backend no recibe otras conexiones directas).
4. Probar desde el servidor de la otra plataforma (debe responder 200; desde otra IP, 403 de Nginx):
   ```bash
   curl -s -H "X-API-Key: LA_CLAVE" "https://api.midominio.com/api/externa/mensajeros/tramites?tamano=2"
   ```
5. Si la clave se filtra: generar otra, cambiar `API_KEY_EXTERNA`, reiniciar el backend y entregarla de nuevo.

## Decisiones tomadas
- **Comentarios del tramitador** en una tabla propia, no en la Trazabilidad, porque la trazabilidad alimenta las notificaciones al cliente.
- **"Realizado"** es un reporte; no cambia el estado oficial. Solo Torre de Control lo revisa (2026-10-05): la bandeja `/center/reportesRealizado` tiene guard de perfil, no sale en el menú de Gestión de activos y `GET|POST /seguimiento-tramitador/reportes-realizado*` exigen `TORRE_CONTROL`. En el detalle del trámite Gestión de activos ve el reporte pero no el botón de revisar.
- **Gestión masiva:** solo Torre de Control (menú, página, backend y ahora también el botón del Dashboard).
- **Archivos del tramitador:** quedan aparte hasta que se aprueban; al aprobarse se copian a `gastos_documentos`.
- **Reintegro aprobado** = `marcarReintegradoEn` (el dinero vuelve a la bolsa).
- **Tramitador del gasto:** `COALESCE(gasto.tramitador_id, tramite.tramitadorId)`.
- **"Boleta de reintegro" e "Ingreso"** se crearon como dos tipos separados (el pedido fue ambiguo).
- **CTL y Cámara de Comercio** son dos tipos de gasto distintos; en CTL la placa y la matrícula son opcionales.
- **Pago en tres pasos (2026-10-06, decidido por el usuario):** la Dirección de Negocio aprueba también en Nodex (perfil propio); un gasto no aprobado vuelve a Por pagar (no se anula); la bolsa se descuenta al confirmar el pago, no al programar; el soporte del banco es obligatorio para confirmar; los certificados no pasan por la Dirección.
- **Correo "por aprobar"** va a todos los usuarios con perfil Dirección de Negocio (no a un correo fijo del `.env`).

## Pendientes y riesgos
1. **Arranque del backend:** confirmado el 2026-10-04 (`REST API en el puerto 4000` + `Conexion Exitosa`) tras corregir los índices de `mensajeria_paradas`. Sigue el riesgo de que `connectDB()` esconda errores; se propuso detener el servidor si falla (sin confirmar).
2. **Pruebas de certificados incompletas.** No hay gastos SOLICITADO en la base, así que no se probó el rechazo del pago. Un script que llamó a `seedGastos()` se colgó; los datos sí quedaron insertados.
3. **GAS-2026-000012** tiene la factura registrada, pero su soporte del tramitador sigue PENDIENTE: hay que aprobarlo.
4. **GAS-000008 y GAS-000009** (no reembolsables, PAGADO): sus trámites no tienen tramitador, así que nadie puede subirles la factura desde la app.
5. **Cargue masivo de gastos:** deduce el tipo por placa o matrícula y no permite CTL ni Cámara de Comercio. Falta una columna "Tipo".
6. **Reintegros de no reembolsables:** hoy se ven en Legalización; falta confirmar si deben ir a Contabilidad.
7. **Correos nuevos sin prueba real:** crear y pagar un gasto de un trámite con analista, desistir un trámite, finalizar un trámite cuyo gasto tenga factura del tramitador y subir un reintegro desde la app, para verificar la entrega por SendGrid.
   - **Por confirmar con el usuario:** si Contabilidad debe recibir un aviso igual por los gastos no reembolsables con factura, y si el correo a Legalización debe exigir además el reporte "Realizado".
8. **Pago en tres pasos sin prueba completa:** crear un gasto de prueba, programarlo, aprobarlo con un usuario Dirección de Negocio, adjuntar soporte y confirmar; revisar la bolsa, los correos y la lista de egresos de Contabilidad. En desarrollo descuenta una bolsa (devolver con un ajuste).
9. **`node_modules` en git:** resuelto el 2026-10-06 (`git rm -r --cached Backend/node_modules`). Al hacer `git pull` en otro equipo que todavía los tenga versionados, git los borrará del disco: correr `npm ci` en `Backend` después del pull.
10. **HTTPS:** resuelto en el ensayo (Let's Encrypt en los 4 subdominios de nodexgpa.com); la cookie `secure` de la app de tramitadores ya funciona. La 4.5 sigue por HTTP en la IP hasta el paso a producción.
11. **Claves de Google:** en el servidor ya hay dos claves nuevas (servidor restringida a `20.186.19.92`, navegador restringida a `https://tramites.nodexgpa.com/*`). La clave de desarrollo de los `.env` locales sigue sin restricción por IP: restringirla (fase 0.2, paso 4).
12. **Seguridad del servidor (encontrado en el despliegue):** Postgres escucha en `0.0.0.0:5432`, y la API (4000) y Nodex (3000) de la 4.5 están abiertas directo; `ufw` está inactivo, así que la única barrera es el NSG de Azure. Verificar que el NSG **no** permita 5432, 3000, 4000 ni 9000–9003 desde Any.
13. **`API_KEY_EXTERNA` del ensayo es la de desarrollo** (quedó escrita en el chat): generar una nueva antes de entregarla a la otra plataforma. El `JWT_SECRET` del ensayo es el mismo de producción (decisión del usuario): una sesión del ensayo sirve contra la API de producción.
14. **Redis 6.0.16:** BullMQ recomienda 6.2 o más. Funciona; actualizar con calma porque la producción usa el mismo Redis.
15. **Avisos de lint en Trámites** (5, no frenan el build) y un botón de documentos en `SolicitudTramitesForm` que cambia un estado que nada muestra (`TODO`).

## Próximos pasos sugeridos
- **Ensayo (fase 7):** pruebas con un usuario de cada perfil (guía de ensayo, paso 10): pago en tres pasos, certificados, trámites (desistir, finalizar, programar), correos solo a `CORREO_ENSAYO`, WhatsApp "NO enviado", mapa de rutas con Google, autocompletado de dirección, API externa y la app de tramitadores desde un celular.
- **Paso a producción:** cuando el ensayo pase, seguir `deploy/GUIA_PASO_A_PRODUCCION.md` (anotar antes lo configurado en las pantallas del ensayo que se quiera conservar).
- Confirmar que el backend arranca y asignar el rol "Tesorería - Certificados" en Usuarios.
- Probar en el navegador: carga masiva de facturas, descarga ZIP, bandejas de Legalización y Contabilidad, y el flujo de certificados con un gasto real.
- Agregar la columna "Tipo" a la plantilla del cargue masivo.
- Ofrecidos sin confirmar:
  - Carga masiva de facturas también en Contabilidad (no reembolsables).
  - Avisos por WhatsApp al tramitador (soporte rechazado, respuesta a un comentario).
  - Lista de IPs permitidas en Nginx para Trámites y Gastos (Tramitadores queda público) y Postgres solo en 127.0.0.1 / 10.0.4.4.
  - PWA en Android: sin HTTPS Chrome solo crea un acceso directo con su logo. Con HTTPS, más un service worker básico y un ícono "maskable" con margen, queda como app.
