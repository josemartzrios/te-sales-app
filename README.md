# Refreskté — registro de ventas

PWA offline-first para registrar ventas de té embotellado en la calle. Sin backend, sin cuentas, sin costo.
El caso común (una venta de calle) es **un toque**.

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

## Ritual diario (dos teléfonos)

Cada teléfono guarda sus propios eventos en `localStorage`. No hay sync automático: la consolidación es manual
y **no puede duplicar nada** (el merge es idempotente por `id`).

Al cierre del día:

1. En el teléfono **B**: Ajustes → **Exportar JSON**. Manda el archivo al teléfono **A** (WhatsApp, AirDrop, correo).
2. En el teléfono **A**: Ajustes → seleccionar el archivo en el input de importar. Aparece
   `Nuevos N · repetidos M · inválidos K`.
3. Opcional inverso: exportar desde **A** e importar en **B** para que ambos queden completos.
4. Teléfono A queda como el histórico bueno. Exporta y guarda ese JSON como respaldo.

Importar el mismo archivo dos veces no hace daño: los eventos ya presentes se ignoran.

"Compartir resumen" manda el texto del día (por punto, canal y vendedor) por WhatsApp o lo copia al portapapeles.

## Las cuatro pantallas

- **Vender** — el caso común. Arriba, una tarjeta por vendedor con lo que le queda en la hielera; la
  seleccionada es a quien se le acredita, y el botón grande lo dice (`+1 · Fran`) para que nadie registre
  a nombre equivocado. Abajo, un bloque por lugar. También se carga la hielera desde aquí.
- **Hoy** — el tablero del día por vendedor: en hielera, vendió, ritmo por hora, mejor lugar y mejor hora,
  más las barras por lugar y por hora de esa persona. Abajo, el registro de movimientos (ventas y cargas)
  con su botón de anular, y la captura retroactiva.
- **Stats** — historia: rango (hoy / 7 días / todo), vendedor (ambos / Fran / Primo) y canal.
- **Ajustes** — solo configuración: lugares, vendedor por defecto y respaldo.

## La hielera

Cada mañana se registra cuántas piezas salen en la hielera de cada vendedor (evento `load`). Las recargas
del día **suman**. Lo que se muestra es `cargado hoy − vendido hoy`, y descuenta calle *y* mayoreo: ambas
sacan botellas físicas de la misma hielera.

- **No arrastra saldo entre días.** Cada jornada empieza con lo que se cargue ese día. Lo que sobra se
  regresa; si mañana sale de nuevo, se vuelve a cargar.
- Sin carga registrada la app muestra `—`, no `0`: un cero inventado se lee como "no le queda nada".
- Si vende más de lo cargado, la vista Hoy lo dice en rojo — falta registrar una carga, no es un error del
  conteo de ventas.
- El **ritmo por hora** es piezas ÷ el tramo entre la primera y la última venta, con piso de una hora para
  que tres ventas en diez minutos no se reporten como "18 por hora". Junto al número siempre va el tramo
  (`4/h · en 5h`) para que se pueda juzgar.

## Reglas del modelo de datos

- **El histórico es inmutable.** Nada se edita ni se borra. Un error se corrige con un evento `void` que
  referencia la venta o la carga; ambas quedan registradas y la vista Hoy la muestra tachada.
- Una venta o una carga se anula **una sola vez**. Para corregir una carga mal capturada se anula y se
  registra la correcta.
- El botón **-1** de la pantalla Vender no borra: anula la última venta activa de calle de ese punto y,
  si esa venta traía más de una pieza (un +3), la vuelve a registrar con una menos **conservando su hora
  original**, para no mover la venta de franja horaria en las stats. Se deshabilita cuando el punto va en
  cero y no pide confirmación: es la corrección de un toque de más, y si también se toca por error basta
  con un +1.
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
src/almacenamiento.ts único módulo que toca localStorage
src/ui.ts             render del DOM (solo textContent, nunca innerHTML)
src/main.ts           estado y cableado
src/dominio.test.ts   tests de dominio y merge
```

## Alcance de v1

No calcula dinero, no hace corte de caja, no lleva saldos de clientes, no tiene sync en tiempo real ni
cuentas de usuario. Mayoreo registra solo cantidad; el precio se resuelve fuera. El inventario llega hasta
la hielera del día: no hay almacén, ni costo, ni merma.
