# Lector de Guías para Nodex: nota para Tecnología

Iniciativa #24. Es un prototipo para que Tecnología lo valide y lo ajuste antes de integrarlo en Nodex.

## Qué contiene esta carpeta

| Archivo | Para qué sirve |
|---|---|
| `Lector de Guias Nodex.html` | El lector completo en un solo archivo. Se abre en Chrome o Edge y necesita internet para cargar las librerías. |
| `GUIA ENVIA 2.jpg` | La guía de prueba. |
| `LEEME para Tecnologia.md` | Esta nota. |

## Prueba con la guía de muestra

**Guía individual.** Cargar `GUIA ENVIA 2.jpg` y pulsar **Leer guía**. Debe transcribir:

| Campo en Nodex | Resultado esperado |
|---|---|
| Número de Guía | 036003708656 |
| Valor del Envío | $ 14.700 |
| Transportadora | Envía (Colvanes) |
| Destinatario | GELVER DIAZ CUBIDES |
| Fecha Probable de Entrega | 09/10/2026 |

**Carga masiva.** Agregar la misma guía, escribir el Nodex `5487`, pulsar **Repetir guía**, escribir `5490`, repetir de nuevo y escribir `5491`. Luego pulsar **Leer guías**. Debe salir una guía con tres Nodex, cada uno con **$ 4.900**. Los códigos son solo de ejemplo.

## Qué hace

Lee guías en PDF o imagen, de cualquier transportadora, y extrae los 5 campos de la pantalla «Programación Logística». Solo transcribe lo que está en la guía.

- **Guía individual:** se carga una guía y se transcribe la información.
- **Carga masiva:** cada fila lleva un código Nodex y su guía.
  - Si varios Nodex comparten una guía, se repite la guía en varias filas y el valor se divide entre ellos.
  - La división es en pesos enteros y siempre suma el total: 16.900 entre 16 da 4 de 1.057 y 12 de 1.056.
  - Cada archivo se lee una sola vez. Las filas se unen por el número de guía leído.
- **Contraentrega:** el valor lo asume el cliente y puede no aparecer. Si la guía no trae el valor, no se considera error.
- **Fecha:** es la estimada o programada que trae la guía. La entrega real sale del seguimiento.

## Cómo integrarlo

El motor (`GuiaOCR`) está separado de la pantalla:

```js
// Individual
const { registros, errores } = await GuiaOCR.procesar([file], onProgreso);

// Masivo: una fila por Nodex
const { registros, errores } = await GuiaOCR.procesarLote(
  [{ nodex: '5487', file }, { nodex: '5490', file }],
  onProgreso
);
```

| Campo (JSON) | Contenido |
|---|---|
| `numeroGuia` | Número de Guía |
| `valorEnvio` | Valor total de la guía, numérico o `null` |
| `transportadora` | Transportadora identificada |
| `destinatario` | Destinatario |
| `fechaProbableEntrega` | Fecha Probable de Entrega, `DD/MM/AAAA` |
| `nodex`, `distribucion` | Solo en masivo: los códigos y el valor asignado a cada uno (`[{ nodex, valorAsignado }]`) |
| `soportes`, `estado`, `observaciones` | Archivos de origen, `OK` o `Revisar`, y el motivo |

Para otra transportadora no hace falta programar nada: las reglas generales buscan por etiquetas. Se puede agregar un perfil en `PERFILES` para reforzar la lectura de una marca. Con `opts.soloGenerico` se desactivan los perfiles para probar.

## Qué queda a cargo de Tecnología

1. **Validar el código Nodex y su relación con la guía.** El lector no toma el trámite de lo escrito en la guía ni comprueba que el código exista. Está abierto si la relación sale de lo que digita la persona o de un listado de la analista.
2. **Mapear la Transportadora al desplegable de Nodex.** El lector devuelve texto, por ejemplo `Envía (Colvanes)`.
3. **Conectar la grabación en Nodex.** Hoy el resultado sale en pantalla, Excel y JSON. No escribe en Nodex.
4. **Definir el destino del valor sin leer.** Cuando la guía no lo trae, el campo queda vacío.
5. **Alojar las librerías internamente.** Hoy se cargan por CDN: pdf.js 3.11.174, Tesseract.js 5.1.0 (idioma español), SheetJS 0.20.3 y ZXing 0.21.3.
6. **Tratar los datos personales.** Las imágenes se procesan en el navegador y no se envían a un servicio de OCR. Las guías traen nombres, teléfonos y documentos, así que una versión en servidor debe cumplir la política de datos.

## Resultados de la prueba

Muestra: 11 fotos reales de 5 transportadoras (Envía, Interrapidísimo, Servientrega, TCC y Coordinadora), equivalentes a 10 guías, comparadas con la lectura manual de las imágenes.

| Campo | Resultado | Detalle |
|---|---|---|
| Número de Guía | 9 de 10 | `GUIA SERVIENTREGA 3` da `9192659443` en lugar de `9192659445` y no lo marca como duda en ese campo |
| Valor del Envío | 8 de 8 | TCC y Coordinadora no lo traen en la muestra |
| Fecha Probable de Entrega | 6 de 8 | Las otras 2 quedan vacías y en `Revisar`, porque Servientrega imprime el mes como `00` o borroso |
| Destinatario exacto | 6 de 10 | Los otros 4 tienen errores menores o les falta una línea |

- **Tiempo:** unos 7 segundos por imagen en este equipo.
- **Reparto del valor:** 28 Nodex en 10 guías, con la suma correcta en todas.
- **Edición:** al corregir una celda se recalcula el reparto, y si dos filas quedan con el mismo número de guía se unen.

## Limitaciones conocidas

- **Un dígito errado puede pasar inadvertido.** Si el número de guía se confirma con un código de barras o QR, es más confiable. En fotos de baja calidad depende solo del OCR, por eso hay que validar antes de grabar.
- **Errores de OCR en nombres:** algunos quedan en estado `OK`. En la muestra salió `YVENITH` por `YENITH`, con la guía en `OK`.
- **Corrección de fechas en Interrapidísimo:** en 2 guías el año no se leía bien y se ajustó con la fecha de admisión de la misma guía. Las dos quedan en `Revisar` con una nota, para decidir si se conserva esa regla o se deja vacío.
- **Coordinadora:** solo hay una guía real de muestra. Falta probar más.
- **PDF:** no se probó con PDF originales de transportadoras.
- **Velocidad:** el OCR en navegador tarda más que los 2 segundos que muestra el demo de la iniciativa. Para acercarse a eso, conviene evaluar OCR en servidor.
- **No se leen:** datos manuscritos ni números de guía con letras (solo numéricos de 8 a 16 dígitos).
