import os
D=os.path.dirname(os.path.abspath(__file__))
IMG='file://'+D+'/img/'
VER='Versión 1.1 · Octubre 2026'

CSS='''
@page{size:Letter;margin:18mm 16mm 18mm 16mm}
:root{--ink:#1B2733;--muted:#5D6C7A;--line:#DCE3E9;--accent:#0E7C66;--soft:#DDF1EB;--paper:#FFFFFF;--tint:#F3F6F8;
 --ok:#1E8E3E;--okbg:#E2F4E7;--err:#C8232D;--errbg:#FDE6E7;--warn:#8A5A00;--warnbg:#FFF2D2;--info:#1F4FA8;--infobg:#E9F0FF;
 --f:"Nunito","Segoe UI",Arial,sans-serif}
*{box-sizing:border-box}
html,body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--f);font-size:10.6pt;line-height:1.5}
h1,h2,h3{line-height:1.2;text-wrap:balance;margin:0}
h2{font-size:17pt;font-weight:900;margin:0 0 4mm;padding-top:2mm;break-after:avoid}
h3{font-size:12.5pt;font-weight:900;margin:5mm 0 2mm;break-after:avoid}
p{margin:0 0 2.6mm;max-width:165mm}
b{font-weight:800}
.portada{height:243mm;display:flex;flex-direction:column;justify-content:space-between;break-after:page}
.portada .banda{background:var(--accent);color:#fff;border-radius:6mm;padding:14mm 12mm}
.portada .eyebrow{font-size:10pt;font-weight:900;letter-spacing:.18em;opacity:.85}
.portada h1{font-size:34pt;font-weight:900;margin:5mm 0 3mm}
.portada .para{font-size:14pt;font-weight:700;opacity:.95}
.portada .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
.portada .meta div{border-top:2px solid var(--line);padding-top:2.5mm;font-size:9.5pt;color:var(--muted)}
.portada .meta b{display:block;color:var(--ink);font-size:11pt}
.portada .resumen{font-size:12pt;max-width:150mm;color:var(--ink)}
.indice{break-after:page}
.indice ol{padding-left:6mm;margin:0;columns:1}
.indice li{padding:1.6mm 0;border-bottom:1px dotted var(--line);font-weight:700}
.indice li span{color:var(--muted);font-weight:600}
section{break-before:page}
section.cont{break-before:auto;margin-top:8mm}
.lead{font-size:11.5pt;color:#334351}
.paso{display:grid;grid-template-columns:9mm 1fr;gap:3mm;margin:3mm 0;break-inside:avoid}
.paso .n{width:9mm;height:9mm;border-radius:50%;background:var(--accent);color:#fff;font-weight:900;display:grid;place-items:center;font-size:11pt}
.paso .t b:first-child{display:block;font-size:11pt}
figure{margin:3mm 0 5mm;break-inside:avoid}
figure img{display:block;max-width:100%;max-height:92mm;width:auto;height:auto;object-fit:contain;object-position:left top;border:1px solid var(--line);border-radius:2.5mm}
figure.chico img{max-width:105mm;max-height:125mm}
figure.mini img{max-width:70mm}
figcaption{font-size:8.8pt;color:var(--muted);margin-top:1.5mm}
.nota{border-radius:2.5mm;padding:3mm 4mm;margin:3mm 0;break-inside:avoid;font-size:10pt}
.nota b.tit{display:block;margin-bottom:1mm}
.nota.info{background:var(--infobg);color:#20365F}
.nota.ok{background:var(--okbg);color:#1F4A2A}
.nota.warn{background:var(--warnbg);color:#5A3E00}
.nota.err{background:var(--errbg);color:#6A1E23}
.k{display:inline-block;border:1px solid #C9D1D8;background:var(--tint);border-radius:1.5mm;padding:0 1.6mm;font-weight:800;font-size:9.5pt;white-space:nowrap}
.btn-v{background:#1E8E3E;color:#fff;border-color:#1E8E3E}
.btn-n{background:#C26A00;color:#fff;border-color:#C26A00}
.tag{display:inline-block;padding:0 2mm;border-radius:1.5mm;font-size:8.5pt;font-weight:900;letter-spacing:.04em}
.tag.pv{background:#D3F1E8;color:#0E6E5C}.tag.rb{background:#FBDDEB;color:#A3195B}
table{border-collapse:collapse;width:100%;margin:2mm 0 5mm;font-size:9.6pt;break-inside:auto}
th,td{text-align:left;vertical-align:top;padding:2mm 2.5mm;border-bottom:1px solid var(--line)}
th{background:var(--tint);font-size:8.4pt;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
tr{break-inside:avoid}
.st{display:inline-block;padding:.4mm 2.4mm;border-radius:99px;font-weight:800;font-size:8.8pt;white-space:nowrap}
.dos{display:grid;grid-template-columns:1fr 1fr;gap:4mm;break-inside:avoid}
.dos .si{background:var(--okbg);border-radius:2.5mm;padding:3mm 4mm}
.dos .no{background:var(--errbg);border-radius:2.5mm;padding:3mm 4mm}
.dos ul{margin:1mm 0 0;padding-left:4.5mm}.dos li{margin:1mm 0}
.dos .si h3{color:var(--ok);margin:0}.dos .no h3{color:var(--err);margin:0}
'''

EST=[('Nuevo traspaso','#1F63D6','#E2ECFF','Creado y etiquetado. Espera a que pase gestoría.'),
 ('Recolectado por gestoría','#9A6400','#FFF0CC','Va en camino con un gestor.'),
 ('Entregado por gestor, falta confirmar','#0E7C66','#D9F2EA','El gestor lo marcó entregado en su app. Falta que el destino lo escanee.'),
 ('En Recepción Oficinas','#8A4B12','#F6E7D8','Está en pausa en el stand del patio de Oficinas.'),
 ('En Logística','#38559E','#E5EBF7','Llegó a Logística: por enviar a Morelia o por distribuir.'),
 ('Enviado por paquetería','#0B6C80','#DAF2F7','Va o viene de Morelia con número de guía.'),
 ('Entregado','#1B7F38','#DFF3E5','El destino lo escaneó y llegaron todos los bultos.'),
 ('Recibido con incidencia','#C4440B','#FFE8DA','Llegó, pero faltan bultos o llegó dañado.'),
 ('El traspaso está en…','#7036B8','#EFE5FB','Se escaneó en un lugar que no es su destino.'),
 ('Extraviado','#C8232D','#FDE6E7','No aparece. Lo marca un administrador.'),
 ('Eliminación solicitada','#4E5B67','#E8ECF0','Congelado hasta que responda un administrador.')]

def estatus():
    return '<table><thead><tr><th style="width:62mm">Estatus</th><th>Qué significa</th></tr></thead><tbody>'+''.join(
      f'<tr><td><span class="st" style="color:{c};background:{b}">● {n}</span></td><td>{s}</td></tr>' for n,c,b,s in EST)+'</tbody></table>'

def fig(n,cap,cls=''):
    return f'<figure class="{cls}"><img src="{IMG}{n}.png" alt=""><figcaption>{cap}</figcaption></figure>'
def paso(i,tit,txt):
    return f'<div class="paso"><div class="n">{i}</div><div class="t"><b>{tit}</b>{txt}</div></div>'
def nota(tipo,tit,txt):
    return f'<div class="nota {tipo}"><b class="tit">{tit}</b>{txt}</div>'
def tabla(cab,filas,anchos=None):
    th=''.join(f'<th{(" style=\"width:"+anchos[i]+"\"") if anchos and anchos[i] else ""}>{c}</th>' for i,c in enumerate(cab))
    return f'<table><thead><tr>{th}</tr></thead><tbody>'+''.join('<tr>'+''.join(f'<td>{c}</td>' for c in f)+'</tr>' for f in filas)+'</tbody></table>'
def sino(si,no):
    return '<div class="dos"><div class="si"><h3>✓ Sí</h3><ul>'+''.join(f'<li>{x}</li>' for x in si)+'</ul></div><div class="no"><h3>✕ No</h3><ul>'+''.join(f'<li>{x}</li>' for x in no)+'</ul></div></div>'

def doc(titulo,para,resumen,secciones):
    toc=''.join(f'<li>{t} <span>· {d}</span></li>' for t,d,_ in secciones)
    body=''.join(f'<section{" class=cont" if i and secciones[i][1]=="" else ""}><h2>{i+1}. {t}</h2>{h}</section>' for i,(t,d,h) in enumerate(secciones))
    return f'''<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><title>{titulo}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap"><style>{CSS}</style></head><body>
<div class="portada"><div class="banda"><div class="eyebrow">FADERMEX · LOGÍSTICA · TRASPASOS</div><h1>{titulo}</h1><div class="para">{para}</div></div>
<p class="resumen">{resumen}</p>
<div class="meta"><div><b>Sistema</b>Página de Traspasos</div><div><b>Elaboró</b>Logística FADERMEX</div><div><b>Edición</b>{VER}</div></div></div>
<div class="indice"><h2>Contenido</h2><ol>{toc}</ol></div>
{body}</body></html>'''

INTRO_COMUN='''<p class="lead">La página de <b>Traspasos</b> sustituye el archivo de Excel. Cada traspaso tiene un <b>folio único</b> por área (por ejemplo <b>NR-0001</b>), una <b>etiqueta con código de barras por bulto</b> y una <b>línea de tiempo</b> con cada movimiento: quién lo creó, quién lo llevó y quién lo recibió.</p>
<p>Todo queda <b>centralizado</b> en un solo lugar, se registra <b>automáticamente</b> al escanear y se guarda <b>en línea</b>. No se pierde si se apaga la computadora.</p>'''

# ===================== SUCURSALES =====================
suc=[
('Qué es y cómo entrar','la página, tu área y los avisos', INTRO_COMUN+
 '<h3>Entrar</h3>'+paso(1,'Abre la página','con el acceso directo <b>Traspasos</b> del escritorio. Ya está con la cuenta de Google de tu sucursal.')+
 paso(2,'Elige tu área','PV o Rebotica. Solo puedes elegir las áreas de tu sucursal; las demás salen en gris con 🔒. La página recuerda el área: no tienes que elegirla cada día.')+
 fig('s01_entrada','Pantalla de entrada: tus áreas están activas; las de otras sucursales, bloqueadas.')+
 nota('info','La campana 🔔','avisa cuando algo nuevo viene para tu sucursal: un traspaso nuevo, uno en camino o uno que quedó en otro lugar. El número rojo indica los avisos sin ver. Al abrirla solo salen los <b>avisos nuevos</b>; ya vistos, desaparecen.')+
 nota('info','Botón ❓ Ayuda','Arriba, junto a la campana. Abre este manual en PDF, siempre en su versión más reciente.')+fig('h01_ayuda','El botón ❓ Ayuda abre el manual de tu área.','mini')+
 nota('warn','Salir','Usa <b>Salir</b> solo si Logística te lo pide. Si sales, tendrás que volver a elegir tu área.')),
('Mi bandeja','lo que entra y lo que sale',
 '<p><b>Entrantes</b>: todo lo que llega a tu sucursal, para PV o para Rebotica. Cualquiera de la sucursal lo puede recibir; cada traspaso trae su etiqueta <span class="tag pv">PARA PV</span> o <span class="tag rb">PARA REBOTICA</span> para saber a quién entregarlo.</p><p><b>Salientes</b>: lo que sale de tu área. Las fichas de colores de arriba filtran por estatus. Haz clic en un traspaso para ver su detalle.</p>'+
 fig('s02_bandeja','Mi bandeja → Entrantes.')+fig('s02b_salientes','Mi bandeja → Salientes, con el estatus de cada traspaso.')),
('Crear un traspaso','4 pasos, folio y etiquetas automáticos',
 paso(1,'Nuevo traspaso → escanea tu credencial','Es obligatorio: queda registrado quién lo creó. El número de la credencial se ve como ●●●● y después solo aparece tu nombre. Con la pistola no hace falta presionar Enter.')+
 fig('s03_credencial','Paso 1: credencial. Si no tienes, abre "¿Sin credencial? Teclea usuario y NIP".')+
 paso(2,'Elige el destino','La lista trae todas las áreas activas, agrupadas por sucursal. Abajo se muestra la ruta que seguirá.')+
 nota('ok','¿A qué área de Oficinas lo mando?','Al elegir un área de Oficinas, aparece a la derecha un aviso con <b>lo que normalmente se le manda</b> (por ejemplo, a Coordinación PV: facturas a pago, notas de crédito, contraseñas y cortes diarios). Si lo que envías no es nada de eso, revisa que sea el área correcta.')+
 fig('s04_destino','Paso 2: al elegir un área de Oficinas, el aviso de lo que normalmente se le manda.')+
 paso(3,'Escribe qué envías y cuántos bultos','Si el destino es de Oficinas, abajo salen como botones los documentos que normalmente van a esa área: tócalos para agregarlos sin escribir. Con <span class="k">+</span> y <span class="k">−</span> ajustas los bultos. A la derecha ves cómo saldrá la etiqueta.')+
 fig('s05_contenido','Paso 3: sugerencias de lo que va a esa área, bultos y vista previa de la etiqueta.')+
 paso(4,'Generar traspaso e imprimir','Se crea el folio y se imprime <b>una etiqueta por bulto</b>. Pega cada una en su bulto.')+
 fig('s06_listo','Paso 4: traspaso creado y etiquetas impresas.')+
 fig('s06b_etiqueta','La etiqueta de 5 × 2 cm: folio, bulto (1/3), código de barras y destino.','mini')+
 nota('info','Sin credencial','Abre <b>"¿Sin credencial? Teclea usuario y NIP"</b> y escribe tu usuario (o número de empleado) y tu NIP. Si no tienes, pídeselos a un administrador.')),
('Entregar al gestor','salida de tu sucursal',
 paso(1,'Escáner → botón naranja "Entregar a gestor"','')+
 paso(2,'Escanea la credencial de quien se lo lleva','El gestor o cualquier persona registrada que transporta los paquetes. En pantalla solo aparece su nombre.')+
 fig('s09a_entregar','Primero se identifica quién se lo lleva.')+
 paso(3,'Agrega los traspasos','<b>Tres formas, mismo resultado:</b> escanea la etiqueta, teclea el folio, o <b>tócalo en la lista de abajo</b> "Creados aquí, por entregar" (solo salen los que creó tu área y siguen en <i>Nuevo traspaso</i>).')+
 fig('s09b_por_entregar','Abajo: lo que creó tu área y falta entregar. Toca uno para agregarlo.')+
 paso(4,'Confirmar salida','Quedan como <span class="st" style="color:#9A6400;background:#FFF0CC">● Recolectado por gestoría</span> y al destino le llega el aviso.')+
 fig('s09_entregar','Lista de traspasos que se lleva el gestor.')),
('Recibir traspasos','entrada a tu sucursal',
 paso(1,'Escáner → botón verde "Recibir traspasos"','')+
 paso(2,'Escanea TU credencial','Es obligatorio en sucursales: queda registrado quién recibió.')+
 fig('s07_recibir','Antes de escanear etiquetas, se identifica quien recibe.')+
 paso(3,'Agrega los traspasos','Escanea las etiquetas (se agregan solas, sin Enter), teclea el folio o tócalo en la lista de abajo. Fíjate en <span class="tag pv">PARA PV</span> / <span class="tag rb">PARA REBOTICA</span> para entregarlo a quien corresponde.')+
 paso(4,'Si falta un bulto o llegó dañado','marca <span class="k">Faltan / dañado</span> en esa fila.')+
 paso(5,'Confirmar recepción','Queda <span class="st" style="color:#1B7F38;background:#DFF3E5">● Entregado</span> (o <i>Recibido con incidencia</i>) y al origen le llega el aviso.')+
 fig('s08_recibir_fila','Traspasos en la lista, listos para confirmar.')+
 '<h3>Lista "Vienen para aquí"</h3><p>Abajo aparecen los traspasos que van para tu sucursal y todavía no se reciben: los que vienen <b>en ruta con un gestor</b> y los que siguen en <b>Nuevo traspaso</b> (a alguien se le olvidó darles salida).</p>'+
 paso('★','Escanea la credencial del gestor que llega (opcional)','Lo que <b>trae ese gestor</b> sale <b>en color</b>: hay certeza de que viene con él. Lo demás sale <b>en gris</b> y se ilumina al pasar el cursor. Cualquiera se puede tocar para agregarlo.')+
 fig('s08b_vienen','En color, lo que trae José Luis; en gris, uno que nadie registró al salir.')+
 nota('warn','Llegó y nadie registró la recolección','Si el gestor olvidó registrar la salida, igual se recibe. La fila sale en amarillo con el aviso y queda anotado en la historia.')),
('Alertas del escáner','qué hacer cuando sale rojo',
 '<p>La página revisa cada escaneo al momento y <b>cada situación tiene su sonido</b>. Con unos días de uso, el oído los reconoce sin mirar la pantalla.</p>'+tabla(['Sonido','Cuándo suena'],[
  ['<b>Dos notas rápidas que suben</b>','Escaneo correcto o credencial reconocida.'],
  ['<b>Dos campanas que suben y se quedan sonando</b>','Se guardó: recepción, salida, traspaso creado o recolección de Botican.'],
  ['<b>Dos toques iguales</b>','Ojo: ya estaba en la lista, alguien se saltó un paso o solo se guardó una parte.'],
  ['<b>Tres campanas que bajan</b>','Error: no se puede hacer lo que intentaste. Lee el mensaje en rojo.'],
  ['<b>Campanita de tres notas</b>','Llegó un aviso nuevo a la campana 🔔.']],['70mm',''])+
 fig('n01_avisos','En la campana, "🔊 Conoce los sonidos" deja escuchar cada uno.','chico')+
 fig('s10_error','Ejemplo: un traspaso que no es para tu sucursal.')+
 tabla(['Mensaje','Qué hacer'],[
  ['<b>"Este traspaso NO es para tu sucursal"</b>','No lo recibas. Presiona <b>Registrar que está aquí</b>: se avisa al origen, al destino y a administración.'],
  ['<b>"Ese folio no existe"</b>','Revisa que esté bien escrito o vuelve a escanear la etiqueta.'],
  ['<b>"Ya está en la lista"</b>','Ya lo escaneaste; no pasa nada.'],
  ['<b>"Ya fue recibido anteriormente"</b>','Ese traspaso ya se había recibido antes.'],
  ['<b>"Tiene una solicitud de eliminación pendiente"</b>','No lo muevas hasta que responda un administrador.']],['70mm',''])),
('Botican: Recolección pedidos BOTICAN','sin bitácora de papel',
 '<p>Solo en la computadora de <b>Botican</b>. Sustituye la bitácora en papel de los pedidos que se lleva el gestor. La lista sale de la bitácora de Botican (hoja <b>Envios</b>).</p>'+
 paso(1,'Pestaña dorada "📦 Recolección pedidos BOTICAN"','')+
 paso(2,'El gestor escanea su credencial','Funciona como firma: queda su nombre, la hora y la lista. En pantalla solo sale su nombre.')+
 paso(3,'Marca o escanea los pedidos que se lleva','Salen los pedidos <b>📋 Elaborado</b>. Los <b>🧪 En elaboración</b> salen en gris y no se pueden marcar. También se puede teclear el número (#15996 o 15996).')+
 fig('b01_botican','Dos pedidos marcados; el que sigue en elaboración, en gris.')+
 paso(4,'Confirmar recolección','Se genera el acuse <b>RB-0001</b>. En la bitácora de Botican se escribe el gestor en <b>"Recolección de Gestor"</b> y el estatus cambia solo a <b>🧍 RECOLECCIÓN DE GESTOR</b>. Lo recolectado desaparece de la lista.')+
 fig('b02_acuse','Acuse de la recolección. Puede pasar el siguiente gestor.')+
 nota('info','Foráneos','También se recolectan. Logística decide después la forma de envío.')),
('Detalle, reimprimir y eliminar','la historia de cada traspaso',
 '<p>Haz clic en cualquier traspaso para ver su <b>línea de tiempo</b>: cada movimiento con fecha, hora, persona y lugar.</p>'+
 fig('s11_detalle','Detalle y línea de tiempo.','chico')+
 '<h3>Reimprimir una etiqueta</h3><p>Abre el traspaso → <span class="k">Reimprimir etiqueta</span> → elige qué bulto (o todos) y el motivo. La nueva sale marcada <b>R1</b>, R2… y queda registrado.</p>'+
 fig('s12_reimprimir','Reimprimir: bulto y motivo.','chico')+
 '<h3>Solicitar eliminación</h3><p>Solo desde el área que lo creó y <b>antes de entregarlo al gestor</b>. Escribe el motivo; un administrador lo aprueba o rechaza. Mientras tanto queda congelado.</p>'+
 fig('s13_eliminar','Solicitud de eliminación con motivo obligatorio.','chico')),
('Estatus y reglas','colores, sí y no, Morelia',
 estatus()+
 sino(['Una etiqueta en <b>cada</b> bulto','Escanear al entregar y al recibir','Revisar si es PARA PV o PARA REBOTICA','Marcar <b>Faltan / dañado</b> cuando aplique','Registrar dónde está un traspaso que llegó por error'],
      ['Volver a capturar en Excel','Prestar tu credencial o tu NIP','Escribir folios a mano en lugar de imprimir','Recibir algo que no es para tu sucursal','Pegar una etiqueta en el bulto equivocado'])+
 '<h3>Morelia</h3><p>Lo que va o viene de Morelia pasa por <b>Logística</b> y viaja por <b>paquetería con guía</b>. Morelia, para mandar a Oficinas, captura la paquetería y la guía en su pestaña <b>Paquetería</b>.</p>'),
('Problemas comunes','',
 tabla(['Problema','Solución'],[
  ['"La credencial no está registrada"','Teclea tu usuario y NIP, y avisa a un administrador para que registre tu credencial.'],
  ['No imprime la etiqueta','Revisa que la etiquetadora esté encendida y sea la impresora predeterminada. Después usa <b>Reimprimir etiqueta</b>.'],
  ['Salen etiquetas cortadas o corridas','Avisa a Logística: se ajusta el tamaño de etiqueta de tu sucursal.'],
  ['La página dice "Tu sesión terminó"','Vuelve a elegir tu área.'],
  ['No veo un traspaso que debería llegar','Revisa la campana 🔔 y pídele a Logística que lo busque por folio.']],['65mm',''])),
]

# ===================== OFICINAS Y RECEPCIÓN =====================
ofi=[
('Qué es y cómo entrar','Oficinas trabaja con la cuenta abierta', INTRO_COMUN+
 paso(1,'Abre la página y elige tu área','Contabilidad, Compras, Logística… Solo están activas las áreas de tu cuenta.')+
 nota('info','Campana 🔔 y ❓ Ayuda','La campana solo muestra los <b>avisos nuevos</b>; al verlos desaparecen. El botón ❓ abre este manual en PDF, siempre en su versión más reciente.')+
 nota('ok','En Oficinas no se escanea credencial','Para crear y para recibir se usa la cuenta abierta en tu computadora: queda registrado con tu correo. La credencial solo se escanea para identificar a quien se lleva los traspasos (gestor).')+
 fig('o01_bandeja','Mi bandeja de un área de Oficinas.')),
('Crear un traspaso','sin credencial',
 paso(1,'Nuevo traspaso','Empieza directo en el destino: no pide credencial.')+
 fig('o02_nuevo','Nuevo traspaso en Oficinas: se usa la cuenta abierta.')+
 paso(2,'Destino, qué envías y bultos','')+
 paso(3,'Generar traspaso e imprimir','Sale el folio de tu área (ej. <b>CONT-0001</b>).')+
 nota('warn','Las etiquetas se imprimen en Recepción','La etiquetadora está conectada a la computadora de Recepción Oficinas. Si tu computadora no tiene impresora de etiquetas, cancela la ventana de impresión y lleva tus bultos a Recepción: ahí imprimen tus etiquetas desde el <b>Centro de Impresión</b>.')+
 nota('ok','Lo que va fuera de Oficinas sale por Recepción','Si el destino es una sucursal (o cualquier lugar fuera de Oficinas), <b>baja el paquete al stand de Recepción y listo</b>: no tienes que registrar nada más. El gestor le da salida ahí con su credencial. Si pasan 36 horas sin salida, te llega un aviso.')+
 nota('info','Entre áreas de Oficinas','Si el destino es otra área de Oficinas, es una entrega interna: <b>se lleva en mano</b> (no pasa por Recepción) y el área destino lo recibe escaneándolo.')+
 nota('info','Reimprimir','Abre el traspaso → <span class="k">Reimprimir etiqueta</span>. Solo el área que lo creó.')),
('Recibir y entregar','escáner',
 '<h3>Recibir</h3>'+paso(1,'Escáner → "Recibir traspasos"','Escanea las etiquetas (se agregan solas), teclea el folio o tócalo en la lista <b>"Vienen para aquí"</b> de abajo. No pide credencial.')+
 nota('info','Lista "Vienen para aquí"','Lo que va para tu área en ruta con un gestor o en <i>Nuevo traspaso</i>. Si escaneas la credencial del gestor que llega, lo que él trae sale en color; lo demás, en gris.')+paso(2,'Confirmar recepción','Queda <span class="st" style="color:#1B7F38;background:#DFF3E5">● Entregado</span>.')+
 fig('o03_recibir','Recibir en Oficinas: directo, sin credencial.')+
 '<h3>Entregar al gestor</h3>'+paso(1,'Escáner → "Entregar a gestor"','Escanea la credencial de quien se lo lleva; luego escanea, teclea o toca en la lista <b>"Creados aquí, por entregar"</b>, y <b>Confirmar salida</b>.')+
 '<h3>Sonidos</h3>'+tabla(['Sonido','Cuándo suena'],[
  ['<b>Dos notas rápidas que suben</b>','Escaneo correcto o credencial reconocida.'],
  ['<b>Dos campanas que suben y se quedan sonando</b>','Se guardó: recepción, salida, traspaso creado o recolección de Botican.'],
  ['<b>Dos toques iguales</b>','Ojo: ya estaba en la lista, alguien se saltó un paso o solo se guardó una parte.'],
  ['<b>Tres campanas que bajan</b>','Error: no se puede hacer lo que intentaste. Lee el mensaje en rojo.'],
  ['<b>Campanita de tres notas</b>','Llegó un aviso nuevo a la campana 🔔.']],['70mm',''])),
('Logística','recibir, distribuir y paquetería a Morelia',
 '<p>Logística recibe lo que va a Morelia y lo que viene de Morelia, y distribuye a las demás áreas.</p>'+
 paso(1,'Recibir en Logística','Escáner → Recibir. Lo que va a Morelia queda <span class="st" style="color:#38559E;background:#E5EBF7">● En Logística</span>.')+
 paso(2,'Armar caja para Morelia','<b>Paquetería → Armar caja</b>: escanea los traspasos que van dentro → <b>Crear caja e imprimir etiqueta</b>. Sale un folio de caja <b>CJ-0001</b>.')+
 paso(3,'Registrar el envío en "Operaciones"','Columna <b>A</b>: folio de la caja (o del traspaso suelto). Columna <b>K</b>: paquetería. Columna <b>M</b>: número de guía.')+
 paso(4,'Automático','Al escribir la guía, los traspasos pasan solos a <span class="st" style="color:#0B6C80;background:#DAF2F7">● Enviado por paquetería</span>. También se revisa cada 10 minutos. Para forzarlo: <b>Revisar Operaciones ahora</b>.')+
 fig('l01_paqueteria','Paquetería de Logística: cajas, listos para Morelia y en camino.')+
 nota('info','Morelia recibe la caja completa','Morelia escanea la etiqueta de la caja una sola vez y se reciben todos los traspasos que trae.')),
('Recepción Oficinas','el stand del patio',
 '<p>Recepción Oficinas es un <b>punto de pausa</b>: los traspasos esperan ahí mientras los recoge su área o un gestor. No es un destino final y no se puede elegir como destino al crear un traspaso.</p>'+
 nota('warn','Computadora fija','La computadora del patio está fija en Recepción Oficinas (dice 🔒 equipo fijo) y no tiene botón para salir. Si se traba, avisa a Logística: el administrador la saca abriendo la página con /SALIR al final de la dirección.')+
 '<h3>Dejar traspasos</h3>'+
 paso(1,'📥 Dejar → escanea tu credencial','Cualquier persona registrada: gestor o empleado.')+
 fig('r01_dejar','Dejar: primero se identifica quien deja.')+
 paso(2,'Escanea cada traspaso y confirma','Quedan <span class="st" style="color:#8A4B12;background:#F6E7D8">● En Recepción Oficinas</span> y al área destino le llega un aviso.')+
 fig('r02_dejar_lista','Traspasos listos para dejar en el stand.')+
 '<h3>Recoger traspasos (salida con gestor)</h3>'+
 paso(1,'📤 Recoger → escanea tu credencial','La pantalla muestra lo que puedes llevarte, agrupado por destino. El gestor ve <b>todo lo de Oficinas que va fuera</b>, aunque nadie lo haya registrado como dejado. Lo que lleva más de 36 h sale en rojo.')+
 paso(2,'Escanea o toca ＋ en cada traspaso, y confirma','')+
 tabla(['Quién recoge','Qué puede llevarse','Cómo queda'],[
  ['<b>Gestor</b>','Cualquier traspaso: lo lleva a su destino.','Recolectado por gestoría'],
  ['<b>Persona de Oficinas</b>','Solo lo de su área. Si no es suyo, el sistema no la deja.','Entregado']],['40mm','','45mm'])+
 fig('r03_recoger','Recoger: un gestor ve todo lo disponible.')+
 '<h3>En resguardo</h3><p>Dos listas por destino: <b>En el stand</b> (lo registrado ahí) y <b>Por salir de Oficinas</b> (lo creado que todavía no se registra). Lo que pasa de 36 horas sin salida sale en rojo y avisa a Logística, al área y a administración.</p>'+fig('r04_resguardo','En resguardo.')),
('Centro de Impresión','etiquetas de Oficinas, en Recepción',
 '<p>La computadora de Recepción es la única con la etiquetadora conectada por cable. Por eso tiene la pestaña dorada <b>🖨 Centro de Impresión</b>, donde se imprimen las etiquetas de los traspasos que las áreas de Oficinas crearon en su computadora.</p>'+
 paso(1,'Toca 🖨 Centro de Impresión','')+
 paso(2,'Elige el área de Oficinas','Entre paréntesis sale cuántos traspasos tiene por imprimir.')+
 paso(3,'Imprime','<b>🖨 Imprimir etiqueta</b> imprime las de ese folio, una por bulto. <b>Imprimir todas</b> imprime las de toda el área en un solo envío.')+
 fig('r05_impresion','Centro de Impresión con los traspasos de Contabilidad.')+
 nota('info','Qué aparece','Traspasos en <b>Nuevo traspaso</b> (creados, sin recoger) y los que ya se imprimieron aquí. En cuanto un gestor los recoge, salen de la lista. Al imprimir, lo que va fuera de Oficinas pasa a <b>En Recepción Oficinas</b> (el paquete está ahí). Lo ya impreso dice <i>"ya impreso aquí"</i> y el botón cambia a <b>Imprimir otra vez</b>.')),
('Estatus, reglas y problemas','',
 estatus()+
 sino(['Recoger en Recepción solo lo de tu área','Escanear todo lo que entra y sale del stand','Avisar si algo lleva días en resguardo','Usar la caja CJ para todo lo que va junto a Morelia'],
      ['Llevarte traspasos de otra área','Mover cosas del stand sin escanearlas','Elegir Recepción Oficinas como destino','Capturar envíos de Morelia fuera de la hoja Operaciones'])+
 tabla(['Problema','Solución'],[
  ['Un traspaso de Morelia no cambia a "Enviado por paquetería"','Revisa que el folio esté en la columna A de Operaciones y la guía en la M. Luego usa <b>Revisar Operaciones ahora</b>.'],
  ['"Solo lo puede recoger esa área o un gestor"','Ese traspaso no es de tu área. Que lo recoja su área o un gestor.'],
  ['"La credencial no está registrada"','Usa usuario y NIP, y pide a un administrador que la registre.'],
  ['La computadora del patio cambió de área','Avisa a Logística para volver a fijarla en Recepción Oficinas.']],['70mm',''])),
]

# ===================== ADMINISTRADORES =====================
adm=[
('Rol del administrador','dos modos de trabajo',
 '<p class="lead">Los administradores (<b>jaraujo</b>, <b>Oramirez</b> y <b>sistemasfed</b>) trabajan el día a día como usuarios de su área. Cuando hay que corregir algo, pasan al <b>Modo administrador</b>, que da control total.</p>'+
 paso(1,'Entrar al modo administrador','Botón dorado <span class="k" style="background:#E2AE3A;border-color:#E2AE3A">Modo administrador</span> arriba, o en la pantalla de entrada <b>Entrar como administrador</b>. Si en CFG_Ajustes hay <b>pin_administrador</b>, lo pide.')+
 paso(2,'Trabajar','Aparece la barra negra y dorada <b>MODO ADMINISTRADOR</b>.')+
 paso(3,'Regresar','Botón <b>← Volver a tu área</b>.')+
 fig('a00_entrada','Pantalla de entrada con el grupo Administración.')+
 nota('warn','Recepción Oficinas','En la computadora del patio no aparece el botón de administrador.')),
('Ver y buscar','todos los traspasos y su historia',
 '<h3>Todos los traspasos</h3><p>En movimiento y entregados de los últimos 45 días. Las fichas de estatus filtran la tabla; clic en una fila para abrirla.</p>'+fig('a01_todos','Todos los traspasos.')+
 '<h3>Buscador</h3><p>Escribe o escanea un folio y presiona Enter: abre su historia completa, aunque sea viejo. También busca por guía, persona, gestor o descripción.</p>'+
 '<h3>Pedidos de Botican</h3><p>En el Buscador escribe el pedido con <b>#</b> (ej. <b>#15996</b>) y Enter: sale su línea de tiempo con la etiqueta <b>BOTICAN</b> (quién lo recolectó, cuándo y con qué acuse).</p>'+fig('a05_botican','Historia de un pedido de Botican.','chico')),
('Corregir y eliminar','acciones de administrador',
 '<p>Dentro de un traspaso, en <b>Acciones de administrador</b>:</p>'+
 tabla(['Acción','Para qué'],[
  ['<b>Cambiar estatus</b>','Por ejemplo, marcar <i>Extraviado</i> o corregir un estatus.'],
  ['<b>Mover a otro destino</b>','Cuando se capturó con el destino equivocado.'],
  ['<b>Dónde está</b>','Si el estatus es "El traspaso está en…", indica el lugar.'],
  ['<b>Motivo</b>','Opcional. Queda en la línea de tiempo y en RES_Administracion.'],
  ['<b>Eliminar</b>','Pide confirmar. El traspaso queda como Eliminado y deja de verse en las bandejas.'],
  ['<b>Reimprimir</b>','Cualquier etiqueta, de cualquier área.']],['45mm',''])+
 fig('a02_detalle','Detalle con acciones de administrador.','chico')+
 '<h3>Solicitudes de eliminación</h3><p>Las áreas no borran: solicitan. En <b>Solicitudes</b> apruebas (se elimina) o rechazas (vuelve a moverse), con comentario opcional.</p>'+fig('a03_solicitudes','Solicitudes pendientes.')+
 nota('err','Nunca borres filas en Sheets','Elimina siempre desde la página. Borrar la fila no deja registro, deja huérfanos su historial y avisos, y si alguien confirma en ese momento el cambio puede caer en la fila equivocada.')),
('Catálogos y ajustes','lo que se edita en la hoja',
 '<p>Todo se configura en el archivo <b>Traspasos_FADERMEX_BD</b>. La página toma los cambios sola. Para dar de baja algo pon <b>Activo = NO</b>; no borres filas.</p>'+fig('a04_catalogos','Catálogos: acceso directo a la hoja.')+
 tabla(['Hoja','Qué se edita'],[
  ['<b>CAT_Areas</b>','Áreas y prefijo de folio, sucursal, <b>Correo de la cuenta</b> (quién puede entrar), Activa y <b>PIN de entrada</b>.'],
  ['<b>CAT_Personas</b>','Empleados: credencial, área, <b>Usuario</b> y <b>NIP</b> para quien no tiene credencial.'],
  ['<b>CAT_Gestores</b>','Gestores: credencial, usuario, NIP. Quien está en esta hoja cuenta como gestor.'],
  ['<b>CAT_Administradores</b>','Correos con permiso de administrador.'],
  ['<b>CAT_Impresoras</b>','Tamaño de etiqueta por área, por sucursal o TODAS; márgenes, orientación y formato.'],
  ['<b>CAT_EnviosOf</b>','Guía de qué se manda a cada área de Oficinas: <b>Documentos</b> | <b>Área</b>. El área se escribe igual que en CAT_Areas (ej. "Coordinación PV"). Sale como aviso al crear un traspaso hacia esa área. "Revisar configuración" avisa si un área no coincide.'],
  ['<b>CAT_Estatus</b>','Nombre en pantalla y colores de cada estatus.'],
  ['<b>CAT_Paqueterias / CAT_Motivos</b>','Listas de paqueterías y de motivos (reimpresión, eliminación, incidencia).'],
  ['<b>CFG_Ajustes</b>','Duración de sesión (0 = no se cierra), <b>pin_administrador</b>, logo, tamaño general de etiqueta, columnas de Operaciones (A, K, M), cada cuánto revisar avisos, <b>botican_archivo</b> (bitácora de Botican) y los <b>manuales</b> (ver abajo).']],['48mm',''])+
 '<h3>Manuales (botón ❓ Ayuda)</h3><p>Los PDF viven en una carpeta de Drive (<b>carpeta_manuales</b>) y sus links en CFG_Ajustes: <b>manual_sucursales</b>, <b>manual_oficinas_recepcion</b>, <b>manual_administradores</b> y <b>manual_proceso</b>. Cada área ve el suyo; los administradores ven todos y la carpeta.</p>'+
 nota('ok','Actualizar un manual sin cambiar el link','En Drive: clic derecho en el PDF → <b>Información del archivo → Administrar versiones → Subir versión nueva</b>. El link no cambia y todas las áreas ven la nueva versión al instante.')+
 nota('info','Hojas RES_','Son los registros que escribe la página (traspasos, movimientos, escaneos, etiquetas, avisos, solicitudes, cajas). Se consultan, no se editan.')),
('Seguridad y operación','accesos, Operaciones y actualizaciones',
 tabla(['Tema','Cómo funciona'],[
  ['<b>Acceso</b>','Cuenta de Google @fadermex.com. Cada área solo admite los correos de CAT_Areas. Las sesiones van firmadas y no se pueden falsificar.'],
  ['<b>PIN de entrada</b>','Opcional por área. Recomendado en computadoras compartidas (por ejemplo, LOG en el patio).'],
  ['<b>Credenciales</b>','El código nunca se ve en pantalla: solo el nombre. 5 NIP o PIN equivocados bloquean 15 minutos.'],
  ['<b>Centro de Impresión</b>','En Recepción: imprime las etiquetas de los traspasos de Oficinas. Lo que va fuera de Oficinas pasa a "En Recepción Oficinas". Cada impresión queda en RES_Etiquetas (Impresión = RECEPCIÓN) y en la historia.'],
  ['<b>Salida por Recepción</b>','Todo lo de Oficinas que va fuera sale por Recepción: el gestor le da salida en Recoger aunque nadie lo haya dejado. Si pasa de <b>horas_alerta_sin_salida</b> (36 h), avisa a Logística, al área y a administración.'],
  ['<b>Recepción en kiosco</b>','Ver <b>MODO_KIOSCO.md</b>: usuario de Windows aparte, Chrome bloqueado y pantalla completa. Para sacarla de Recepción: Alt + F4 y abrir la dirección de la página con <b>/SALIR</b> al final (…/exec/SALIR).'],
  ['<b>Botican</b>','La pestaña de Botican lee y escribe en <b>LOGISTICA BOTICAN 2026 → Envios</b>: escribe el gestor en "Recolección de Gestor" (no mover ni renombrar esa columna). El acuse queda en <b>RES_RecoleccionesBotican</b>.'],
  ['<b>Operaciones</b>','Al escribir en las columnas A (folio), K (paquetería) o M (guía), los traspasos de Morelia pasan a Enviado por paquetería. Además se revisa cada 10 minutos.'],
  ['<b>Actualizar la página</b>','Pegar el código nuevo → correr <b>Instalar / reparar</b> → Implementar → Administrar implementaciones → ✏️ → <b>Nueva versión</b>. La URL no cambia.']],['42mm',''])),
('Problemas comunes','',
 tabla(['Problema','Solución'],[
  ['Alguien no puede entrar a su área','Revisa que su correo esté en CAT_Areas → Correo de la cuenta y que el área esté Activa = SI.'],
  ['"La credencial no está registrada"','Agrégala en CAT_Personas o CAT_Gestores con Activo = SI.'],
  ['Un gestor sale como persona','Agrégalo también a CAT_Gestores: quien está ahí cuenta como gestor.'],
  ['Etiquetas cortadas, en blanco o con hojas de más','Revisa CAT_Impresoras para esa área y que el papel del driver de la impresora tenga el mismo tamaño.'],
  ['Morelia no cambia a paquetería','Folio en la columna A, guía en la M de Operaciones. Luego "Revisar Operaciones ahora" desde Logística.'],
  ['Un traspaso quedó en el estatus equivocado','Ábrelo en Modo administrador → Cambiar estatus, con motivo.']],['65mm',''])),
]

docs=[('Manual_Sucursales','Manual de Sucursales','PV, Rebotica, Botican y Morelia','Cómo crear, entregar y recibir traspasos en la página de Traspasos, paso a paso y con las pantallas reales.',suc),
      ('Manual_Oficinas_y_Recepcion','Manual de Oficinas y Recepción','Áreas de Oficinas, Logística y Recepción Oficinas','Cómo trabajan las áreas de Oficinas sin credencial, cómo opera Logística con Morelia y cómo se usa el stand de Recepción Oficinas.',ofi),
      ('Manual_Administradores','Manual de Administradores','jaraujo · Oramirez · sistemasfed','Modo administrador, corrección y eliminación de traspasos, catálogos en Sheets, seguridad y operación del sistema.',adm)]
for f,t,p,r,s in docs:
    open(os.path.join(D,f+'.html'),'w').write(doc(t,p,r,s))
print('ok')
