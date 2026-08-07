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

### 2. Al llegar a un lugar: marcar dónde están

La pantalla pregunta **"¿Dónde están?"**: tocar el lugar. Eso abre el turno **de los dos**, porque salen
juntos al mismo punto. Un solo toque, no uno por vendedor.

Hay que hacerlo **antes de la primera venta del lugar**. Sin marcar lugar la app no muestra el botón de
vender, porque no sabría a dónde acreditar la pieza.

Arriba de todo se elige de quién es la venta (**Fran** o **Primo**). Ese selector decide a quién se
acredita cada toque — y también a quién le pega el `−1`.

### 3. Vender

Un toque en el botón grande **`+1 · Fran`** por cada botella. La app guarda sola la hora y el lugar.

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

Para comparar días o buscar la mejor hora de cada lugar, ir a **Stats** → la cuadrícula **Lugar × hora**.

### 8. Al cerrar: el corte de caja

En **Corte**, el ingreso del día ya viene sumado de las ventas (calle × $20, mayoreo × $14), desglosado por
canal para validarlo de un vistazo contra el efectivo real. Se capturan los gastos línea por línea
(concepto + monto) y abajo sale la utilidad y cuánto le toca a cada quien, mitad y mitad.

Abajo va el bloque **Caja**: cuánto hay en cada sobre (fondo, cambio, gasolina, gas, sueldo de Primo) y
cuánto se le debe a la caja si se tomó dinero prestado. Ahí mismo se registra con un toque: **Tomé
prestado**, **Devolví**, **Pagué** o **Aparté** — el signo lo pone el botón, no se teclea.

Después, **Al cerrar** dice lo único que hay que ejecutar: cuánto efectivo debería haber en el bulto,
cuánto se queda en la caja y cuánto se lleva Fran.

**Cerrar corte** lo guarda como registro inmutable, aparta lo del día y devuelve lo que se debe hasta donde
alcance. **Copiar resumen** manda el texto por WhatsApp o al portapapeles. Ver **El corte de caja** y
**La caja** más abajo para las reglas.

Luego, el respaldo entre los dos teléfonos: ver **Ritual diario** más abajo.

### Si te equivocas

- **Un toque de más:** el botón **`−1`** anula la última venta **del vendedor seleccionado** en ese lugar.
  No pregunta nada; si también le picas de más, un `+1` lo arregla. Ojo: se lleva **la venta completa**,
  así que un `−1` sobre un `+3` quita las tres piezas y hay que volver a capturarlas. Si el `−1` está
  apagado es que ese vendedor no tiene ventas de calle en este lugar hoy — revisa el selector de arriba.
- **Marcaste el lugar equivocado:** vas a **Hoy** → Movimientos, buscas la línea con la etiqueta `LUGAR` y
  tocas **Anular**. Luego marcas el correcto.
- **Cualquier otra cosa** (una carga mal puesta, una venta vieja): en **Hoy** → Movimientos, **Anular** en
  esa línea y registrar la correcta. Nada se borra: la anulación queda escrita y la línea aparece tachada.
- **Se te olvidó registrar algo:** **Hoy** → **Venta retroactiva** o **Carga retroactiva**, y ahí pones la
  fecha y la hora reales. Sale marcada con la etiqueta `RETRO`.

### Si no marcaste lugar y vendiste

No se pierde nada: esas piezas cuentan igual en la hielera, en el total del día y en Stats. Solo que la
vista Hoy avisa *"N piezas quedaron fuera de turno"*, porque no se les puede atribuir un rato concreto.

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
nadie lo pensara; ahora ya no hay segunda copia. Al cierre del día, **Ajustes → Exportar JSON** y guardar
el archivo fuera del teléfono (WhatsApp a uno mismo, correo, lo que sea).

Si algún día se vuelve a capturar en dos teléfonos, la consolidación sigue ahí y **no puede duplicar
nada** (el merge es idempotente por `id`):

1. En el teléfono **B**: Ajustes → **Exportar JSON**. Manda el archivo al teléfono **A**.
2. En el teléfono **A**: Ajustes → seleccionar el archivo en el input de importar. Aparece
   `Nuevos N · repetidos M · inválidos K`.
3. Opcional inverso: exportar desde **A** e importar en **B** para que ambos queden completos.

Importar el mismo archivo dos veces no hace daño: los eventos ya presentes se ignoran.

"Compartir resumen" manda el texto del día (por punto, canal, turno y vendedor) por WhatsApp o lo copia al
portapapeles.

## Las cinco pantallas

- **Vender** — el caso común. Arriba, una tarjeta por vendedor con lo que le queda en la hielera; la
  seleccionada es a quien se le acredita. Debajo, el lugar donde están parados (el turno) y un solo botón
  grande `+1 · Fran`: ya no hay que elegir punto al vender, porque el lugar ya está declarado. También
  se carga la hielera y se pasan botellas de una a otra desde aquí.
- **Hoy** — el tablero del día por vendedor: en hielera, vendió, ritmo por hora, mejor lugar y mejor hora,
  la lista de turnos con su franja y su ritmo, más las barras por lugar y por hora de esa persona. Abajo,
  el registro de movimientos (ventas, cargas, lugares y traspasos) con su botón de anular, y la captura
  retroactiva.
- **Corte** — el cierre del día en dinero: ingreso calculado de las ventas, gastos capturados a mano,
  utilidad y reparto 50/50. Cerrar el corte lo vuelve un registro inmutable.
- **Stats** — historia: rango (hoy / 7 días / todo), vendedor (ambos / Fran / Primo) y canal. Arriba de
  todo, la cuadrícula **lugar × hora**: dónde y a qué hora se vende.
- **Ajustes** — solo configuración: lugares, vendedor por defecto y respaldo.

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

El dinero de la caja vive en cinco **sobres**. No son bolsas físicas separadas —el efectivo es un solo
bulto— sino a quién le toca cada peso:

| Sobre | Qué es | Cómo crece | Cómo baja |
| --- | --- | --- | --- |
| Fondo | $200 rotatorio | fijo, no crece | solo si se toma prestado |
| Cambio | $120 rotatorio | fijo, no crece | solo si se toma prestado |
| Gasolina | provisión | $45 por día de venta | al cargar gasolina |
| Gas (Mamá Juani) | provisión | $40 por día de venta | al pagarle |
| Sueldo de Primo | pasivo | su mitad de cada corte cerrado | al pagarle el sábado |

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

Los cuatro van en pares exactos, así que una captura mala se deshace con su inverso y las dos líneas quedan a
la vista. Por eso no hay tipo "corrección": los movimientos son inmutables como las ventas.

### Qué pasa al cerrar el corte

Cerrar aparta lo del día automáticamente y devuelve lo que se debe **hasta donde alcance el efectivo**:

1. La mitad de Primo entra a su sobre (no cobra diario, cobra el sábado).
2. De lo que queda se apartan $45 de gasolina y $40 de gas. Si no alcanza, se aparta lo que haya.
3. Si sigue quedando efectivo y hay deuda, se abona al sobre que más deba.
4. Lo que sobra es de Fran. **Nunca sale negativo por llenar sobres**: llenarlos con dinero de su bolsa sería
   sacar de la caja para meter a la caja.

El corte cerrado guarda cómo quedó la caja en ese momento (`caja: { hay, deuda }`). Los cortes cerrados antes
de que existieran los sobres traen `caja: null` y se siguen leyendo con el fondo teórico que guardaron: **no
se recalcula el pasado**.

- La gasolina y el gas son **gasto el día que se pagan**, no el día que se apartan. Apartar solo mueve
  efectivo. Registrar la carga semanal como gasto *y* como apartado la contaría dos veces.
- El **apartado por día** ($45 / $40) se edita abajo en la pantalla Corte. Cambiarlo no mueve nada cerrado.
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
