// Genera lector_v2.html a partir del prototipo, aplicando las correcciones de la medición.
// Uso: node construir_v2.js <html original>
const fs = require('fs'), path = require('path')
let h = fs.readFileSync(process.argv[2], 'utf8')
const cambia = (antes, despues, nombre) => {
  if (!h.includes(antes)) throw new Error('No se encontró: ' + nombre)
  h = h.replace(antes, despues)
}

// 0. Librería de códigos ZXing C++ (WebAssembly), servida localmente
cambia(`<script>document.getElementById('logo')`,
  `<script src="/node_modules/zxing-wasm/dist/iife/reader/index.js"></script><script>ZXingWASM.prepareZXingModule({overrides:{locateFile:p=>'/node_modules/zxing-wasm/dist/reader/'+p},fireImmediately:true});</script>\n<script>document.getElementById('logo')`, 'carga zxing-wasm')

// 1. Envía: el número puede empezar por 03, 04, 01, 95… (12 dígitos)
cambia(`formatoGuia:/^03\\d{10}$/,`, `formatoGuia:/^\\d{12}$/,`, 'formato Envía')

// 2. Lector de códigos nuevo (async) + QR de factura electrónica (NumFac, ValTolFac)
cambia(`function leeBarras(canvas){if(!window.ZXing)`, `async function leeBarras(canvas){
 if(!window.ZXingWASM){const v=leeBarrasJS(canvas);return{...v,facturas:[]}}
 const numeros=new Set(),largos=new Set(),facturas=[],textos=new Set();
 const op={formats:['Code128','Code39','Code93','ITF','EAN-13','QRCode','DataMatrix','PDF417'],tryHarder:true,tryRotate:true,tryInvert:true,tryDownscale:true,maxNumberOfSymbols:10};
 const lados=Math.max(canvas.width,canvas.height);
 for(const c of [canvas].concat(lados>2000?[escala(canvas,2000)]:[])){try{const id=c.getContext('2d').getImageData(0,0,c.width,c.height);for(const r of await ZXingWASM.readBarcodes(id,op))textos.add(r.text)}catch(e){}}
 for(const v of textos){
  const f=v.match(/NumFac:\\s*O[A-Z]\\d{2}(\\d{8,14})/);
  if(f){const g='0'+f[1],val=(v.match(/ValTolFac:\\s*([\\d.]+)/)||[])[1];facturas.push({guia:g,valor:val?Math.round(+val):null});numeros.add(g);continue}
  const url=v.match(/[?&](?:id|guia|numero|remesa|tracking|n)=(\\d{8,16})\\b/i);
  if(url)numeros.add(url[1]);else if(/^\\d{8,16}$/.test(v))numeros.add(v);else if(/^\\d{17,}$/.test(v))largos.add(v)}
 return{numeros:[...numeros],largos:[...largos],facturas}}
function leeBarrasJS(canvas){if(!window.ZXing)`, 'leeBarras')

// 3. El código de barras manda sobre el texto; el valor del QR de factura también
cambia(`const codigos=leeBarras(lienzo),barras=codigos.numeros;`, `const codigos=await leeBarras(lienzo),barras=codigos.numeros;`, 'await barras')
cambia(`suma(acum.guia,d,todo.includes(d)?20:8,'Código de barras')}`, `suma(acum.guia,d,50,'Código de barras')}
 for(const f of codigos.facturas||[])if(f.valor)suma(acum.valor,f.valor,30,'QR factura');`, 'peso barras')

// 4. PDF con texto: también se dibuja para leer sus códigos (número confirmado y QR de factura)
cambia(`if(txt.replace(/\\s/g,'').length>=80)out.push({texto:txt,etiqueta:file.name+' (p. '+i+')'});`,
  `if(txt.replace(/\\s/g,'').length>=80){const v=pg.getViewport({scale:2}),c=document.createElement('canvas');c.width=v.width;c.height=v.height;await pg.render({canvasContext:c.getContext('2d'),viewport:v}).promise;out.push({texto:txt,lienzoCodigos:c,etiqueta:file.name+' (p. '+i+')'})}`, 'PDF dibujado')
cambia(`if(pg.texto){const p=parsear(pg.texto,'Texto PDF');`, `if(pg.texto){const p=parsear(pg.texto,'Texto PDF');
     if(pg.lienzoCodigos){const cod=await leeBarras(pg.lienzoCodigos);for(const d of cod.numeros){if(p.perfil&&p.perfil.formatoGuia&&!p.perfil.formatoGuia.test(d))continue;suma(p.c.guia,d,50,'Código de barras')}for(const f of cod.facturas)if(f.valor)suma(p.c.valor,f.valor,30,'QR factura');p.barras=cod.numeros}`, 'PDF barras')
cambia(`leidos.push({c:p.c,perfil:p.perfil,archivo:f.name,etiqueta:pg.etiqueta,texto:pg.texto})`, `leidos.push({c:p.c,perfil:p.perfil,archivo:f.name,etiqueta:pg.etiqueta,texto:pg.texto,barras:p.barras||[]})`, 'PDF barras en salida')

// 5. Valor de Envía en PDF: la etiqueta y el monto quedan en líneas distintas
cambia(`[rx(String.raw\`(?:FLETE|COSTO(?:\\s*DEL?\\s*ENVIO)?)[^\\d\\n]{0,8}\`+DINERO),2]],`,
  `[rx(String.raw\`(?:FLETE|COSTO(?:\\s*DEL?\\s*ENVIO)?)[^\\d\\n]{0,8}\`+DINERO),2],[rx(String.raw\`(?:TOTAL\\s*FLETE|VAL\\s*SERV\\s*ME)\\s*\\n\\s*\`+DINERO),8]],`, 'valor PDF Envía')

// 6. Destinatario: no tomar el texto legal del PDF de Envía; si el nombre viene enmascarado, "Recibido por"
cambia(`|COLOMBIA|VERIFICAR/.test(s)`, `|COLOMBIA|VERIFICAR|SUMINISTRADA|TRATAMIENTO|RECIBIRAN/.test(s)`, 'exclusiones destinatario')
cambia(` if(!perfil)return;
 if(perfil.id==='envia'){`, ` for(const m of U.matchAll(/RECIBIDO\\s*POR\\s*:?\\s*\\n?\\s*([A-ZÑ][A-ZÑ ]{5,})/g)){const s=sinRuido(m[1]);if(esNombre(s))suma(c.destinatario,s,1,origen)}
 if(!perfil)return;
 if(perfil.id==='envia'){`, 'recibido por')

// 7. Forma de pago y reporte de rastreo
cambia(`function vacio(){return{perfil:{},guia:[],`, `function vacio(){return{perfil:{},rastreo:[],guia:[],`, 'vacio')
cambia(`for(const k of['guia','valor','fecha','fee','admision','fechaDoc','destinatario','pago','etiquetaValor','etiquetaFecha'])`, `for(const k of['rastreo','guia','valor','fecha','fee','admision','fechaDoc','destinatario','pago','etiquetaValor','etiquetaFecha'])`, 'combina')
cambia(` destinatario(U,perfil,c,origen);
 if(/VALOR`, ` destinatario(U,perfil,c,origen);
 if(/CONTRA\\s?ENTREGA|AL\\s*C[O0]BR[O0]|A_\\s*C[O0]BR[O0]|RECAUDAR\\s*EN\\s*DESTINO|-COD\\b/.test(U))suma(c.pago,'CONTRAENTREGA',1,origen);
 if(/\\bCONTADO\\b(?!-COD)/.test(U))suma(c.pago,'CONTADO',1,origen);
 if(/VR\\.?\\s*A\\s*COBRAR|VALOR\\s*A\\s*COBRAR/.test(U))suma(c.pago,'VALOR A COBRAR',1,origen);
 if(/REPORTE DE HISTORIAL|SIGUE TU ENVIO|^\\W*HISTORIAL\\b|RASTREO DE (?:TU )?ENVIO/m.test(U))suma(c.rastreo,1,1,origen);
 if(/VALOR`, 'pago y rastreo')

// 8. Estado: sin código de barras (o texto propio del PDF), el número queda por revisar
cambia(`if(guia&&verif==='Solo texto'&&guia.peso<4)obs.push('Número de guía con poca evidencia.');`,
  `if(guia&&!guia.origenes.has('Código de barras')&&!guia.origenes.has('Texto PDF'))obs.push('Número de guía sin confirmar con el código de barras: verifícalo en la imagen.');`, 'regla OK')

// 9. Servientrega: fecha con mes 00 → día de la guía y mes de la admisión
cambia(`else obs.push('La guía trae la fecha con el mes en 00 o ilegible: no se transcribe; complétala.')}`,
  `else if(adm){const a=leeTxt(adm);let m=a.m,y=a.y;if(fee.valor<a.d){m++;if(m>12){m=1;y++}}fecha=fechaTxt({d:fee.valor,m,y});obs.push('La guía trae el mes en 00: se tomó el mes de la fecha de admisión.')}
  else obs.push('La guía trae la fecha con el mes en 00 o ilegible: no se transcribe; complétala.')}`, 'fecha Servientrega')

// 10. Salida: forma de pago, rastreo y verificación
cambia(`return{transportadora:perfil?perfil.nombre:'',numeroGuia:`, `const pagos=mejor(c.pago).map(x=>x.valor),esRastreo=c.rastreo.length>0&&!dest;
 if(esRastreo)obs.unshift('El documento parece un reporte de rastreo, no la guía.');
 return{pago:pagos.join(' / '),esRastreo,verificacion:verif,transportadora:perfil?perfil.nombre:'',numeroGuia:`, 'salida')

// 11. Año mal leído (2025 por 2026): si con el año de la admisión la fecha queda coherente, se corrige
cambia(`if(dias<0||dias>45){const a2=`, `if(dias<0||dias>45){const f2={...f,y:a.y},d3=(fechaNum(f2)-fechaNum(a))/864e5;if(f.y!==a.y&&d3>=0&&d3<=45){fecha=fechaTxt(f2);obs.push('Año de la fecha de entrega corregido con el de la admisión: se leyó '+f.y+'.')}else{const a2=`, 'año fecha')
cambia(`fecha=''}}}`, `fecha=''}}}}`, 'cierre año fecha')
// 12. Más textos que no son nombres
cambia(`|SUMINISTRADA|TRATAMIENTO|RECIBIRAN/`, `|SUMINISTRADA|TRATAMIENTO|RECIBIRAN|SATISFACCION|RECIBI\\b/`, 'exclusiones 2')

const out = path.join(__dirname, 'lector_v2.html')
fs.writeFileSync(out, h)
console.log('Escrito', out)
