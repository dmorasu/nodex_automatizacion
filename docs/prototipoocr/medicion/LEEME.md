# Medición del lector de guías (OCR)

Mide el motor del prototipo contra las guías que Torre de control ya adjuntó en producción, comparando con la logística digitada. Ver el pendiente 19 de `RESUMEN_TECNICO_NODEX.md`.

Las guías descargadas tienen datos personales: quedan en `archivos/`, que **no va al repositorio** (`.gitignore`). Bórrelas al terminar.

## Pasos (desde esta carpeta)

```bash
npm install                                   # puppeteer-core y zxing-wasm (usa el Chrome instalado)
node descargar.js "<ruta>/TC/Backend" .       # solo lectura: base nodex y Azure → archivos/ y manifiesto.json
node construir_v2.js "../Lector de Guias Nodex.html"   # genera lector_v2.html (prototipo + correcciones)
SALIDA=resultados_v2.jsonl node correr.js "$(pwd)/lector_v2.html" 4   # 4 en paralelo, ~40 min, se puede reanudar
node evaluar.js resultados_v2.jsonl           # tabla por transportadora y tipo de archivo
```

- `correr.js`: abre el lector en Chrome sin ventana y le pasa cada guía. `SOLO=27,93` corre solo esos documentos.
- `barras.js`: solo códigos de barras con zxing-wasm (segundos).
- `texto.js <html> <docId...>`: muestra el texto que extrae el motor de unos documentos.
- `diagnostico.js`: causas de error (barras, destinatario, fecha, sin lectura).
- `eval_v1.txt` y `eval_v2.txt`: resultados del 2026-11-09 (prototipo original y versión 2).

## Resultado del 2026-11-09 (737 guías)

| Campo | Prototipo | Versión 2 |
|---|---|---|
| Número de guía | 79 % | 89 % (PDF 97 %) |
| Transportadora | 92 % | 95 % |
| Fecha probable | 65 % | 78 % |
| Valor | 35 % | 58 % (Envía 66 %) |
| Destinatario | 26 % | 31 % |

Las 25 guías "OK" que difieren de lo digitado son errores de digitación o documentos de otra guía. 117 documentos son reportes de rastreo, no guías.
