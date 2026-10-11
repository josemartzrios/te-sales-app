# Vendedor único, pantalla Vender centrada en la hielera y litro a $35

Fecha: 2026-10-11

## Intención

Fran trabaja solo desde hoy. No hay socio, ni reparto 50/50, ni segundo vendedor. Todo lo que
queda después de gastos y apartado es de Fran. Además se vende un producto nuevo: la botella de
**un litro a $35**, con su propio inventario y su línea en el corte.

Criterios de éxito:
- La pantalla **Vender** pregunta primero "¿cuántas botellas te quedan?"; lugar y hora van
  debajo; **Cargar hielera** y **Mayoreo** siguen disponibles; **Pasar botellas** desaparece.
- El corte suma los litros × $35 al ingreso y toda la utilidad (menos apartado) va al sobre de Fran.
- El historial con Primo y los cortes ya cerrados se leen igual que antes. Nada del pasado se recalcula.

## Fuera de alcance

- Mayoreo de litros (por ahora el mayoreo es solo botella normal).
- Migrar o reescribir eventos y cortes existentes.
- Multiusuario o sincronización entre dispositivos.

## Principios de diseño

- **Responsabilidad única:** cada módulo cambia por una sola razón. `corte.ts` calcula dinero del
  día, `caja.ts` mueve sobres, `dominio.ts` cuenta inventario, `ui.ts` solo pinta.
- **Abierto/cerrado:** el producto se modela como dato (`Producto`), no como ramas `if (litro)`
  repartidas. Sumar un tercer producto es agregar una entrada en una tabla, no tocar los cálculos.
- **Sustitución y segregación:** las funciones de dominio reciben el producto como parámetro con
  valor por defecto `'botella'`, así el código existente y sus pruebas siguen siendo válidos.
- **Inversión de dependencias:** `ui.ts` no calcula; recibe datos ya resueltos por `main.ts` y
  dominio. Las reglas de negocio no importan nada de la UI.
- **Datos viejos primero:** todo campo nuevo es opcional y se lee con un valor por defecto.

## 1. Modelo (`tipos.ts`)

- `Producto = 'botella' | 'litro'`.
- `SaleEvent` y `LoadEvent` ganan `product?: Producto`. Ausente significa `'botella'`.
- `Vendedor` conserva `'Fran' | 'Primo'` para leer el historial.
- `TransferEvent` se conserva solo como tipo para leer historial; ya no se crean nuevos.
- `Settings.defaultVendor` deja de usarse en la UI; los eventos nuevos se escriben con `'Fran'`.

## 2. Dominio (`dominio.ts`)

- `VENDEDORES_ACTIVOS = ['Fran']` reemplaza el uso de `VENDEDORES` en pantalla y registro.
  `VENDEDORES` queda para leer historial (stats, hielera de días pasados).
- Una sola tabla `PRODUCTOS` describe cada producto: nombre, precio de calle por defecto, si admite
  mayoreo. Los cálculos de hielera, cuadre y piezas vendidas reciben el `Producto` y filtran por él.
- `hieleraDe(eventos, vendedor, fecha, producto = 'botella')`: el cuadre de litros es independiente
  del de botellas.
- Se elimina el flujo de **traspaso** (crear). Los traspasos históricos se siguen leyendo en el
  cuadre de días pasados para que esos días no cambien.

## 3. Corte (`corte.ts`)

- `Precios` gana `litro` (default `3500` centavos). `validarPrecios` lo lee con ese default, así los
  cortes cerrados sin precio de litro se leen con 0 litros y su total no cambia.
- `Ingreso` gana una línea `litro: IngresoCanal` calculada igual que calle (piezas × precio). El
  total suma las tres líneas.
- `calcularReparto`: `fran = repartible`, `primo = 0`. Desaparece el centavo impar. Los cortes
  cerrados se leen tal cual con su `primo` guardado.
- `resumen` (texto para compartir): agrega "Litros: n × $35 = …", quita la línea "Primo" cuando es
  0 y rotula "Tu utilidad".

## 4. Caja (`caja.ts`)

- `planCaja`: todo `repartible` va a `fran`; `primo = 0` y no se genera movimiento para `primo`.
- `movimientosDeCierre` solo emite el movimiento del sobre `fran`.
- El sobre `primo` ("Sueldo de Primo") sigue existiendo y se muestra únicamente si tiene saldo
  distinto de cero, para que pueda cobrar lo pendiente. Los movimientos históricos no cambian.

## 5. Pantalla Vender (`ui.ts`, `main.ts`, `estilos.css`)

Orden, de más a menos frecuente:
1. **Conteo principal**: campo grande "¿Cuántas te quedan?" (teclado numérico, `inputmode`),
   con "traes N" como pista. Debajo, fila más chica "Litros: ¿cuántos te quedan?" con su propia pista.
   Campo vacío = "no lo conté" (se conserva esa regla). `0` tecleado = vendí todo.
2. **Lugar y hora** debajo; la hora arranca en punto como hoy.
3. **Registrar**: botón ancho, deshabilitado hasta que haya al menos un conteo.
4. **Acciones secundarias** en una fila: **Cargar hielera** (con selector de producto) y
   **Mayoreo** (solo botellas). Menor peso visual que Registrar.
5. Resumen del día y aviso "cuentas más de las que traes" se mantienen.

Se quitan: selector de vendedor, botón y modal de **Pasar botellas**, y el texto fijo "Primo".
`ui.ts` se divide en funciones pequeñas por bloque (conteo, lugar/hora, acciones) para no seguir
creciendo un archivo de 2300 líneas; los bloques nuevos viven en un módulo propio
(`vender.ts`) en vez de seguir engordando `ui.ts`.

## 6. Otras pantallas

- **Hoy / Stats**: se quita el filtro por vendedor para el rango nuevo; los totales históricos
  siguen sumando a Primo. Las métricas por producto separan botellas y litros.
- **Corte**: las tarjetas de socios pasan a una sola tarjeta "Lo tuyo".
- **Ajustes**: se quita "vendedor por defecto".

## 7. Errores y datos viejos

- Evento sin `product` → botella. Corte sin `precios.litro` → 3500 pero con 0 litros vendidos.
- Conteo mayor a lo cargado: la captura se detiene y ofrece abrir **Cargar hielera** (ya existe),
  ahora por producto.
- Importar un respaldo viejo funciona sin cambios.

## 8. Pruebas (TDD)

Primero rojas, luego verdes:
- `dominio.test.ts`: cuadre de litros independiente del de botellas; eventos sin `product`.
- `corte.test.ts`: ingreso con litros; `calcularReparto` sin partir; lectura de cortes viejos.
- `caja.test.ts`: cierre con un solo sobre; sobre `primo` solo con saldo.
- Actualizar las pruebas que asumen mitad y mitad.
- UI: verificación manual con `run` (la UI no tiene pruebas automáticas).

## 9. Documentación

README: quitar secciones de reparto 50/50, traspasos y selector de vendedor; documentar el litro y
la nueva pantalla Vender.
