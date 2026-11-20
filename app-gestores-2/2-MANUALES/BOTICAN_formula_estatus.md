# LOGISTICA BOTICAN 2026 · Envios · fórmula del Estatus (celda A3)

## Nueva (20-nov-2026)
Agrega **🏪 GESTOR ENTREGÓ A SUCURSAL** (columna AF con fecha, la llena la app) y toma en cuenta la
columna AD (la app registró la recolección) para **🧍 RECOLECCIÓN DE GESTOR**.

```
=ARRAYFORMULA(
 IF(B3:B="","",
 IF(O3:O<>"","ENTREGADO",
 IF(T3:T<>"","❌ CANCELADO",
 IF(S3:S<>"","🔄 RETORNADO",
 IF(Q3:Q<>"","🏢 Disponible en sucursal",
 IF(R3:R<>"","⚠️ EXISTE UN PROBLEMA",
 IF(AF3:AF<>"","🏪 GESTOR ENTREGÓ A SUCURSAL",
 IF(K3:K="Paquetería Externa","🚚 En ruta por paquetería",
 IF(K3:K="Logística Interna","🛵 En ruta por logística",
 IF(K3:K="UBER"," 🚙 UBER",
 IF(K3:K="Otro medio","📦 En ruta por otro método",
 IF(AND(J3:J<>"",G3:G<>""),
    IF((J3:J-G3:G)*24>48,"⏰ PEDIDO CON ATRASO",
    IF(H3:H<>"","✅ RECIBIDO EN LOGÍSTICA",
    IF((AB3:AB<>"")+(AD3:AD<>""),"🧍 RECOLECCIÓN DE GESTOR",
    IF(AC3:AC<>"","🏬 BOTICAN ENTREGÓ A GESTORÍA",
    IF(G3:G<>"","📋 ELABORADO",
    "🔧 EN ELABORACIÓN"))))),
    IF(H3:H<>"","✅ RECIBIDO EN LOGÍSTICA",
    IF((AB3:AB<>"")+(AD3:AD<>""),"🧍 RECOLECCIÓN DE GESTOR",
    IF(AC3:AC<>"","🏬 BOTICAN ENTREGÓ A GESTORÍA",
    IF(G3:G<>"","📋 ELABORADO",
    "🧪 EN ELABORACIÓN"))))
 )))))))))))))
```

## Anterior (hasta el 20-nov-2026) — para regresarla si hace falta
```
=ARRAYFORMULA(
 IF(B3:B="","",
 IF(O3:O<>"","ENTREGADO",
 IF(T3:T<>"","❌ CANCELADO",
 IF(S3:S<>"","🔄 RETORNADO",
 IF(Q3:Q<>"","🏢 Disponible en sucursal",
 IF(R3:R<>"","⚠️ EXISTE UN PROBLEMA",
 IF(K3:K="Paquetería Externa","🚚 En ruta por paquetería",
 IF(K3:K="Logística Interna","🛵 En ruta por logística",
 IF(K3:K="UBER"," 🚙 UBER",
 IF(K3:K="Otro medio","📦 En ruta por otro método",
 IF(AND(J3:J<>"",G3:G<>""),
    IF((J3:J-G3:G)*24>48,"⏰ PEDIDO CON ATRASO",
    IF(H3:H<>"","✅ RECIBIDO EN LOGÍSTICA",
    IF(AB3:AB<>"","🧍 RECOLECCIÓN DE GESTOR",
    IF(AC3:AC<>"","🏬 BOTICAN ENTREGÓ A GESTORÍA",
    IF(G3:G<>"","📋 ELABORADO",
    "🔧 EN ELABORACIÓN"))))),
    IF(H3:H<>"","✅ RECIBIDO EN LOGÍSTICA",
    IF(AB3:AB<>"","🧍 RECOLECCIÓN DE GESTOR",
    IF(AC3:AC<>"","🏬 BOTICAN ENTREGÓ A GESTORÍA",
    IF(G3:G<>"","📋 ELABORADO",
    "🧪 EN ELABORACIÓN"))))
 ))))))))))))
```

## Columnas nuevas (al final, renglón 2) — las llena el robot de la App de Gestores
| Col | Título | Qué guarda |
|---|---|---|
| AD | App · Recolectó (fecha y hora) | Cuando el gestor escaneó el pedido |
| AE | App · Recolectó (gestor) | Quién lo recolectó |
| AF | App · Entregó en sucursal (fecha y hora) | Cuando lo dejó en la sucursal ("Lo dejé en sucursal") |
| AG | App · Sucursal (recibió) | Sucursal · quién lo recibió |
| AH | App · Gestor que entregó en sucursal | Gestor |
| AI | App · Foto entrega en sucursal | Enlace a la foto en Drive |
Nunca se pisa una celda que ya tenga algo. AF–AI solo para pedidos cuya Dirección (E) es "Sucursal …".
