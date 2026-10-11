# Vendedor único, pantalla Vender y litro a $35 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fran vende solo (sin reparto ni traspasos), la pantalla Vender gira alrededor de "¿cuántas te quedan?", y se vende el litro a $35 con inventario y línea de corte propios.

**Architecture:** Un campo opcional `product` en ventas y cargas (ausente = botella) y una tabla `PRODUCTOS` en dominio hacen el litro un dato, no una rama. El corte suma una línea `litro` al ingreso y reparte todo a Fran; la caja deja de emitir movimiento para `primo`. El bloque nuevo de Vender vive en `src/vender.ts`; `ui.ts` solo lo monta.

**Tech Stack:** TypeScript, Vite, Vitest (`npm test`, `npm run build`). UI sin framework (`el(...)` en `ui.ts`).

**Spec:** `docs/superpowers/specs/2026-10-11-vendedor-unico-y-litro-design.md`

## Global Constraints

- Litro: precio `3500` centavos; solo calle, **sin mayoreo de litros**.
- Evento sin `product` = `'botella'`. Corte cerrado sin `precios.litro` se lee con precio 3500 y 0 litros vendidos; su total no cambia.
- Cortes cerrados y eventos históricos (incluidos `Primo` y `transfer`) se leen igual que hoy; nada se migra ni se reescribe.
- `Vendedor` sigue siendo `'Fran' | 'Primo'` (historial). `VENDEDORES` se queda para validar/leer; la UI y los registros nuevos usan `VENDEDORES_ACTIVOS = ['Fran']`.
- `calcularReparto`: `fran = repartible`, `primo = 0`. Sin centavo impar.
- Se quita "Pasar botellas" (no se crean `transfer` nuevos); `Cargar hielera` y `Mayoreo` se conservan.
- Campo de conteo vacío = "no lo conté" (no es cero).
- Español sin acentos en comentarios/identificadores del código, como el resto del repo; textos de UI con acentos.
- Un commit por tarea. Los mensajes terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Litro y botella en el mismo día no se mezclan en cuadre, ingreso ni conteo (tests en Tasks 1, 2, 3).
- Respaldo viejo (sin `product`, con `Primo` y `transfer`) importa y cuadra igual (Task 1).
- Conteo de litros mayor a lo cargado detiene la captura, igual que botellas (Task 2).
- Día malo (repartible negativo) baja solo el sobre `fran` (Task 4).
- Sobre `primo` con saldo pendiente sigue visible y cobrable; en cero se oculta (Task 4).

## File Structure

- `src/tipos.ts` — `Producto`, `product?` en `SaleEvent`/`LoadEvent`.
- `src/dominio.ts` — `PRODUCTOS`, `VENDEDORES_ACTIVOS`, funciones con parámetro `producto = 'botella'`, validación.
- `src/corte.ts` — `Precios.litro`, `Ingreso.litro`, reparto sin partir, resumen.
- `src/caja.ts` — plan y cierre a un solo sobre; helper de visibilidad del sobre `primo`.
- `src/vender.ts` — **nuevo**: bloque de conteo principal, lugar/hora, acciones.
- `src/ui.ts`, `src/main.ts`, `src/estilos.css` — montar `vender.ts`, quitar vendedor/traspaso, ajustar corte/stats/ajustes.
- `README.md` — documentación.

---

### Task 1: Producto en el modelo y hielera por producto

**Files:**
- Modify: `src/tipos.ts`, `src/dominio.ts` (`crearVenta` :103, `crearCarga` :273, `hieleraDe` :715, `validarEvento` :1011)
- Test: `src/dominio.test.ts`

**Interfaces:**
- Produces:
  - `type Producto = 'botella' | 'litro'` (en `tipos.ts`)
  - `SaleEvent.product?: Producto`, `LoadEvent.product?: Producto`
  - `const PRODUCTOS: readonly Producto[] = ['botella', 'litro']`
  - `function productoDe(e: { product?: Producto }): Producto` → `e.product ?? 'botella'`
  - `crearVenta`/`crearCarga` aceptan `product?: Producto`; solo escriben el campo si es `'litro'`
  - `hieleraDe(eventos, vendedor, clave, producto: Producto = 'botella'): Hielera` — filtra cargas y ventas por `productoDe`; los traspasos solo aplican a `'botella'`
  - `const VENDEDORES_ACTIVOS: readonly Vendedor[] = ['Fran']`

- [ ] **Step 1: Write the failing tests** in `dominio.test.ts`:
  - `hieleraDe separa litros y botellas el mismo dia`: carga 20 botellas + 10 litros, vende 5 botellas y 3 litros → botella `restante 15`, litro `restante 7`.
  - `un evento sin product cuenta como botella`: carga y venta sin `product` → `hieleraDe(..., 'litro').cargado === 0`.
  - `crearVenta con product litro lo escribe; sin product no agrega el campo`.
  - `validarEvento conserva product litro y descarta valores invalidos` (`product: 'x'` → se lee como botella, no se pierde el evento).
  - `validarEvento sigue aceptando Primo y transfer` (respaldo viejo).
- [ ] **Step 2: Run** `npx vitest run src/dominio.test.ts` → Expected: FAIL (`product` no existe / `hieleraDe` ignora el producto).
- [ ] **Step 3: Implement** los tipos y funciones de Interfaces. `validarEvento` lee `product` solo si es `'litro'`; cualquier otro valor se omite. `hieleraDe` pasa `producto` a su filtro de cargas y ventas.
- [ ] **Step 4: Run** `npx vitest run src/dominio.test.ts` → Expected: PASS (incluidas las pruebas existentes).
- [ ] **Step 5: Commit** `feat: producto litro en el modelo y hielera por producto`.

---

### Task 2: Conteo y registro de hora con un vendedor y dos productos

**Files:**
- Modify: `src/dominio.ts` (`eventosDeHora` :143, `planConteo` :226, `totalPiezas` :612, `ventasDeFecha`)
- Test: `src/dominio.test.ts`

**Interfaces:**
- Consumes: Task 1 (`Producto`, `productoDe`, `hieleraDe` con producto, `VENDEDORES_ACTIVOS`).
- Produces:
  - `filtrarProducto(ventas: readonly SaleEvent[], producto: Producto): SaleEvent[]`
  - `planConteo(eventos, clave, contado: Readonly<Record<Vendedor, number | null>>, producto: Producto = 'botella'): PlanConteo` — itera `VENDEDORES_ACTIVOS`; `LineaConteo`/`PlanConteo.piezas` siguen indexados por `Vendedor` pero solo traen a Fran
  - `eventosDeHora(eventos, entrada: {ts; fecha; point; device; piezas: Readonly<Partial<Record<Producto, number>>>}): AppEvent[]` — escribe turno de Fran si no estaba en ese punto, y una venta `channel: 'calle', vendor: 'Fran'` por cada producto con `qty > 0` (`product` solo en litro)

- [ ] **Step 1: Write the failing tests:**
  - `planConteo de litros usa solo la hielera de litros`: 10 litros cargados, 3 botellas vendidas, cuento 6 litros → `piezas.Fran === 4`.
  - `planConteo marca sobrantes de litros` (cuento más litros de los cargados → `sobrantes.length === 1`).
  - `planConteo null no registra nada` (vacío ≠ 0) para ambos productos.
  - `eventosDeHora crea venta de botellas y de litros con la misma marca de tiempo y un solo turno`.
  - `eventosDeHora no repite turno si Fran ya esta en ese punto`.
  - `planConteo ya no incluye a Primo` aunque haya cargas viejas de Primo ese día.
- [ ] **Step 2: Run** `npx vitest run src/dominio.test.ts` → Expected: FAIL.
- [ ] **Step 3: Implement** según Interfaces. `totalPiezas` no cambia; los llamadores que mezclaban productos filtran con `filtrarProducto`.
- [ ] **Step 4: Run** `npx vitest run src/dominio.test.ts` → Expected: PASS. Si fallan pruebas viejas de `eventosDeHora`/`planConteo` que asumían dos vendedores, actualizarlas al comportamiento nuevo (decisión del spec).
- [ ] **Step 5: Commit** `feat: conteo y registro de hora para un vendedor y dos productos`.

---

### Task 3: Corte con línea de litros

**Files:**
- Modify: `src/corte.ts` (`Precios` :34, `Ingreso` :88, `PRECIOS_INICIALES` :156, `ingresoDeFecha` :204, `validarPrecios` :412, `validarCorte` :491, `resumenCorte` :541)
- Test: `src/corte.test.ts`

**Interfaces:**
- Consumes: Task 1/2 (`productoDe`, `filtrarProducto`).
- Produces:
  - `const PRECIO_LITRO = 3500`
  - `Precios.litro: number`; `PRECIOS_INICIALES = { calle, mayoreo, litro: PRECIO_LITRO }`
  - `Ingreso = { calle; mayoreo; litro: IngresoCanal; total }` — `calle`/`mayoreo` cuentan solo botellas; `total` suma las tres
  - `validarPrecios` rellena `litro` con `PRECIO_LITRO` si falta o es inválido
  - `validarCorte` lee `ingreso.litro` ausente como `{ piezas: 0, centavos: 0 }`

- [ ] **Step 1: Write the failing tests:**
  - `ingresoDeFecha suma litros x 3500 sin tocar calle`: 10 botellas calle + 4 litros → `litro.centavos === 14000`, `calle.piezas === 10`, `total === 10*2000 + 14000`.
  - `un litro anulado no entra`.
  - `validarPrecios sin litro usa 3500`.
  - `validarCorte de un corte viejo sin ingreso.litro conserva su total`.
  - `resumenCorte muestra la linea de litros solo si hay litros` ("Litros: 4 × $35.00 = $140.00").
- [ ] **Step 2: Run** `npx vitest run src/corte.test.ts` → Expected: FAIL.
- [ ] **Step 3: Implement** según Interfaces. `ingresoDeFecha` separa por `productoDe`; mayoreo de litros no existe, así que `litro` sale solo de ventas calle.
- [ ] **Step 4: Run** `npx vitest run src/corte.test.ts` → Expected: PASS.
- [ ] **Step 5: Commit** `feat: litro a 35 pesos en el ingreso del corte`.

---

### Task 4: Reparto y caja para un solo dueño

**Files:**
- Modify: `src/corte.ts` (`calcularReparto` :239, `resumenCorte`), `src/caja.ts` (`planCaja` :367, `movimientosDeCierre` :406, `SOBRES_SOCIOS` :48)
- Test: `src/corte.test.ts`, `src/caja.test.ts`

**Interfaces:**
- Produces:
  - `calcularReparto(...)` devuelve `fran = repartible`, `primo = 0`
  - `planCaja(...)`: `fran = repartible`, `primo = 0`, `seQuedaEnCaja = totalApartado`
  - `movimientosDeCierre` emite solo el apartado y el movimiento del sobre `fran` (concepto "Del {fecha}" en vez de "Mitad del")
  - `function sobresVisibles(estado: EstadoCaja): readonly Sobre[]` — todos los de `SOBRES` salvo `primo` cuando su saldo es 0

- [ ] **Step 1: Write the failing tests:**
  - `calcularReparto da todo a fran` (utilidad 36000, apartado 8500 → `fran 27500`, `primo 0`).
  - `dia malo: repartible negativo baja solo el sobre fran`.
  - `movimientosDeCierre no emite movimiento primo`.
  - `sobresVisibles oculta primo en cero y lo muestra con saldo pendiente`.
  - `resumenCorte de un corte cerrado con primo viejo sigue mostrando la linea Primo`; uno nuevo no.
- [ ] **Step 2: Run** `npx vitest run src/corte.test.ts src/caja.test.ts` → Expected: FAIL.
- [ ] **Step 3: Implement.** `resumenCorte` imprime la línea `Primo` solo si `reparto.primo !== 0`, y "Tu utilidad" cuando no hay Primo. Actualizar las pruebas viejas que esperaban 50/50.
- [ ] **Step 4: Run** `npm test` → Expected: todo PASS.
- [ ] **Step 5: Commit** `feat: todo el reparto es de fran y el sobre de primo solo con saldo`.

---

### Task 5: Módulo `vender.ts` y pantalla Vender

**Files:**
- Create: `src/vender.ts`
- Modify: `src/ui.ts` (`vistaVender` :507, `PropsVender` :291, `bloqueHora` :474, quitar `abrirTraspaso` :866 y su uso), `src/main.ts` (props de Vender, `registrarTraspaso` :425, `alRegistrarHora`), `src/estilos.css`

**Interfaces:**
- Consumes: Tasks 1–2 (`planConteo`, `eventosDeHora`, `hieleraDe` con producto).
- Produces en `vender.ts`:
  - `type PropsConteo = { eventos; hoy; ahora; puntos; lugarInicial; alRegistrar(datos: { punto: string; hora: string; quedan: Record<Producto, number | null> }): void; alAbrirCarga(): void; alAbrirMayoreo(): void }`
  - `function bloqueConteo(p: PropsConteo): HTMLElement` — campo grande "¿Cuántas te quedan?" (`inputmode=numeric`, pista "traes N"), fila de litros solo si hay litros cargados hoy, lugar y hora debajo, botón `Registrar` ancho deshabilitado hasta que haya un conteo, y fila de acciones secundarias **Cargar hielera** / **Mayoreo**
  - `ui.ts` exporta lo que `vender.ts` necesite (`el`, `boton`, `campo`, `selector`, `entrada`) o `vender.ts` los importa de `ui.ts` sin ciclo: si hay ciclo, mover esos helpers a `src/dom.ts` en esta misma tarea.
  - `PropsVender` pierde `vendedor`, `alCambiarVendedor`, `alAbrirTraspaso`, y `alAbrirCarga` pierde su argumento.

- [ ] **Step 1: Write the failing test** para lo que es lógica pura: en `vender.ts` exportar `function estadoRegistrar(quedan: Record<Producto, number | null>): { habilitado: boolean }` y probar en `src/vender.test.ts`: todo `null` → deshabilitado; `{botella: 0, litro: null}` → habilitado (0 cuenta); `{botella: null, litro: 3}` → habilitado.
- [ ] **Step 2: Run** `npx vitest run src/vender.test.ts` → Expected: FAIL (módulo no existe).
- [ ] **Step 3: Implement** `vender.ts` y reemplazar `bloqueHora`/`vistaVender`. Conservar `barraEstado` (hielera de Fran) y `resumenDeHoy`. El conteo en vivo `+1` y su turno se mantienen debajo como "¿Contar en vivo?" sin selector de vendedor. En `main.ts`, `alRegistrarHora` arma `planConteo` por producto; si algún producto trae `sobrantes`, detener y ofrecer abrir la carga de ese producto (comportamiento existente). Eliminar `registrarTraspaso` y el modal.
- [ ] **Step 4: Run** `npm test && npm run build` → Expected: PASS y build sin errores de tipos.
- [ ] **Step 5: Verificación manual** con el skill `run`: Vender muestra el campo grande arriba, lugar/hora debajo, Cargar hielera y Mayoreo abajo, sin Pasar botellas; registrar un conteo de botellas y otro de litros; sobrante detiene la captura.
- [ ] **Step 6: Commit** `feat: pantalla vender centrada en el conteo de la hielera`.

---

### Task 6: Carga por producto, mayoreo, Hoy, Stats, Corte y Ajustes

**Files:**
- Modify: `src/ui.ts` (`abrirCarga` :789, `abrirCargaRetro` :1470, `abrirRetro` :1408, `abrirMayoreo` :960, `vistaHoy` :1220, `vistaStats` :1355, `tarjetasSocios` :1687, `bloqueIngreso` :1590, `vistaAjustes` :2246), `src/main.ts` (`cargarHielera` :445 y llamadas), `src/estilos.css`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - `abrirCarga(...)` ofrece selector de producto (botella/litro) y llama a `crearCarga({..., product})`
  - `abrirMayoreo` sigue solo de botellas (sin selector)
  - `tarjetasSocios(fran, primo)` → una tarjeta "Lo tuyo" cuando `primo === 0`
  - `bloqueIngreso` muestra la línea de litros solo si `ingreso.litro.piezas > 0`
  - Ajustes: sin "vendedor por defecto"; Stats: sin filtro por vendedor; métricas separadas por producto
  - El resto de selectores con `VENDEDORES` (`ui.ts` :345, :803, :892, :1375, :1423, :1483, :2285) usan `VENDEDORES_ACTIVOS`, salvo el histórico de Stats que sigue leyendo todos

- [ ] **Step 1: Write the failing test** para lo puro: en `dominio.test.ts`, `panelesDelDia` / `hieleras` devuelven un solo panel para un día nuevo y conservan los dos para un día histórico con Primo (`hieleras(eventos, clave)` = activos ∪ vendedores con eventos ese día).
- [ ] **Step 2: Run** `npx vitest run src/dominio.test.ts` → Expected: FAIL.
- [ ] **Step 3: Implement** el helper `vendedoresDelDia(eventos, clave): Vendedor[]` en `dominio.ts` (activos más los que tengan eventos ese día) y usarlo en `hieleras` y `panelesDelDia`. Aplicar los cambios de UI de la lista de Interfaces.
- [ ] **Step 4: Run** `npm test && npm run build` → Expected: PASS.
- [ ] **Step 5: Verificación manual** con `run`: Cargar hielera de litros; Corte con litros muestra su línea y una sola tarjeta "Lo tuyo"; Hoy de un día viejo con Primo sigue mostrando a los dos.
- [ ] **Step 6: Commit** `feat: carga por producto y pantallas sin segundo vendedor`.

---

### Task 7: README

**Files:**
- Modify: `README.md` (secciones de reparto 50/50 :132 :250 :429 :539–572, traspasos :211 :293–312 :648, selector de vendedor :16 :151 :609, stats :255, ajustes :257)

- [ ] **Step 1:** Reescribir cada sección listada al modelo nuevo: un vendedor, todo el corte es de Fran, el litro a $35 con su inventario, y la nueva pantalla Vender. Dejar una nota breve de que el historial con Primo se conserva.
- [ ] **Step 2: Run** `npm test && npm run build` → Expected: PASS.
- [ ] **Step 3: Commit** `docs: readme para vendedor unico y litro`.

---

## Self-Review

- **Cobertura del spec:** §1 modelo → T1; §2 dominio → T1, T2, T6; §3 corte → T3, T4; §4 caja → T4; §5 Vender → T5; §6 otras pantallas → T6; §7 errores/datos viejos → T1, T3 (tests de compatibilidad) y T2 (sobrantes); §8 pruebas → en cada tarea; §9 README → T7.
- **Consistencia de tipos:** `Producto`, `productoDe`, `hieleraDe(..., producto)`, `planConteo(..., producto)`, `eventosDeHora(... piezas: Partial<Record<Producto, number>>)`, `Precios.litro`, `Ingreso.litro` y `sobresVisibles` se definen una vez y se citan igual en las tareas posteriores.
- **Proporción:** el plan indica firmas, valores y pruebas; los cuerpos los escribe quien implementa.
