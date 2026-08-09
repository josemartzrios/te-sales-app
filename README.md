# Refreskté — registro de ventas

PWA offline-first para registrar ventas de té embotellado en la calle. Sin backend, sin cuentas, sin costo.
El caso común (una venta de calle) es **un toque**.

## Cómo se usa, día a día

Funciona sin internet: se puede registrar todo con el teléfono en modo avión y los datos quedan guardados
en ese teléfono. No hay que iniciar sesión ni esperar a que cargue nada.

### 0. Una sola vez: instalarla

Abrir la URL en el teléfono → menú del navegador → **"Agregar a pantalla de inicio"**. Queda como una app
normal, a pantalla completa y sin barra del navegador. Cada teléfono lleva sus propios datos.

### 1. Al salir: cargar la hielera

En **Vender**, abajo, tocar **Cargar hielera**. Poner las piezas que se llevan (los botones `18` y `19` son
atajos, o se escribe la cantidad) y **Cargar**.

Hazlo cada mañana. La app no arrastra saldo de ayer: cada día empieza en cero y lo que sobró se vuelve a
cargar si vuelve a salir. Si a lo largo del día se recarga, se registra otra vez y **se suma**.

### 2. El lugar

El lugar (el **turno**) dice a dónde se acredita cada pieza. Con el registro por rato se elige ahí mismo y
no hay que declararlo aparte: registrar abre el turno **de los dos** a la hora que le pongas, porque salen
juntos al mismo punto.

Si vas a **contar en vivo** con el `+1`, sí hay que marcar el lugar antes de la primera venta: sin turno la
app no muestra el botón, porque no sabría a dónde acreditar la pieza. Y arriba se elige de quién es la venta
(**Fran** o **Primo**) — ese selector decide a quién se acredita cada toque y a quién le pega el `−1`.

### 3. Vender

Arriba de **Vender** está el registro por rato, que es como se trabaja: **lugar**, **hora de llegada** y
**cuántas botellas quedan en cada hielera**. No se teclea lo vendido: se cuenta lo que sobra, que es más
fácil de hacer en la calle. Un solo *Registrar* y queda.

```
¿Dónde y a qué hora?
Lugar    [ Plazuela   v ]
Llegamos [ 17:00        ]

Cuenta lo que queda en la hielera
Fran · trae 20  [ 8 ]   Primo · trae 15  [ 5 ]

[        Registrar        ]
```

La app hace la resta: Fran traía 20 y quedan 8, **se fueron 12**. Eso escribe el turno de los dos a esa hora
y una venta por vendedor con lo suyo. Es la operación inversa de la hielera — si el restante sale de restarle
lo vendido a lo cargado, lo vendido sale de restarle lo contado al restante.

**Se cuenta al cerrar el rato, pero la hora que se teclea es la de llegada.** Así las piezas caen en el lugar
y en la franja en que de verdad se fueron, que es como se lee la cuadrícula de lugar × hora. La hora arranca
en la de ahora en punto y se teclea encima si se llegó antes.

**El campo vacío no es cero: es "a este no lo conté"**, y a ese vendedor no se le registra nada. Un `0`
tecleado sí cuenta, y significa que vendió la hielera entera. Por eso el campo vacío muestra un guion.

**Las piezas se capturan por vendedor, no juntas.** La hielera, el cuadre del día y las stats por persona
viven de saber quién vendió qué; partir un total a la mitad inventaría un dato que nadie contó y haría que el
cuadre marcara rojo sin que hubiera error.

**Registrar dos horas del mismo lugar no parte el turno en dos**: es un solo rato ahí, y las piezas caen en
su franja. Cambiar de lugar sí abre turno nuevo.

#### Si cuentas más botellas de las que deberías traer

Físicamente eso no sale de la nada: es una carga que no se registró. La captura **se detiene** y lo dice —
*"Fran cuenta 12 y debería traer 8: sobran 4"* — con un botón para abrir **Cargar hielera** ahí mismo.
Registras las que faltan y vuelves a contar. No se escribe nada a medias: los dos números se tecleron juntos
y se vuelven a teclear juntos.

#### Lo que esto implica y con el `+1` no pasaba

**Todo lo que salió de la hielera cuenta como venta.** Una botella rota, regalada o que se llevó alguien baja
el conteo igual que una vendida, así que se va a cobrar en el ingreso esperado del Corte y ahí va a aparecer
como **faltante de efectivo**. Es el precio de no ir tocando `+1` por botella; si empieza a pasar seguido,
el arreglo es un campo de "no cobradas" junto al conteo.

### Contar en vivo

Más abajo sigue el botón grande **`+1 · Fran`**, un toque por botella, para el rato que se quiera contar en
vivo. La app guarda sola la hora y el lugar.

- **`+2`** y **`+3`** para cuando se llevan varias de un jalón.
- La tarjeta de arriba va diciendo dónde estás, desde qué hora, cuánto llevas ahí y cuántas piezas van.
- El número de **Hielera** en la barra superior parpadea en cada venta: es la confirmación de reojo, sin
  tener que leer.

### 4. Al cambiar de lugar

Tocar **Cambiar** en la tarjeta y elegir el lugar nuevo. Ya está: el turno anterior se cierra solo a esa
hora, no hay botón de "terminar". Igual que al marcar, mueve a los dos.

### 5. Cuando uno se queda sin botellas

Botón **Pasar botellas**, abajo. Se elige quién las pasa y cuántas. **Mitad y mitad** precarga las que
dejarían a los dos parejos, y el número se puede editar antes de confirmar: el que cuenta es quien las
trae en la mano, no la app.

Esto **no es una venta ni una carga**: las botellas solo cambian de hielera. El total que salió de casa
no se mueve, y el dinero del día tampoco. Sirve para que el que se queda sin nada siga vendiendo sin que
su hielera se vaya a números rojos y la del otro quede con piezas fantasma.

### 6. Mayoreo

Botón **Mayoreo**, abajo. Ahí sí se elige el punto a mano y se pone la cantidad. Registra solo piezas; el
precio ($14) lo aplica el **Corte** al cerrar el día. Salen de la misma hielera, así que también la descuentan.

### 7. Al cerrar: revisar

En **Hoy** se ve el día de cada vendedor: lo que le queda en la hielera, cuánto vendió, su ritmo por hora,
su mejor lugar y su mejor hora, y **la lista de turnos** — cada lugar con su franja (`17:03–18:10`), sus
piezas y su ritmo. Es la lectura de "¿qué tal estuvo la Plazuela hoy de 5 a 6?".

Abajo, el **Cuadre del día** verifica que `cargadas + recibidas = vendidas + pasadas + restantes`, y dice
cuántas piezas salieron de casa — el número que se cuenta contra lo que se llevó. Si marca `!` en rojo,
alguien vendió más piezas de las que tuvo en las manos: falta registrar una carga, o el traspaso quedó
mal contado.

Para comparar días o buscar la mejor hora de cada lugar, **`⋯` → Stats** → la cuadrícula **Lugar × hora**.

### 8. Al cerrar: el corte de caja

En **Corte**, el ingreso del día ya viene sumado de las ventas (calle × $20, mayoreo × $14), desglosado por
canal para validarlo de un vistazo contra el efectivo real. Se capturan los gastos línea por línea
(concepto + monto) y abajo, en un solo bloque, baja el desglose completo: ingreso, gastos del día, gasolina
y gas, y lo que queda para repartir mitad y mitad.

Después, **Al cerrar** dice lo único que hay que ejecutar: cuánto efectivo debería haber en el bulto,
para compararlo contra el bulto. Ese número sale de cómo está la caja, y **Ver la caja** lleva directo a la
pestaña donde se arregla.

La caja tiene **pestaña propia**, porque responde otra pregunta que el corte. Ahí se ve cuánto hay en cada
sobre (fondo, cambio, gasolina, gas, lo tuyo y el sueldo de Primo), cuánto se le debe si se tomó prestado, y se registra
un movimiento con tres campos —sobre, cantidad y concepto— y dos botones: **Entró** o **Salió**. El signo lo
pone el botón y no se teclea.

**Cerrar corte** lo guarda como registro inmutable, aparta lo del día y devuelve lo que se debe hasta donde
alcance. **Copiar resumen** manda el texto por WhatsApp o al portapapeles. Ver **El corte de caja** y
**La caja** más abajo para las reglas.

Luego, el respaldo entre los dos teléfonos: ver **Ritual diario** más abajo.

### Si te equivocas

- **Un toque de más:** el botón **`−1`** anula la última venta **del vendedor seleccionado** en ese lugar.
  No pregunta nada; si también le picas de más, un `+1` lo arregla. Ojo: se lleva **la venta completa**,
  así que un `−1` sobre un `+3` quita las tres piezas y hay que volver a capturarlas. Si el `−1` está
  apagado es que ese vendedor no tiene ventas de calle en este lugar hoy — revisa el selector de arriba.
- **Te moviste y se te olvidó marcar el lugar:** el caso clásico — estabas en Parque Sinaloa, te fuiste a la
  Plazuela, vendiste, y la pieza se acreditó al parque. Toca **Estábamos en otro lugar** (está en **Vender**,
  debajo de los botones, y también en **Hoy**). Eliges el lugar bueno y **desde qué hora**: esa hora es el
  corte, todo lo vendido de ahí en adelante se pasa. Dos atajos llenan la hora sola, y se llaman por lo que
  hacen: **Solo la última venta** (el toque suelto en el lugar de al lado) y **Todo el turno** (tocaste mal el
  lugar desde que llegaste). Lo de en medio —*me moví a las 17:20 y vendí tres*— se teclea a mano.
  Antes de confirmar te dice exactamente cuántas piezas va a mover. Marca el lugar para los dos y reacredita
  todas las ventas de esa ventana que se habían ido al lugar viejo.
- **Una sola venta en el lugar equivocado:** **Hoy** → Movimientos → **Mover** en esa línea. Se anula y se
  vuelve a escribir con **su misma hora** en el lugar correcto, marcada `MOVIDA` y con el lugar de origen a la
  vista. **No mueve un peso**: el corte suma piezas por canal y nunca mira el punto, así que se puede corregir
  aunque el corte de ese día ya esté cerrado.
- **Marcaste el lugar equivocado:** vas a **Hoy** → Movimientos, buscas la línea con la etiqueta `LUGAR` y
  tocas **Anular**. Luego marcas el correcto. (Si ya vendiste desde ahí, mejor usa *Estábamos en otro lugar*:
  anular el `LUGAR` deja las piezas donde están.)
- **Cualquier otra cosa** (una carga mal puesta, una venta vieja): en **Hoy** → Movimientos, **Anular** en
  esa línea y registrar la correcta. Nada se borra: la anulación queda escrita y la línea aparece tachada.
- **Se te olvidó registrar algo:** **Hoy** → **Venta retroactiva** o **Carga retroactiva**, y ahí pones la
  fecha y la hora reales. Sale marcada con la etiqueta `RETRO`.

### Si no marcaste lugar y vendiste

No se pierde nada: esas piezas cuentan igual en la hielera, en el total del día y en Stats. Solo que la
vista Hoy avisa *"N piezas quedaron fuera de turno"*, porque no se les puede atribuir un rato concreto.

**Estábamos en otro lugar** también arregla esto: marca el lugar a la hora que le digas y las piezas entran
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

**El registro es de un solo teléfono.** Como salen juntos al mismo punto, todo se captura ahí: los dos
vendedores, los dos turnos y los traspasos entre sus hieleras.

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

- **Vender** — el caso común. Arriba, el registro por rato: lugar, hora de llegada y lo que queda en cada
  hielera, en un solo *Registrar*. Debajo, el conteo en vivo: la tarjeta del turno y el botón grande
  `+1 · Fran` para las veces que se quiera contar botella por botella. También se carga la hielera y se
  pasan botellas de una a otra desde aquí.
- **Hoy** — el tablero del día por vendedor: en hielera, vendió, ritmo por hora, mejor lugar y mejor hora,
  la lista de turnos con su franja y su ritmo, más las barras por lugar y por hora de esa persona. Abajo,
  el registro de movimientos (ventas, cargas, lugares y traspasos) con su botón de anular, y la captura
  retroactiva.
- **Corte** — el cierre del día en dinero: ingreso calculado de las ventas, gastos capturados a mano,
  utilidad y reparto 50/50. Cerrar el corte lo vuelve un registro inmutable.
- **Caja** — dónde está el dinero: los seis sobres, lo que se le debe a la caja, la captura de movimientos
  (sobre + cantidad + concepto, Entró o Salió) y el historial. Abajo, el **arqueo** (contar el bulto contra
  el libro), el **cierre semanal** del domingo y el apartado por día de venta.
- **Stats** (en el `⋯`) — historia: rango (hoy / 7 días / todo), vendedor (ambos / Fran / Primo) y canal.
  Arriba de todo, la cuadrícula **lugar × hora**: dónde y a qué hora se vende.
- **Ajustes** (en el `⋯`) — solo configuración: lugares, vendedor por defecto y respaldo.

### Claro y oscuro

La app sigue el tema del teléfono, sin interruptor propio. Se vende de tarde y de noche con el aparato en
la mano: a las nueve, un fondo blanco puro deslumbra y tapa justo lo que se acaba de registrar. Todo el
color pasa por variables CSS en `:root` y el bloque oscuro solo las reescribe, así que ninguna regla de
estilo sabe en qué tema está.

El `theme_color` del manifest se queda en blanco: es el color del *splash* al abrir y el manifest no
admite variantes por tema.

## Los turnos

Se vende como una hora aproximada por lugar, así que la app trabaja con esa unidad. Antes de vender,
el vendedor marca dónde está: eso registra un evento `shift`, que **no cuenta ninguna pieza**, solo dice
"a las 17:03 Fran se paró en la Plazuela". Desde ahí, cada `+1` se acredita a ese lugar con su hora real.

- **Marcar lugar abre el turno de los dos.** Salen juntos al mismo punto y el registro es de un solo
  teléfono, así que pedir el lugar una vez por vendedor solo serviría para que se olvide el segundo y
  las ventas de ese quedaran fuera de turno. Al que ya estaba en ese punto no se le escribe nada.
- **El turno se cierra solo.** No hay botón de "terminar": el turno acaba cuando ese mismo vendedor marca
  el siguiente lugar. Cambiar de lugar es un toque, y ahí queda partido el día.
- El turno abierto de hoy corre **hasta ahora**. El de un día pasado se cierra en su última venta: medirlo
  contra el reloj de hoy inventaría horas que nadie estuvo parado ahí.
- Una venta le toca a un turno si coinciden **vendedor, lugar y ventana horaria**. No se guarda el turno
  dentro de la venta, así que las retroactivas y lo capturado antes de esta versión también entran solas.
- El modelo guarda **un turno por vendedor**, aunque hoy la pantalla los mueva juntos: si algún día se
  separan, el histórico ya lo soporta sin migrar nada y sin que un turno pise al otro.
- Si se vendió sin marcar lugar, esas piezas siguen contando en todos lados, y la vista Hoy avisa cuántas
  **quedaron fuera de turno**. No se pierde nada; solo no se le puede atribuir un rato concreto.
- Un lugar mal marcado se corrige anulándolo, como todo lo demás. Volver a marcar el lugar en el que ya
  se está no registra nada: partiría en dos un rato que fue uno solo.

## La hielera

Cada mañana se registra cuántas piezas salen en la hielera de cada vendedor (evento `load`). Las recargas
del día **suman**. Lo que se muestra es `cargado + recibido − pasado − vendido`, y descuenta calle *y*
mayoreo: ambas sacan botellas físicas de la misma hielera.

- **No arrastra saldo entre días.** Cada jornada empieza con lo que se cargue ese día. Lo que sobra se
  regresa; si mañana sale de nuevo, se vuelve a cargar.
- Sin carga ni traspaso recibido la app muestra `—`, no `0`: un cero inventado se lee como "no le queda
  nada". Recibir botellas del otro sí cuenta — quien las recibió tiene botellas, aunque no haya cargado.
- Si vende más de las que tuvo en las manos, la vista Hoy lo dice en rojo. No es un error del conteo de
  ventas: falta registrar una carga, o (si hubo traspaso ese día) las piezas que se pasaron quedaron mal
  contadas.

### Los traspasos

Cuando uno se acaba su carga y el otro le pasa de las suyas para terminar juntos, eso se registra como un
evento `transfer`: **la venta es de quien la hace, pero la botella es de quien la cargó**.

- **No modifica las cargas.** Sumar la pieza a una carga y restarla de la otra dejaría los dos números
  cuadrados, pero borraría para siempre de quién era la botella que vendió el otro — y ese es justo el
  dato que hace falta el día que el reparto deje de ser mitad y mitad.
- **No mueve el total del día.** Los traspasos se cancelan entre las dos hieleras, así que `cargadas`
  sigue siendo lo que de verdad salió de casa y se puede contar contra lo que se llevó.
- **No toca el dinero.** El corte lee ventas, no hieleras: el ingreso es el mismo se hayan pasado
  botellas o no.
- Va en los dos sentidos y puede haber varios el mismo día.
- Se anula como todo lo demás, y las piezas regresan a la hielera de donde salieron.
- El **ritmo por hora** es piezas ÷ el tramo entre la primera y la última venta, con piso de una hora para
  que tres ventas en diez minutos no se reporten como "18 por hora". Junto al número siempre va el tramo
  (`4/h · en 5h`) para que se pueda juzgar.

## El corte de caja

```
Ingreso   = piezas de calle × $20.00 + piezas de mayoreo × $14.00
Utilidad  = ingreso − gastos
Fran = Primo = utilidad ÷ 2
```

- **El corte solo LEE las ventas.** No modifica, no migra y no normaliza el histórico. Escribe únicamente
  en sus propias claves (`refreskte:cortes:v1`, `refreskte:cortes-borrador:v1`, `refreskte:corte-precios:v1`).
- **Nada de la caja entra en la utilidad.** Los $200 de fondo y los $120 de cambio son rotatorios, no
  costos: el cambio sale en morralla y regresa dentro del efectivo de las ventas, así que restarlo sería
  contarlo dos veces. Y reponer lo prestado tampoco es un costo — ver **La caja** más abajo.
- **Todo el dinero se maneja en centavos enteros**, nunca en floats. El centavo impar del 50/50 se lo queda
  Fran, que trae la caja: le toca de más en un día bueno y absorbe de más en uno malo.
- **Un día en pérdida se reparte igual** (−50/−50). No se bloquea ni se redondea a cero: la ganancia está
  en el stock de té por vender.
- El **precio** se puede cambiar abajo en la pantalla Corte. Cada corte cerrado guarda el precio con el que
  se calculó, así que subirlo mañana no mueve ningún corte pasado.

### Los cortes cerrados son inmutables

- **No hay edición ni borrado.** Un corte que salió mal se compensa en un corte futuro, nunca se reescribe
  el pasado. El arreglo `ajustes` ya viaja en cada corte guardado —vacío en v1— para que las líneas de
  adeudo y compensación de v2 entren sin migrar nada.
- **Un corte por fecha.** Si ya hay uno cerrado, la pantalla lo muestra en modo lectura y no deja crear otro.
- **Se guarda el snapshot, no una referencia.** El corte congela las piezas, los precios, los gastos y el
  reparto resultante. Si mañana se anula una venta de ayer, el corte de ayer no se mueve un centavo. Al
  leerlo tampoco se recalcula nada: recalcular es justo lo que un registro inmutable no debe permitir.
- El **borrador** del día en curso sí es editable, uno por fecha, y se descarta al cerrar.
- Toda lectura es defensiva: con el JSON corrupto la app arranca vacía, respalda el crudo y no borra nada.

### Fuera de alcance del corte

Cuentas por cobrar de mayoreo, cuadre físico de botellas, reportes y gráficas de cortes, edición de cortes
cerrados.

## La caja

El corte responde *cuánto ganamos*. La caja responde *dónde está el dinero y de quién es*. Son **dos libros
distintos a propósito**, y mezclarlos es el error que cuesta dinero de verdad.

El ritmo de la semana: **los gastos se cubren con el fondo**; si no alcanza, se toma prestado de lo apartado
para gasolina. Cada corte del día abona a esa deuda lo que alcance. **El domingo** se carga gasolina, se le
paga el gas a Mamá Juani y su sueldo a Primo, y el fondo vuelve a sus $200.

El dinero de la caja vive en seis **sobres**. No son bolsas físicas separadas —el efectivo es un solo
bulto— sino a quién le toca cada peso:

| Sobre | Qué es | Cómo crece | Cómo baja |
| --- | --- | --- | --- |
| Fondo | $200 rotatorio | fijo, no crece | solo si se toma prestado |
| Cambio | $120 rotatorio | fijo, no crece | solo si se toma prestado |
| Gasolina | provisión | $45 por día de venta | al cargar gasolina |
| Gas (Mamá Juani) | provisión | $40 por día de venta | al pagarle |
| Lo tuyo (Fran) | pasivo | su mitad de cada corte cerrado | al cobrarlo |
| Sueldo de Primo | pasivo | su mitad de cada corte cerrado | al pagarle el domingo |

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
       gasto "Insumos 245"  →  utilidad −245  (−122.50 cada quien)

Día 2: entran 600 y se devuelven los 245 a la caja
       utilidad +600  (+300 cada quien)

       Los dos días: 600 − 245 = 355  →  177.50 cada quien.  ✅
```

Restar también la reposición daría 55 por cabeza en vez de 177.50: el mismo gasto cobrado dos veces. Es el
mismo error del fondo y el cambio, escondido en otra línea. **Ningún movimiento de la caja toca la utilidad.**

### Los cuatro movimientos

El **signo** siempre dice lo mismo (`+` entra a la caja, `−` sale). El **tipo** dice si además cambia lo que
ese sobre *debería* tener:

| Movimiento | Efectivo | Debería haber | Ejemplo |
| --- | --- | --- | --- |
| Aparté | + | + | se guardan los $45 del día para gasolina |
| Pagué | − | − | se carga gasolina, se le paga a Primo |
| Tomé prestado | − | = | sale dinero del fondo para insumos → **deuda** |
| Devolví | + | = | se regresa con lo que se vendió → **deuda** |

**Lo que tecleas a mano siempre es uno de los dos últimos.** *Salió* deja deuda, *Entró* la salda — en
cualquier sobre, sin excepción. Los gastos se cubren con el fondo y, si no alcanza, se toma prestado de lo
apartado para gasolina; ese faltante tiene que aparecer como deuda o el domingo no alcanza para cargar.

**Apartar y pagar no se teclean: los escriben los cierres**, que son los que conocen la regla.

| Quién | Cuándo | Qué escribe |
| --- | --- | --- |
| Corte del día | al cerrar | aparta a gasolina, gas y sueldo de Primo |
| Cierre semanal | el domingo | paga esos tres y los deja en cero |

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

La única salida que sí se resta aparte es el **sueldo de Primo**: su mitad ya salió de la utilidad el día que
se ganó, así que pagársela mueve efectivo sin volver a costar. La gasolina y el gas no entran ahí porque el
día que se pagan también se capturan como gasto.

### Los gastos salen solos de la caja

Capturar un gasto en el corte **descuenta el efectivo de la caja automáticamente**, en el orden en que se
opera: primero el **fondo** y, si no alcanza, lo apartado para **gasolina**. No hay que anotarlo dos veces.

- **Borrar el gasto devuelve el efectivo.** Las dos libretas no se separan.
- **El cambio nunca paga gastos**: es para dar cambio, no para comprar.
- **Nunca saca de un sobre más de lo que tiene.** Si el fondo trae $46 y el gasto es $100, salen $46 del
  fondo y $54 de la gasolina. Si entre los dos no alcanza, **el resto no se registra en la caja**: ese dinero
  salió de la venta del día o de una bolsa, no de la caja, y anotarlo inventaría efectivo que nunca tuvo. El
  gasto sí cuenta completo en el corte, que es lo que decide la utilidad.
- Estos movimientos **nacen sellados**: se corrigen borrando o reescribiendo el gasto, que es de donde
  salieron. Dejarlos editables por su lado permitiría que el corte y la caja dijeran cosas distintas del
  mismo peso.

### El arqueo: contar el bulto contra el libro

En la pestaña Caja se captura **lo que contaste con la mano**. La app compara contra lo que la caja dice que
debería haber y te enseña la diferencia. **Nada se reescribe solo**: tú decides si lo cuadras.

Si lo cuadras, se escribe un movimiento normal. Un **faltante** queda como deuda a la caja —se comporta igual
que dinero que salió sin registrarse, y los cortes del día lo van reponiendo— y un **sobrante** como dinero
devuelto. No hizo falta inventar un tipo nuevo.

Ojo con el faltante: si aparece uno, lo más probable no es que se haya perdido dinero, sino que **falta
capturar un movimiento**. Revisa el historial antes de ajustar.

### El cierre semanal (domingo)

Un botón en la pestaña Caja. Paga **lo que hay** en gasolina, gas y sueldo de Primo, y los deja en cero para
que vuelvan a llenarse la semana que entra.

- **Se paga lo que hay, no el objetivo.** Si entre semana se tomaron $18 de la gasolina para unas botellas,
  el domingo solo alcanza para cargar lo que quedó. El objetivo baja con el pago y esos $18 siguen
  apareciendo como deuda hasta que se repongan. No se inventa dinero que no está en la caja.
- **El fondo y el cambio no se tocan aquí.** Su deuda se abona en cada corte del día, así que para el domingo
  suelen estar completos. Si algo falta, el cierre lo dice y se arrastra.
- **Cerrar dos veces el mismo domingo no paga doble**: los ids se derivan de la fecha, igual que en el corte.

### Qué pasa al cerrar el corte

**Se paga todo y se reparte lo que queda**, en ese orden, que es como se opera con la mano:

1. La utilidad ya trae restados los gastos del día (el corte la calculó).
2. De ahí se apartan $45 de gasolina y $40 de gas. Si no alcanza, se aparta lo que haya.
3. Lo que sobra se parte a la mitad, y cada mitad se va al sobre de su dueño.

**El apartado sale antes de repartir, así que lo pagan los dos.** Antes salía solo del lado de Fran —Primo
cobraba su mitad completa y Fran financiaba la gasolina— y eso no es mitad y mitad:

```
Un lote de 18 vendido a $20 = $360, con $154 de té pagados del fondo

              ANTES            AHORA
Utilidad     $206.00          $206.00
Gasolina           —          -$45.00   <- se aparta antes de repartir
Gas                —          -$40.00
Se reparte         —          $121.00
  Fran         $0.00           $60.50
  Primo      $103.00           $60.50
Deuda         $93.50            $0.00
```

**La deuda no se cobra al repartir.** Sacar $154 del fondo para comprar el té y capturar el gasto de $154 es
el mismo peso: el gasto ya bajó la utilidad de los dos, y el fondo se rellena solo con el efectivo que la
caja retiene. Restar además una línea de "reponer" cobraba el gasto una segunda vez, y completa, a Fran.

### Por qué Fran también tiene sobre

Un día malo el repartible es negativo y **bajan los dos sobres**. Nadie pone dinero de su bolsa: el faltante
queda registrado y se compensa solo el día que vuelve a haber utilidad.

Antes solo Primo tenía sobre. En un día malo a Primo le bajaba el acumulado y quedaba registrado; a Fran no
le quedaba nada registrado —se llevaba $0 y el faltante se evaporaba—, así que al día siguiente Primo
arrancaba desde su saldo real y Fran desde cero, y Fran terminaba absorbiendo la pérdida completa.

```
Lunes:  se compra té de $154 del fondo, no se vende
Martes: se venden $360, sin gastos nuevos

Repartido bien:       $60.50 cada uno
Sin sobre para Fran:  Primo $137.50, Fran $60.50
```

Cada quien cobra de su sobre cuando quiere, con el botón **Cobrar**. Cobrar es un pago, no un préstamo: ese
dinero ya era suyo y sacarlo no deja deuda.

Cerrar también **sella los movimientos que quedaban abiertos**: el corte guarda cómo quedó la caja, y un
movimiento que siguiera editable después desmentiría ese registro inmutable.

El corte cerrado guarda cómo quedó la caja en ese momento (`caja: { hay, deuda }`). Los cortes cerrados antes
de que existieran los sobres traen `caja: null` y se siguen leyendo con el fondo teórico que guardaron: **no
se recalcula el pasado**.

- La gasolina y el gas son **gasto el día que se pagan**, no el día que se apartan. Apartar solo mueve
  efectivo. Registrar la carga semanal como gasto *y* como apartado la contaría dos veces.
- El **apartado por día** ($45 / $40) se edita abajo en la pestaña Caja. Cambiarlo no mueve nada cerrado.
- La caja escribe solo en `refreskte:caja:v1` y `refreskte:caja-tasas:v1`. No toca ventas ni cortes.
- Los apartados del cierre llevan **id derivado de la fecha**, así que reintentar un cierre no puede apartar
  el doble.

## Reglas del modelo de datos

- **El histórico es inmutable.** Nada se edita ni se borra. Un error se corrige con un evento `void` que
  referencia la venta, la carga, el turno o el traspaso; todas quedan registradas y la vista Hoy las
  muestra tachadas. Por eso un `shift` solo guarda su inicio: su cierre se deduce del siguiente, nunca se
  escribe encima.
- Una venta, una carga, un turno o un traspaso se anulan **una sola vez**. Para corregir una carga mal
  capturada se anula y se registra la correcta.
- El botón **-1** de la pantalla Vender no borra ni resta: anula **entera** la última venta activa de calle
  **de ese vendedor** en ese punto. Si esa venta traía tres piezas (un `+3`), se van las tres y hay que
  volver a capturar — editarla para dejarla en dos sería escribir sobre el histórico. Se deshabilita
  cuando ese vendedor va en cero ahí y no pide confirmación: es la corrección de un toque de más, y si
  también se toca por error basta con un `+1`.
- **El `-1` filtra por vendedor a propósito.** Los dos venden desde el mismo teléfono y en el mismo lugar:
  sin ese filtro, corregir un toque de más de uno le quitaría una pieza al otro, y no lo avisaría nadie
  — el total del día y el dinero salen idénticos, solo cambia a quién se le acreditó.
- **Corregir el lugar tampoco edita.** Mover una venta de punto es un `void` sobre la vieja más una venta
  nueva con la **misma hora, cantidad, canal y vendedor**, y un campo `movedFrom` con el lugar del que vino
  — sin él la línea nueva sería indistinguible de una venta cualquiera y el histórico no contaría el error.
- **Corregir el lugar nunca mueve dinero.** El ingreso del corte sale de piezas × precio por canal y no
  mira el punto, así que la corrección es segura incluso sobre una fecha con el corte ya cerrado.
- **La corrección de turno marca el lugar a los dos y las ventas una por una.** El `shift` se escribe para
  ambos por la misma razón que al marcar lugar en vivo (salen juntos, un solo teléfono); las ventas se
  reacreditan por vendedor y solo las del punto que cada quien traía mal, dentro de la ventana que va de la
  hora indicada hasta el siguiente lugar que ese vendedor marcó — más allá el registro ya decía la verdad.
- Quitar un punto en Ajustes solo lo saca de la lista activa: sus ventas históricas siguen contando en Stats.
- El arreglo de eventos es *append-only*; ninguna función lo muta ni lo reordena en sitio.

## Estructura

```
index.html            shell (sin scripts inline, por CSP)
netlify.toml          headers + build
public/               manifest, service worker, iconos
scripts/              generador de iconos PNG (sin dependencias)
src/tipos.ts          tipos del dominio
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

Los traspasos son **solo inventario**: hoy no tocan el dinero, porque el reparto es mitad y mitad y el
ingreso es común, así que da igual de qué hielera salió cada botella. El evento guarda `from`, `to`, `qty`
y la hora justamente para que el día que el reparto deje de ser 50/50 el dato ya esté escrito hacia atrás
y no haya que reconstruirlo.
