# Refreskté — registro de ventas

PWA offline-first para registrar ventas de té embotellado en la calle. Sin backend, sin cuentas, sin costo.
El caso común es contar **cuántas botellas te quedan** y listo.

> **Un solo vendedor.** Vende Fran y todo el corte es suyo; ya no hay reparto mitad y mitad. Lo anterior
> con Primo se conserva: los cortes cerrados, sus ventas, cargas y traspasos se siguen leyendo igual, y su
> sobre ("Sueldo de Primo") aparece solo mientras tenga saldo pendiente, que se puede cobrar.

## Cómo se usa, día a día

Funciona sin internet: se puede registrar todo con el teléfono en modo avión y los datos quedan guardados
en ese teléfono. No hay que iniciar sesión ni esperar a que cargue nada.

### 0. Una sola vez: instalarla

Abrir la URL en el teléfono → menú del navegador → **"Agregar a pantalla de inicio"**. Queda como una app
normal, a pantalla completa y sin barra del navegador. Cada teléfono lleva sus propios datos.

### 1. Al salir: cargar la hielera

En **Vender**, abajo, tocar **Cargar hielera**. Elegir **Botellas** o **Litros**, poner las piezas que se
llevan (los botones `18` y `19` son atajos, o se escribe la cantidad) y **Cargar**.

Hazlo cada mañana. La app no arrastra saldo de ayer: cada día empieza en cero y lo que sobró se vuelve a
cargar si vuelve a salir. Si a lo largo del día se recarga, se registra otra vez y **se suma**. Cada
producto lleva su propia hielera.

### 2. El lugar

El lugar (el **turno**) dice a dónde se acredita cada pieza. Con el registro por rato se elige ahí mismo y
no hay que declararlo aparte: registrar abre el turno a la hora que le pongas.

### 3. Vender

Lo primero en **Vender** es el registro por rato, que es como se trabaja. No se teclea lo vendido: se
cuenta lo que sobra, que es más fácil de hacer en la calle. Un solo *Registrar* y queda.

```
¿Cuántas te quedan?
[ 8 ]                 traes 20

Lugar        [ Plazuela   v ]
Desde las    [ 17:00        ]

[        Registrar        ]
  Cargar hielera · Mayoreo
```

El campo grande es el de botellas y su pista dice cuántas **debería traer** (`traes 20`). Si hoy se
cargaron **litros**, aparece debajo una fila más chica para contarlos; si no se cargaron, no aparece.
Después va el lugar y la hora, y *Registrar*.

La app hace la resta: traías 20 y quedan 8, **se fueron 12**. Eso escribe el turno a esa hora y una venta
de calle con lo que se fue. Es la operación inversa de la hielera — si el restante sale de restarle lo
vendido a lo cargado, lo vendido sale de restarle lo contado al restante.

**Se cuenta al cerrar el rato, pero la hora que se teclea es la de llegada.** Así las piezas caen en el lugar
y en la franja en que de verdad se fueron, que es como se lee la cuadrícula de lugar × hora. La hora arranca
en la de ahora en punto y se teclea encima si se llegó antes.

**El campo vacío no es cero: es "no lo conté"**, y a ese producto no se le registra nada. Un `0` tecleado sí
cuenta, y significa que vendiste la hielera entera. Por eso el campo vacío muestra un guion y **Registrar
queda apagado** hasta que haya al menos un número.

**Registrar dos horas del mismo lugar no parte el turno en dos**: es un solo rato ahí, y las piezas caen en
su franja. Cambiar de lugar sí abre turno nuevo.

#### Si cuentas más botellas de las que deberías traer

Físicamente eso no sale de la nada: es una carga que no se registró. La captura **se detiene** y lo dice —
*"Botellas: cuentas 12 y deberías traer 8. Sobran 4."* — con un botón para abrir **Cargar hielera** ahí
mismo, ya en el producto que sobra. Registras las que faltan y vuelves a contar. No se escribe nada a
medias, **ni del otro producto**: los números se tecleron juntos y se vuelven a teclear juntos.

#### Lo que esto implica

**Todo lo que salió de la hielera cuenta como venta.** Una botella rota, regalada o que se llevó alguien baja
el conteo igual que una vendida, así que se va a cobrar en el ingreso esperado del Corte y ahí va a aparecer
como **faltante de efectivo**. Es el precio de contar lo que queda en vez de ir botella por botella; si empieza a pasar seguido,
el arreglo es un campo de "no cobradas" junto al conteo.

### 4. Al cambiar de lugar

Elige el lugar nuevo en el selector *Lugar* y registra el conteo de ahí. Ya está: el turno anterior se
cierra solo a esa hora, no hay botón de "terminar".

### 5. Mayoreo

Botón **Mayoreo**, abajo. Ahí sí se elige el punto a mano y se pone la cantidad. Registra solo piezas; el
precio ($14) lo aplica el **Corte** al cerrar el día. Sale de la misma hielera de botellas, así que también
la descuenta. El litro **no se vende a mayoreo**.

### 6. El litro

Es la botella de 1 litro, a **$35**, y solo se vende en la calle. Tiene su propia hielera: se carga con el
selector **Litros** de *Cargar hielera*, se cuenta en la fila de litros de *¿Cuántas te quedan?* y cuadra
aparte. En el Corte lleva su propia línea (`Litros: n × $35`). Una venta sin producto (todo lo anterior a
esto) cuenta como botella.

### 7. Al cerrar: revisar

En **Hoy** se ve el día: lo que te queda en la hielera, cuánto vendiste, tu ritmo por hora,
tu mejor lugar y tu mejor hora (los litros salen aparte, solo el día que se movieron), y **la lista de turnos** — cada lugar con su franja (`17:03–18:10`), sus
piezas y su ritmo. Es la lectura de "¿qué tal estuvo la Plazuela hoy de 5 a 6?".

Abajo, el **Cuadre del día** verifica que `cargadas + recibidas = vendidas + pasadas + restantes` (las
botellas y, si hubo, los litros por separado), y dice cuántas piezas salieron de casa — el número que se
cuenta contra lo que se llevó. Si marca `!` en rojo, vendiste más piezas de las que tenías: falta
registrar una carga. (En días viejos con traspasos entre hieleras también puede ser un traspaso mal contado.)

Para comparar días o buscar la mejor hora de cada lugar, **`⋯` → Stats** → la cuadrícula **Lugar × hora**.

### 8. Al cerrar: el corte de caja

En **Corte**, el ingreso del día ya viene sumado de las ventas (calle × $20, mayoreo × $14, litros × $35), desglosado por
canal para validarlo de un vistazo contra el efectivo real. Se capturan los gastos línea por línea
(concepto + de qué sobre salió + monto), abajo se teclea lo que **se aparta hoy** para la gasolina del
domingo —vacío el día que no se aparte nada— y al final, en un solo bloque, baja el desglose completo:
ingreso, gastos del día, lo apartado, y lo que queda: **tu utilidad** (los cortes viejos con Primo
conservan su título *Se reparte* y sus dos tarjetas).

Después, **Al cerrar** dice lo único que hay que ejecutar: cuánto efectivo debería haber en el bulto,
para compararlo contra el bulto. Ese número sale de cómo está la caja, y **Ver la caja** lleva directo a la
pestaña donde se arregla.

La caja tiene **pestaña propia**, porque responde otra pregunta que el corte. Ahí se ve cuánto hay en cada
sobre (fondo, cambio, gasolina, gas y lo tuyo; el sueldo de Primo solo si le queda saldo), cuánto se le debe si se tomó prestado, y se registra
un movimiento con tres campos —sobre, cantidad y concepto— y dos botones: **Entró** o **Salió**. El signo lo
pone el botón y no se teclea.

**Cerrar corte** lo guarda como registro inmutable, aparta lo del día y devuelve lo que se debe hasta donde
alcance. **Copiar resumen** manda el texto por WhatsApp o al portapapeles. Ver **El corte de caja** y
**La caja** más abajo para las reglas.

Luego, el respaldo entre los dos teléfonos: ver **Ritual diario** más abajo.

### Si te equivocas

- **Te moviste y se te olvidó marcar el lugar:** el caso clásico — estabas en Parque Sinaloa, te fuiste a la
  Plazuela, vendiste, y la pieza se acreditó al parque. Toca **Estabas en otro lugar** (está en **Hoy**). Eliges el lugar bueno y **desde qué hora**: esa hora es el
  corte, todo lo vendido de ahí en adelante se pasa. Dos atajos llenan la hora sola, y se llaman por lo que
  hacen: **Solo la última venta** (el toque suelto en el lugar de al lado) y **Todo el turno** (tocaste mal el
  lugar desde que llegaste). Lo de en medio —*me moví a las 17:20 y vendí tres*— se teclea a mano.
  Antes de confirmar te dice exactamente cuántas piezas va a mover. Marca el lugar y reacredita
  todas las ventas de esa ventana que se habían ido al lugar viejo.
- **Una sola venta en el lugar equivocado:** **Hoy** → Movimientos → **Mover** en esa línea. Se anula y se
  vuelve a escribir con **su misma hora** en el lugar correcto, marcada `MOVIDA` y con el lugar de origen a la
  vista. **No mueve un peso**: el corte suma piezas por canal y nunca mira el punto, así que se puede corregir
  aunque el corte de ese día ya esté cerrado.
- **Marcaste el lugar equivocado:** vas a **Hoy** → Movimientos, buscas la línea con la etiqueta `LUGAR` y
  tocas **Anular**. Luego marcas el correcto. (Si ya vendiste desde ahí, mejor usa *Estabas en otro lugar*:
  anular el `LUGAR` deja las piezas donde están.)
- **Cualquier otra cosa** (una carga mal puesta, una venta vieja): en **Hoy** → Movimientos, **Anular** en
  esa línea y registrar la correcta. Nada se borra: la anulación queda escrita y la línea aparece tachada.
- **Se te olvidó registrar algo:** **Hoy** → **Venta retroactiva** o **Carga retroactiva**, y ahí pones la
  fecha y la hora reales. Sale marcada con la etiqueta `RETRO`.

### Si no marcaste lugar y vendiste

No se pierde nada: esas piezas cuentan igual en la hielera, en el total del día y en Stats. Solo que la
vista Hoy avisa *"N piezas quedaron fuera de turno"*, porque no se les puede atribuir un rato concreto.

**Estabas en otro lugar** también arregla esto: marca el lugar a la hora que le digas y las piezas entran
al turno. Si mueves una venta suelta con **Mover** y no hay turno que la cubra en el lugar nuevo, el aviso
aparecerá — la venta está bien acreditada, lo que falta es el turno.

## Correr local

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # lógica de dominio
npm run build    # tsc --noEmit + bundle estático en dist/
```

`npm run iconos` regenera `public/icono-*.png` (solo si cambias el color o el glifo).

## Deploy a Netlify

El repo ya trae `netlify.toml` con build, headers de seguridad y fallback SPA.

- **Desde Git (recomendado):** conecta el repo en Netlify. Toma build y publish del `netlify.toml`.
- **Manual:** desde la raíz del repo, `npm run build && npx netlify deploy --prod --dir=dist`.

Evita arrastrar `dist/` a Netlify Drop: ese camino no lee el `netlify.toml` y el sitio quedaría sin CSP
ni los demás headers.

Requiere HTTPS para que el service worker se registre — Netlify lo da por defecto.
Para instalarla en el teléfono: abrir la URL → menú del navegador → "Agregar a pantalla de inicio".

## Ritual diario: exportar

**El registro es de un solo teléfono.** Todo se captura ahí: las ventas, las cargas y los turnos.

Eso quita el paso de consolidar cada noche, pero **hace el respaldo obligatorio**: ese teléfono es el
único lugar donde existe el día. Antes, el intercambio entre los dos teléfonos servía de copia sin que
nadie lo pensara; ahora ya no hay segunda copia. Al cierre del día, **`⋯` → Ajustes → Exportar JSON** y guardar
el archivo fuera del teléfono (WhatsApp a uno mismo, correo, lo que sea).

Si algún día se vuelve a capturar en dos teléfonos, la consolidación sigue ahí y **no puede duplicar
nada** (el merge es idempotente por `id`):

1. En el teléfono **B**: `⋯` → Ajustes → **Exportar JSON**. Manda el archivo al teléfono **A**.
2. En el teléfono **A**: `⋯` → Ajustes → seleccionar el archivo en el input de importar. Aparece
   `Nuevos N · repetidos M · inválidos K`.
3. Opcional inverso: exportar desde **A** e importar en **B** para que ambos queden completos.

Importar el mismo archivo dos veces no hace daño: los eventos ya presentes se ignoran.

"Compartir resumen" manda el texto del día (por punto, canal, turno y vendedor) por WhatsApp o lo copia al
portapapeles.

## Las pantallas

La barra de abajo lleva **las cuatro de todos los días**: Vender, Hoy, Corte y Caja. Stats y Ajustes se
consultan de vez en cuando, así que viven detrás del **`⋯`** de la esquina superior derecha, que está en
el mismo sitio en las cuatro. Desde ellas, **`‹ Volver`** regresa a la pantalla de la que se entró.

Son seis pantallas y una barra de teléfono: con las seis abajo, cada botón bajaba a ~80 px, la etiqueta
más larga apenas cabía, y *Ajustes* —que se toca una vez al mes— pesaba lo mismo que *Vender*. Lo de a
diario tiene que ser lo que se ve.

- **Vender** — el caso común. Arriba, *¿Cuántas te quedan?*, la fila de litros si se cargaron, el lugar y la
  hora de llegada, en un solo *Registrar*; abajo de él, *Cargar hielera* y *Mayoreo*. En la barra de arriba, **Hielera** y **Hoy** cuentan botellas; los litros salen aparte.
- **Hoy** — el tablero del día: en hielera, vendió, ritmo por hora, mejor lugar y mejor hora, la lista de
  turnos con su franja y su ritmo, más las barras por lugar y por hora. Abajo, el registro de movimientos
  (ventas, cargas y lugares; los traspasos viejos también aparecen) con su botón de anular, y la captura
  retroactiva.
- **Corte** — el cierre del día en dinero: ingreso calculado de las ventas, gastos capturados a mano, lo que
  se aparta ese día para la gasolina y lo que queda para ti. Los precios (calle, mayoreo y litro) se editan
  ahí mismo. Cerrar el corte lo vuelve un registro
  inmutable.
- **Caja** — dónde está el dinero: los sobres (el de Primo solo si trae saldo), lo que se le debe a la caja, la captura de movimientos
  (sobre + cantidad + concepto, Entró o Salió) y el historial. Abajo, el **arqueo** (contar el bulto contra
  el libro) y el **cierre semanal** del domingo.
- **Stats** (en el `⋯`) — historia: rango (hoy / 7 días / todo), producto (Todo / Botellas / Litros) y canal.
  Arriba de todo, la cuadrícula **lugar × hora**: dónde y a qué hora se vende. "Por vendedor" sale solo si
  en el rango vendió más de uno (días con Primo).
- **Ajustes** (en el `⋯`) — solo configuración: lugares y respaldo.

### Claro y oscuro

La app sigue el tema del teléfono, sin interruptor propio. Se vende de tarde y de noche con el aparato en
la mano: a las nueve, un fondo blanco puro deslumbra y tapa justo lo que se acaba de registrar. Todo el
color pasa por variables CSS en `:root` y el bloque oscuro solo las reescribe, así que ninguna regla de
estilo sabe en qué tema está.

El `theme_color` del manifest se queda en blanco: es el color del *splash* al abrir y el manifest no
admite variantes por tema.

## Los turnos

Se vende como una hora aproximada por lugar, así que la app trabaja con esa unidad. Al registrar un
conteo, el lugar y la hora quedan marcados: eso registra un evento `shift`, que **no cuenta ninguna pieza**, solo dice
"a las 17:03 Fran se paró en la Plazuela". Desde ahí, lo que se registra se acredita a ese lugar.

- **El turno se cierra solo.** No hay botón de "terminar": el turno acaba cuando se marca el siguiente
  lugar. Cambiar de lugar es un toque, y ahí queda partido el día.
- El turno abierto de hoy corre **hasta ahora**. El de un día pasado se cierra en su última venta: medirlo
  contra el reloj de hoy inventaría horas que nadie estuvo parado ahí.
- Una venta le toca a un turno si coinciden **vendedor, lugar y ventana horaria**. No se guarda el turno
  dentro de la venta, así que las retroactivas y lo capturado antes de esta versión también entran solas.
- El modelo guarda los turnos **por vendedor**: los de Primo en días viejos se siguen leyendo, sin migrar
  nada, y hoy solo se escriben los de Fran.
- Si se vendió sin marcar lugar, esas piezas siguen contando en todos lados, y la vista Hoy avisa cuántas
  **quedaron fuera de turno**. No se pierde nada; solo no se le puede atribuir un rato concreto.
- Un lugar mal marcado se corrige anulándolo, como todo lo demás. Volver a marcar el lugar en el que ya
  se está no registra nada: partiría en dos un rato que fue uno solo.

## La hielera

Cada mañana se registra cuántas piezas salen en la hielera (evento `load`), por producto: botellas y litros
llevan cuenta aparte. Las recargas
del día **suman**. Lo que se muestra es `cargado + recibido − pasado − vendido`, y descuenta calle *y*
mayoreo: ambas sacan botellas físicas de la misma hielera. El litro solo descuenta de la suya.

- **No arrastra saldo entre días.** Cada jornada empieza con lo que se cargue ese día. Lo que sobra se
  regresa; si mañana sale de nuevo, se vuelve a cargar.
- Sin carga (ni traspaso recibido, en días viejos) la app muestra `—`, no `0`: un cero inventado se lee como
  "no te queda nada".
- Si vendes más de las que tuviste en las manos, la vista Hoy lo dice en rojo. No es un error del conteo de
  ventas: falta registrar una carga.

### Los traspasos (solo historia)

Cuando había dos vendedores, uno podía pasarle botellas al otro, y eso se registraba como un evento
`transfer`. **Ya no se crean**: no hay segundo vendedor y el botón *Pasar botellas* se quitó. Los
traspasos de días anteriores se siguen leyendo igual (en Hoy, en el cuadre y en la hielera de esos días), se
anulan como todo lo demás y no tocaban ni el total del día ni el dinero.

- El **ritmo por hora** es piezas ÷ el tramo entre la primera y la última venta, con piso de una hora para
  que tres ventas en diez minutos no se reporten como "18 por hora". Junto al número siempre va el tramo
  (`4/h · en 5h`) para que se pueda juzgar.

## El corte de caja

```
Ingreso   = botellas de calle × $20.00 + botellas de mayoreo × $14.00 + litros × $35.00
Utilidad  = ingreso − gastos
Lo tuyo   = utilidad − lo apartado   (todo es de Fran)
```

- **El corte solo LEE las ventas.** No modifica, no migra y no normaliza el histórico. Escribe únicamente
  en sus propias claves (`refreskte:cortes:v1`, `refreskte:cortes-borrador:v1`, `refreskte:corte-precios:v1`).
- **Nada de la caja entra en la utilidad.** Los $200 de fondo y los $120 de cambio son rotatorios, no
  costos: el cambio sale en morralla y regresa dentro del efectivo de las ventas, así que restarlo sería
  contarlo dos veces. Y reponer lo prestado tampoco es un costo — ver **La caja** más abajo.
- **Todo el dinero se maneja en centavos enteros**, nunca en floats.
- **Un día en pérdida baja tu sobre** igual. No se bloquea ni se redondea a cero: la ganancia está en el
  stock de té por vender.
- Los **precios** (calle, mayoreo y litro) se pueden cambiar abajo en la pantalla Corte, uno junto al otro. Cada corte cerrado guarda el precio con el que
  se calculó, así que subirlo mañana no mueve ningún corte pasado. Los cortes cerrados antes del litro no traen su línea y
  se leen igual que siempre.

### Los cortes cerrados son inmutables

- **No hay edición ni borrado.** Un corte que salió mal se compensa en un corte futuro, nunca se reescribe
  el pasado. El arreglo `ajustes` ya viaja en cada corte guardado —vacío en v1— para que las líneas de
  adeudo y compensación de v2 entren sin migrar nada.
- **Un corte por fecha.** Si ya hay uno cerrado, la pantalla lo muestra en modo lectura y no deja crear otro.
- **Se guarda el snapshot, no una referencia.** El corte congela las piezas, los precios, los gastos y el
  reparto resultante. Si mañana se anula una venta de ayer, el corte de ayer no se mueve un centavo. Al
  leerlo tampoco se recalcula nada: recalcular es justo lo que un registro inmutable no debe permitir.
- El **borrador** del día en curso sí es editable, uno por fecha, y se descarta al cerrar. Guarda los gastos
  capturados y lo que se aparta ese día para la gasolina. Un borrador viejo sin ese campo se lee en cero.
- Toda lectura es defensiva: con el JSON corrupto la app arranca vacía, respalda el crudo y no borra nada.

### Fuera de alcance del corte

Cuentas por cobrar de mayoreo, cuadre físico de botellas, reportes y gráficas de cortes, edición de cortes
cerrados.

## La caja

El corte responde *cuánto ganamos*. La caja responde *dónde está el dinero y de quién es*. Son **dos libros
distintos a propósito**, y mezclarlos es el error que cuesta dinero de verdad.

El ritmo de la semana: **los insumos se cubren con el fondo**, y cada corte del día abona a esa deuda lo que
alcance. **A Mamá Juani se le paga cada dos lotes** con el efectivo de la venta de ese día —el mismo día si
salen dos, o al siguiente— así que eso es un gasto del corte y no toca la caja. **El domingo** se carga
gasolina con lo apartado y, si a Primo le queda saldo de antes, se le paga.

El dinero de la caja vive en **sobres** (cinco hoy; el de Primo se muestra solo mientras tenga saldo). No son bolsas físicas separadas —el efectivo es un solo
bulto— sino a quién le toca cada peso:

| Sobre | Qué es | Cómo crece | Cómo baja |
| --- | --- | --- | --- |
| Fondo | $200 rotatorio | fijo, no crece | solo si se toma prestado |
| Cambio | $120 rotatorio | fijo, no crece | solo si se toma prestado |
| Gasolina | provisión | lo que se teclee en el corte del día | al cargar gasolina el domingo |
| Gas (Mamá Juani) | histórico | ya no se llena: se le paga de la venta del día | al vaciarlo el domingo |
| Lo tuyo (Fran) | pasivo | todo lo que queda de cada corte cerrado | al cobrarlo |
| Sueldo de Primo | histórico | ya no se llena: solo trae el saldo de cortes viejos | al cobrarlo o pagarle el domingo |

```
efectivo que debe haber en la caja = Σ sobres − deuda
deuda a la caja                    = Σ préstamos − Σ reposiciones
```

### Reponer la caja NO baja la utilidad

Esta es la regla que hay que tener clara. Si tomo $245 de la caja y compro insumos, **los insumos ya bajaron
la utilidad el día que los compré**. Devolver ese efectivo a la caja mañana no vuelve a costar nada: es el
mismo dinero regresando a su lugar.

```
Día 1: se sacan 245 de la caja, se compran insumos por 245
       gasto "Insumos 245"  →  utilidad −245

Día 2: entran 600 y se devuelven los 245 a la caja
       utilidad +600

       Los dos días: 600 − 245 = 355  →  355 para Fran.  ✅
```

Restar también la reposición daría 110 en vez de 355: el mismo gasto cobrado dos veces. Es el
mismo error del fondo y el cambio, escondido en otra línea. **Ningún movimiento de la caja toca la utilidad.**

### Los cuatro movimientos

El **signo** siempre dice lo mismo (`+` entra a la caja, `−` sale). El **tipo** dice si además cambia lo que
ese sobre *debería* tener:

| Movimiento | Efectivo | Debería haber | Ejemplo |
| --- | --- | --- | --- |
| Aparté | + | + | se guarda para gasolina lo que se apartó ese día |
| Pagué | − | − | se carga gasolina el domingo, se le paga a Primo su saldo viejo |
| Tomé prestado | − | = | sale dinero del fondo para insumos → **deuda** |
| Devolví | + | = | se regresa con lo que se vendió → **deuda** |

**Lo que tecleas en la pantalla Caja siempre es uno de los dos últimos.** *Salió* deja deuda, *Entró* la
salda — en cualquier sobre, sin excepción.

**Apartar y pagar no se teclean ahí: los escriben los cierres y los gastos del corte**, que son los que
conocen la regla. Cuánto se aparta sí se teclea, pero en el corte del día: es una cifra del día, no un
movimiento de caja suelto.

| Quién | Cuándo | Qué escribe |
| --- | --- | --- |
| Gasto del corte | al capturarlo | saca como préstamo del sobre que elegiste, o nada si no salió de la caja |
| Corte del día | al cerrar | aparta a gasolina lo capturado ese día, y el resto va a tu sobre |
| Cierre semanal | el domingo | paga gasolina, gas y el saldo de Primo (si hay), y los deja en cero |

Por eso la captura son dos botones y no cuatro: *"saqué 18 de la gasolina para las botellas"* y *"cargué
gasolina el domingo"* son dinero saliendo del mismo sobre, y por el signo son idénticos. Lo que los separa es
quién los escribe, no qué botón se apretó.

### Corregir un movimiento

Un movimiento capturado a mano nace **abierto**: se puede editar y borrar, igual que un gasto del borrador.
**Cerrar el corte lo sella**, y a partir de ahí ya solo se corrige con su inverso, como las ventas. Los
movimientos que genera el propio cierre nacen sellados.

Lo guardado antes de que existiera esta marca cuenta como sellado: instalar esta versión no vuelve editable
un histórico que ya está dentro de cortes cerrados.

### El efectivo esperado

La línea *Efectivo esperado* del corte es **lo que traía la caja al EMPEZAR el día, más la utilidad**. El
saldo al abrir, no el de ahora, y la diferencia importa:

```
Fondo 200 + cambio 120. Se sacan 200 del fondo para unas botellas PET de 218,
los otros 18 salen del bulto, y se venden 600.

En la mano quedan   320 − 200 + 600 − 18 = 702
Al abrir + utilidad 320 + (600 − 218)    = 702  ✅
Ahora   + utilidad  120 + (600 − 218)    = 502  ❌ los 200 restados dos veces
```

Los $200 prestados ya van dentro del gasto de $218; restarlos también del saldo los cobraría dos veces contra
el bulto. Se asume que **todo préstamo termina en un gasto del negocio**, que es como se opera.

La única salida que sí se resta aparte es el **sueldo de Primo** (solo existe si le quedó saldo de cuando
eran dos): ese saldo ya salió de la utilidad el día que se ganó, cuando había dos socios, así que pagarlo mueve efectivo sin volver
a costar. La gasolina y el gas no entran ahí: cuando se
pagan desde el corte llevan detrás su línea de gasto, que ya bajó la utilidad.

### De qué sobre sale el efectivo de un gasto

Al capturar un gasto en el corte se elige en **Sale de** de dónde salió el efectivo, y la caja se descuenta
sola. No hay que anotarlo dos veces.

| Sale de | Qué significa |
| --- | --- |
| **Fondo** (por defecto) | los insumos. Hay que reponerlo → **deja deuda** |
| **Gasolina** | se echó mano de lo apartado para comprar. Hay que reponerlo → **deja deuda** |
| **No salió de la caja** | se pagó con el efectivo de la venta: **la caja no se mueve**. Aquí va Mamá Juani |

Antes no se preguntaba: **todo gasto vaciaba el fondo** y solo caía a la gasolina cuando el fondo ya no daba.
Pagarle a Mamá Juani con el efectivo de la venta dejaba al fondo debiendo $40 que nunca salieron de ahí. El
fondo es para insumos.

- **Sacar de un sobre siempre deja deuda**, sea el fondo o la gasolina: el gasto ya bajó la utilidad de los
  dos y la caja se rellena sola con el efectivo que retiene al cerrar. Pagar la gasolina del domingo no es
  esto: eso lo hace el cierre semanal, y por eso no se captura como gasto.
- **Borrar el gasto devuelve el efectivo** a su sobre. Las dos libretas no se separan.
- **El cambio no se ofrece**: es para dar cambio, no para comprar. **El gas tampoco**: a Mamá Juani se le
  paga de la venta del día.
- **Nunca saca de un sobre más de lo que tiene**, y no se derrama a otro. Si el fondo trae $46 y el gasto es
  $100, salen $46 y **el resto no se registra en la caja**: ese dinero salió de la venta del día o de una
  bolsa, y anotarlo inventaría efectivo que la caja nunca tuvo. El gasto sí cuenta completo en el corte, que
  es lo que decide la utilidad.
- Estos movimientos **nacen sellados**: se corrigen borrando o reescribiendo el gasto, que es de donde
  salieron. Dejarlos editables por su lado permitiría que el corte y la caja dijeran cosas distintas del
  mismo peso.

> **Lo apartado no se captura además como gasto.** Lo que apartas ya bajó el repartible el día que lo
> apartaste; capturar el pago como gasto lo bajaría otra vez. Por eso la gasolina se paga por el **cierre del
> domingo** y no se teclea como gasto, y por eso el gas de Mamá Juani —que sí es gasto el día que se le
> paga— **no se aparta**.

### El arqueo: contar el bulto contra el libro

En la pestaña Caja se captura **lo que contaste con la mano**. La app compara contra lo que la caja dice que
debería haber y te enseña la diferencia. **Nada se reescribe solo**: tú decides si lo cuadras.

Si lo cuadras, se escribe un movimiento normal. Un **faltante** queda como deuda a la caja —se comporta igual
que dinero que salió sin registrarse, y los cortes del día lo van reponiendo— y un **sobrante** como dinero
devuelto. No hizo falta inventar un tipo nuevo.

Ojo con el faltante: si aparece uno, lo más probable no es que se haya perdido dinero, sino que **falta
capturar un movimiento**. Revisa el historial antes de ajustar.

### El cierre semanal (domingo)

Un botón en la pestaña Caja. Paga **lo que hay** en gasolina, gas y sueldo de Primo (si trae saldo), y los deja en cero para
que vuelvan a llenarse la semana que entra.

- **Se paga lo que hay, no el objetivo.** Si entre semana se tomaron $18 de la gasolina para unas botellas,
  el domingo solo alcanza para cargar lo que quedó. El objetivo baja con el pago y esos $18 siguen
  apareciendo como deuda hasta que se repongan. No se inventa dinero que no está en la caja.
- **El fondo y el cambio no se tocan aquí.** Su deuda se abona en cada corte del día, así que para el domingo
  suelen estar completos. Si algo falta, el cierre lo dice y se arrastra.
- **Cerrar dos veces el mismo domingo no paga doble**: los ids se derivan de la fecha, igual que en el corte.

### Qué pasa al cerrar el corte

**Se paga todo y se reparte lo que queda**, en ese orden, que es como se opera con la mano:

1. La utilidad ya trae restados los gastos del día (el corte la calculó, y ahí va el gas de Mamá Juani los
   días que se le paga).
2. De ahí se aparta la gasolina **que se capturó en el corte de ese día**. Nada por defecto: sin captura no
   se aparta nada, y lo tecleado no se recorta aunque pase de la utilidad.
3. Lo que sobra va **completo al sobre de Fran** ("Lo tuyo").

Antes ese monto salía de una tarifa fija ($45 de gasolina y $40 de gas cada día que hubiera ventas), y eso
apartaba los días que no se cargó gasolina y apartaba de menos los días que se cargó más. Lo que se aparta es
lo que se deja en la caja con la mano, así que se teclea. Y el gas salió del apartado por completo: **a Mamá
Juani se le paga cada dos lotes** con el efectivo de ese día, así que es un gasto del corte y nada más.

```
Un lote de 18 vendido a $20 = $360, con $154 de té pagados del fondo
y ese día se apartaron $85 para la gasolina

Utilidad     $206.00
Se apartó    -$85.00   <- capturado, se aparta antes de lo tuyo
Tu utilidad  $121.00
```

Los cortes cerrados cuando Primo era socio **no se recalculan**: se siguen mostrando con sus dos tarjetas y
su reparto mitad y mitad tal como se guardaron.

**La deuda no se cobra al repartir.** Sacar $154 del fondo para comprar el té y capturar el gasto de $154 es
el mismo peso: el gasto ya bajó la utilidad, y el fondo se rellena solo con el efectivo que la caja retiene.
Restar además una línea de "reponer" cobraba el gasto una segunda vez.

### El sobre "Lo tuyo"

Un día malo el repartible es negativo y **baja tu sobre**. Nadie pone dinero de su bolsa: el faltante
queda registrado y se compensa solo el día que vuelve a haber utilidad.

```
Lunes:  se compra té de $154 del fondo, no se vende
Martes: se venden $360, sin gastos nuevos

Tu sobre: -154 + 360 = $206
```

Cobras de tu sobre cuando quieres, con el botón **Cobrar** (igual el saldo viejo de Primo, si hay). Cobrar es un pago, no un préstamo: ese
dinero ya era tuyo y sacarlo no deja deuda.

Cerrar también **sella los movimientos que quedaban abiertos**: el corte guarda cómo quedó la caja, y un
movimiento que siguiera editable después desmentiría ese registro inmutable.

El corte cerrado guarda cómo quedó la caja en ese momento (`caja: { hay, deuda }`). Los cortes cerrados antes
de que existieran los sobres traen `caja: null` y se siguen leyendo con el fondo teórico que guardaron: **no
se recalcula el pasado**.

- **El gas de Mamá Juani es gasto el día que se le paga** (cada dos lotes), y no se aparta. **La gasolina se
  aparta** y se paga sola en el cierre del domingo, así que esa nunca se captura como gasto. Poner cualquiera
  de las dos en los dos lados la contaría dos veces.
- Lo apartado se teclea **en el corte de cada día** y se guarda en su borrador, junto con los gastos. Vacío
  cuenta como cero: hoy no se apartó nada. Se guarda con su botón, como los precios.
- La caja escribe solo en `refreskte:caja:v1`. No toca ventas ni cortes. (`refreskte:caja-tasas:v1`, donde
  vivía la tarifa fija, quedó huérfana: ya nadie la lee ni la escribe.)
- Los apartados del cierre llevan **id derivado de la fecha**, así que reintentar un cierre no puede apartar
  el doble.

## Reglas del modelo de datos

- **El histórico es inmutable.** Nada se edita ni se borra. Un error se corrige con un evento `void` que
  referencia la venta, la carga, el turno o el traspaso; todas quedan registradas y la vista Hoy las
  muestra tachadas. Por eso un `shift` solo guarda su inicio: su cierre se deduce del siguiente, nunca se
  escribe encima.
- Una venta, una carga, un turno o un traspaso se anulan **una sola vez**. Para corregir una carga mal
  capturada se anula y se registra la correcta.
- **Corregir el lugar tampoco edita.** Mover una venta de punto es un `void` sobre la vieja más una venta
  nueva con la **misma hora, cantidad, canal y vendedor**, y un campo `movedFrom` con el lugar del que vino
  — sin él la línea nueva sería indistinguible de una venta cualquiera y el histórico no contaría el error.
- **Corregir el lugar nunca mueve dinero.** El ingreso del corte sale de piezas × precio por canal y no
  mira el punto, así que la corrección es segura incluso sobre una fecha con el corte ya cerrado.
- **La corrección de turno solo corrige a quien vende hoy (Fran).** Se escribe el `shift` y se reacreditan
  las ventas del punto que traías mal, dentro de la ventana que va de la hora indicada hasta el siguiente
  lugar que marcaste — más allá el registro ya decía la verdad. Las ventas y turnos de Primo en días
  viejos no se tocan.
- Quitar un punto en Ajustes solo lo saca de la lista activa: sus ventas históricas siguen contando en Stats.
- El arreglo de eventos es *append-only*; ninguna función lo muta ni lo reordena en sitio.

## Estructura

```
index.html            shell (sin scripts inline, por CSP)
netlify.toml          headers + build
public/               manifest, service worker, iconos
scripts/              generador de iconos PNG (sin dependencias)
src/tipos.ts          tipos del dominio
src/vender.ts          el bloque de conteo de Vender ("¿cuántas te quedan?")
src/dominio.ts        funciones puras: ventas activas, agregaciones, validación, merge
src/corte.ts          funciones puras del corte: aritmética en centavos, snapshot, validación
src/almacenamiento.ts único módulo que toca localStorage
src/ui.ts             render del DOM (solo textContent, nunca innerHTML)
src/main.ts           estado y cableado
src/dominio.test.ts   tests de dominio y merge
src/corte.test.ts     tests de la aritmética del dinero
```

## Alcance de v1

No lleva saldos de clientes, no tiene sync en tiempo real ni cuentas de usuario. El inventario llega hasta
la hielera del día: no hay almacén, ni costo, ni merma. El corte de caja calcula el dinero del día a partir
de las piezas registradas y un precio por canal; lo que queda fuera está listado en **Fuera de alcance del
corte**.

Hay un solo vendedor. El historial con Primo (ventas, cargas, turnos, traspasos y cortes cerrados) se
conserva y se lee igual; simplemente ya no se escribe nada nuevo a su nombre.

**Límites conocidos del litro.** El texto del día que manda *Compartir resumen* todavía cuenta los litros
dentro de "Calle" y no los separa de las botellas, y el ritmo por hora, las barras por lugar y por hora
suman botellas y litros juntos. El corte y la hielera sí los separan.
