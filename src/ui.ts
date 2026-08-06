import type {
  AppEvent,
  Canal,
  LoadEvent,
  SaleEvent,
  Settings,
  ShiftEvent,
  TransferEvent,
  Vendedor,
} from './tipos';
import type { Barra, Hielera, Matriz, PanelVendedor, Rango, Turno } from './dominio';
import type { Borrador, CorteCerrado, Ingreso, LineaGasto, Precios, Reparto } from './corte';
import {
  FONDO_CAJA,
  FONDO_CAMBIO,
  FONDO_GASTO,
  calcularReparto,
  centavosDesde,
  efectivoEsperado,
  importe,
  pesos,
} from './corte';
import {
  HIELERA_BAJA,
  HIELERA_CRITICA,
  VENDEDORES,
  cargasDeFecha,
  claveFecha,
  duracionLegible,
  fechaLegible,
  hieleraDe,
  hieleras,
  horaMinuto,
  idsAnulados,
  filtrarCanal,
  filtrarRango,
  jornada,
  ordenarPorHora,
  panelesDelDia,
  porDia,
  porHora,
  porLugarYHora,
  porPunto,
  porVendedor,
  sugerenciaEquilibrio,
  totalDelDia,
  totalPiezas,
  traspasosDeFecha,
  turnoActual,
  turnosDeFecha,
  ultimaVentaActiva,
  ventasActivas,
  ventasDeFecha,
} from './dominio';

// Toda la escritura de texto pasa por textContent: nunca innerHTML con datos del usuario.

type Opciones = {
  clase?: string;
  texto?: string;
  attrs?: Record<string, string>;
  onClick?: () => void;
};

export function el<K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  opciones: Opciones = {},
  hijos: readonly (Node | null)[] = []
): HTMLElementTagNameMap[K] {
  const nodo = document.createElement(etiqueta);
  if (opciones.clase !== undefined) nodo.className = opciones.clase;
  if (opciones.texto !== undefined) nodo.textContent = opciones.texto;
  if (opciones.attrs !== undefined) {
    for (const [nombre, valor] of Object.entries(opciones.attrs)) nodo.setAttribute(nombre, valor);
  }
  if (opciones.onClick !== undefined) nodo.addEventListener('click', opciones.onClick);
  for (const hijo of hijos) if (hijo !== null) nodo.appendChild(hijo);
  return nodo;
}

function boton(texto: string, clase: string, onClick: () => void): HTMLButtonElement {
  return el('button', { clase, texto, attrs: { type: 'button' }, onClick });
}

export function limpiar(nodo: HTMLElement): void {
  nodo.replaceChildren();
}

let temporizadorToast = 0;

export function toast(mensaje: string, milisegundos = 1500): void {
  const nodo = document.getElementById('toast');
  if (nodo === null) return;
  nodo.textContent = mensaje;
  nodo.classList.add('visible');
  window.clearTimeout(temporizadorToast);
  temporizadorToast = window.setTimeout(() => nodo.classList.remove('visible'), milisegundos);
}

function encabezado(titulo: string, detalle: string): HTMLElement {
  return el('div', { clase: 'encabezado' }, [
    el('h1', { texto: titulo }),
    el('span', { clase: 'detalle num', texto: detalle }),
  ]);
}

function segmentado<T extends string>(
  opciones: readonly { valor: T; etiqueta: string }[],
  activo: T,
  alCambiar: (valor: T) => void
): HTMLElement {
  return el(
    'div',
    { clase: 'fila-botones' },
    opciones.map((o) => {
      const b = boton(o.etiqueta, `btn${o.valor === activo ? ' activo' : ''}`, () => alCambiar(o.valor));
      b.setAttribute('aria-pressed', String(o.valor === activo));
      return b;
    })
  );
}

function bloqueBarras(titulo: string, barras: readonly Barra[], anidado = false): HTMLElement {
  const maximo = barras.reduce((m, b) => Math.max(m, b.valor), 0);
  const filas: HTMLElement[] =
    barras.length === 0
      ? [el('p', { clase: 'vacio', texto: 'Sin ventas en este rango.' })]
      : barras.map((b) => {
          const relleno = el('div', { clase: 'barra-relleno' });
          relleno.style.width = `${maximo === 0 ? 0 : Math.round((b.valor / maximo) * 100)}%`;
          return el('div', { clase: 'barra' }, [
            el('span', { clase: 'barra-etiqueta num', texto: b.etiqueta }),
            el('div', { clase: 'barra-riel' }, [relleno]),
            el('span', { clase: 'barra-valor num', texto: String(b.valor) }),
          ]);
        });
  return el('section', { clase: anidado ? 'bloque-barras' : 'bloque' }, [
    el(anidado ? 'h3' : 'h2', { texto: titulo }),
    ...filas,
  ]);
}

function campo(etiqueta: string, control: HTMLElement): HTMLElement {
  return el('label', {}, [el('span', { clase: 'detalle', texto: etiqueta }), control]);
}

function selector(valores: readonly string[], valorInicial: string): HTMLSelectElement {
  const s = el('select');
  for (const v of valores) {
    const opcion = el('option', { texto: v });
    opcion.value = v;
    s.appendChild(opcion);
  }
  s.value = valorInicial;
  return s;
}

function entrada(tipo: string, valor: string, attrs: Record<string, string> = {}): HTMLInputElement {
  const i = el('input', { attrs: { type: tipo, ...attrs } });
  i.value = valor;
  return i;
}

// ---------- navegacion ----------

export type Vista = 'vender' | 'hoy' | 'corte' | 'stats' | 'ajustes';

const SECCIONES: readonly { valor: Vista; etiqueta: string }[] = [
  { valor: 'vender', etiqueta: 'Vender' },
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: 'corte', etiqueta: 'Corte' },
  { valor: 'stats', etiqueta: 'Stats' },
  { valor: 'ajustes', etiqueta: 'Ajustes' },
];

export function pintarNav(contenedor: HTMLElement, activa: Vista, alCambiar: (v: Vista) => void): void {
  limpiar(contenedor);
  for (const s of SECCIONES) {
    const b = boton(s.etiqueta, `nav-btn${s.valor === activa ? ' activo' : ''}`, () => alCambiar(s.valor));
    b.setAttribute('aria-current', s.valor === activa ? 'page' : 'false');
    contenedor.appendChild(b);
  }
}

// ---------- vista: vender ----------

export type PropsVender = {
  eventos: readonly AppEvent[];
  ajustes: Settings;
  vendedor: Vendedor;
  hoy: string;
  ahora: Date;
  alCambiarVendedor: (v: Vendedor) => void;
  alVender: (punto: string, qty: number) => void;
  alRestar: (punto: string) => void;
  alMarcarLugar: (punto: string) => void;
  alAbrirMayoreo: () => void;
  alAbrirCarga: (v: Vendedor) => void;
  alAbrirTraspaso: () => void;
};

const ID_HIELERA = 'barra-hielera';

/**
 * Marca el contador de la hielera despues de registrar: el vendedor confirma de reojo que
 * el sistema conto, sin leer. Con prefers-reduced-motion el CSS deja solo el cambio de numero.
 */
export function destacarHielera(): void {
  const nodo = document.getElementById(ID_HIELERA);
  if (nodo === null) return;
  nodo.classList.remove('pulso');
  void nodo.offsetWidth; // reinicia la animacion si se vende dos veces seguidas
  nodo.classList.add('pulso');
}

/** Quien vende y que le queda, en una linea. Nada mas: el resto de la pantalla es para vender. */
function barraEstado(p: PropsVender): HTMLElement {
  const h = hieleraDe(p.eventos, p.vendedor, p.hoy);
  const vendidoHoy = totalPiezas(
    ventasActivas(p.eventos).filter((v) => claveFecha(v.ts) === p.hoy)
  );

  // Sin cargas ni ventas todavia el restante no significa nada: mejor un guion que un 0 rojo.
  const enBlanco = h.sinCarga && h.vendido === 0;
  const critico = !enBlanco && h.restante <= HIELERA_CRITICA;

  const control = el(
    'div',
    { clase: 'segmentado', attrs: { role: 'group', 'aria-label': 'Vendedor activo' } },
    VENDEDORES.map((v) => {
      const b = boton(v, `seg${v === p.vendedor ? ' activo' : ''}`, () => p.alCambiarVendedor(v));
      b.setAttribute('aria-pressed', String(v === p.vendedor));
      return b;
    })
  );

  const cifraHielera = el('span', {
    clase: `barra-cifra num${critico ? ' critico' : ''}`,
    texto: enBlanco ? '—' : String(h.restante),
    attrs: { id: ID_HIELERA },
  });

  return el('div', { clase: 'barra-estado' }, [
    control,
    el('div', { clase: 'barra-datos' }, [
      el('span', { clase: 'barra-dato' }, [
        el('span', { clase: 'detalle', texto: 'Hielera ' }),
        cifraHielera,
      ]),
      el('span', { clase: 'barra-dato' }, [
        el('span', { clase: 'detalle', texto: 'Hoy ' }),
        el('span', { clase: 'barra-cifra num', texto: String(vendidoHoy) }),
      ]),
    ]),
  ]);
}

/**
 * Sin lugar marcado no hay a que acreditar la venta, asi que la pantalla no ofrece el boton
 * grande todavia: primero se dice donde se esta parado. Un toque, y ya se puede vender.
 */
function tarjetaSinLugar(p: PropsVender): HTMLElement {
  return el('section', { clase: 'turno turno-vacio' }, [
    el('h2', { texto: '¿Dónde están?' }),
    el('p', {
      clase: 'detalle',
      texto: 'Marca el lugar una vez: abre el turno de los dos y ahí se acredita todo.',
    }),
    el(
      'div',
      { clase: 'lugares' },
      p.ajustes.points.map((punto) => boton(punto, 'btn-lugar', () => p.alMarcarLugar(punto)))
    ),
  ]);
}

/** Donde esta parado el vendedor y desde que hora: el encabezado del turno en curso. */
function tarjetaTurno(p: PropsVender, turno: Turno): HTMLElement {
  const pie = [`desde ${horaMinuto(turno.inicio)}`, duracionLegible(turno.minutos)];
  if (turno.piezas > 0) pie.push(`${turno.piezas} piezas`);

  return el('section', { clase: 'turno' }, [
    el('div', { clase: 'turno-cabeza' }, [
      el('div', {}, [
        el('span', { clase: 'detalle', texto: 'Aquí' }),
        el('h2', { clase: 'turno-lugar', texto: turno.punto }),
      ]),
      boton('Cambiar', 'btn-texto', () =>
        abrirLugar(p.ajustes.points, turno.punto, p.alMarcarLugar)
      ),
    ]),
    el('p', { clase: 'detalle num turno-pie', texto: pie.join(' · ') }),
  ]);
}

/** Los botones que registran. Todos van al lugar del turno: nadie elige punto al vender. */
function bloqueVenta(p: PropsVender, punto: string): HTMLElement {
  const mayoreo = totalDelDia(p.eventos, p.hoy, punto, 'mayoreo');

  const botonPrincipal = boton(`+1 · ${p.vendedor}`, 'btn-venta', () => p.alVender(punto, 1));
  botonPrincipal.setAttribute('aria-label', `Registrar una venta de ${p.vendedor} en ${punto}`);

  // Por vendedor, no por punto: los dos venden desde este telefono y en este mismo lugar, asi
  // que un -1 sin filtrar le borraria la pieza al otro sin avisar.
  const hayQueAnular = ultimaVentaActiva(p.eventos, punto, p.hoy, p.vendedor) !== null;
  const botonRestar = boton('−1', 'btn-chico peligro', () => p.alRestar(punto));
  botonRestar.disabled = !hayQueAnular;
  botonRestar.setAttribute('aria-label', `Anular la última venta de ${p.vendedor} en ${punto}`);

  return el('section', { clase: 'punto' }, [
    botonPrincipal,
    el('div', { clase: 'fila-chica' }, [
      boton('+2', 'btn-chico acento', () => p.alVender(punto, 2)),
      boton('+3', 'btn-chico acento', () => p.alVender(punto, 3)),
      botonRestar,
    ]),
    mayoreo > 0 ? el('p', { clase: 'detalle num punto-pie', texto: `mayoreo hoy ${mayoreo}` }) : null,
  ]);
}

/** Lo del dia por lugar, solo para mirar: registrar es arriba, en el lugar del turno. */
function resumenDeHoy(p: PropsVender): HTMLElement | null {
  const calle = ventasActivas(p.eventos).filter(
    (v) => claveFecha(v.ts) === p.hoy && v.channel === 'calle'
  );
  if (calle.length === 0) return null;
  return bloqueBarras('Calle hoy por lugar', porPunto(calle, p.ajustes.points), true);
}

export function vistaVender(p: PropsVender): HTMLElement {
  const marcado = turnoActual(p.eventos, p.vendedor, p.hoy);
  const turno =
    marcado === null
      ? null
      : jornada(p.eventos, p.hoy, p.ahora).turnos.find((t) => t.id === marcado.id) ?? null;

  return el('div', { clase: 'pantalla-vender' }, [
    el('h1', { clase: 'solo-lectores', texto: 'Vender' }),
    barraEstado(p),
    turno === null ? tarjetaSinLugar(p) : tarjetaTurno(p, turno),
    turno === null ? null : bloqueVenta(p, turno.punto),
    resumenDeHoy(p),
    el('div', { clase: 'acciones-secundarias' }, [
      boton('Cargar hielera', 'btn-texto', () => p.alAbrirCarga(p.vendedor)),
      boton('Pasar botellas', 'btn-texto', p.alAbrirTraspaso),
      boton('Mayoreo', 'btn-texto', p.alAbrirMayoreo),
    ]),
  ]);
}

/** Cambiar de lugar es marcar uno nuevo: el turno anterior se cierra solo a esa hora. */
function abrirLugar(
  puntos: readonly string[],
  actual: string | null,
  alConfirmar: (punto: string) => void
): void {
  const modal = el('dialog', { attrs: { 'aria-label': 'Cambiar de lugar' } });

  if (typeof modal.showModal !== 'function') {
    const respuesta = window.prompt(`Lugar (${puntos.join(', ')}):`, actual ?? puntos[0] ?? '');
    if (respuesta !== null && puntos.includes(respuesta)) alConfirmar(respuesta);
    return;
  }

  const cerrar = (): void => {
    modal.close();
    modal.remove();
  };

  modal.appendChild(
    el('div', {}, [
      el('h2', { texto: 'Cambiar de lugar' }),
      el('p', {
        clase: 'detalle',
        texto: 'Desde este momento las ventas de los dos se acreditan al lugar nuevo.',
      }),
      el(
        'div',
        { clase: 'lugares' },
        puntos.map((punto) =>
          boton(punto, `btn-lugar${punto === actual ? ' activo' : ''}`, () => {
            cerrar();
            alConfirmar(punto);
          })
        )
      ),
      el('div', { clase: 'fila-botones' }, [boton('Cancelar', 'btn', cerrar)]),
    ])
  );

  document.body.appendChild(modal);
  modal.addEventListener('cancel', () => modal.remove());
  modal.showModal();
}

/** Tamanos tipicos de lote: casi siempre la carga es una de estas dos. */
const LOTES: readonly number[] = [18, 19];

export function abrirCarga(
  vendedorActual: Vendedor,
  cargadoDe: (v: Vendedor) => Hielera,
  alConfirmar: (vendedor: Vendedor, qty: number) => void
): void {
  const modal = el('dialog', { attrs: { 'aria-label': 'Cargar hielera' } });

  if (typeof modal.showModal !== 'function') {
    const respuesta = window.prompt(`Piezas que carga ${vendedorActual} en su hielera:`, '18');
    const qty = Number(respuesta);
    if (Number.isInteger(qty) && qty >= 1) alConfirmar(vendedorActual, qty);
    return;
  }

  const vendedor = selector(VENDEDORES, vendedorActual);
  const cantidad = entrada('number', String(LOTES[0] ?? 18), {
    min: '1',
    step: '1',
    inputmode: 'numeric',
  });
  const estado = el('p', { clase: 'detalle' });
  const refrescar = (): void => {
    const h = cargadoDe(vendedor.value as Vendedor);
    estado.textContent = h.sinCarga
      ? `${h.vendedor} no tiene carga registrada hoy.`
      : `${h.vendedor} lleva ${h.cargado} cargados hoy; esto se suma.`;
  };
  vendedor.addEventListener('change', refrescar);
  refrescar();

  const cerrar = (): void => {
    modal.close();
    modal.remove();
  };

  const confirmar = (qty: number): void => {
    if (!Number.isInteger(qty) || qty < 1) {
      toast('Cantidad invalida');
      return;
    }
    cerrar();
    alConfirmar(vendedor.value as Vendedor, qty);
  };

  modal.appendChild(
    el('div', {}, [
      el('h2', { texto: 'Cargar hielera' }),
      el('p', { clase: 'detalle', texto: 'Piezas que salen en la hielera. Las recargas del día suman.' }),
      campo('Vendedor', vendedor),
      campo('Piezas', cantidad),
      el(
        'div',
        { clase: 'fila-chica' },
        LOTES.map((n) =>
          boton(String(n), 'btn-chico acento', () => {
            cantidad.value = String(n);
          })
        )
      ),
      estado,
      el('div', { clase: 'fila-botones' }, [
        boton('Cancelar', 'btn', cerrar),
        boton('Cargar', 'btn activo', () => confirmar(Number(cantidad.value))),
      ]),
    ])
  );

  document.body.appendChild(modal);
  modal.addEventListener('cancel', () => modal.remove());
  modal.showModal();
}

/**
 * Pasar botellas de una hielera a la otra. El numero llega precargado con lo que dejaria a los
 * dos parejos, que es para lo que se cuentan, pero se puede editar: el que decide cuantas pasan
 * es el que las esta contando, no la app.
 */
export function abrirTraspaso(
  vendedorActual: Vendedor,
  traeAhora: (v: Vendedor) => Hielera,
  alConfirmar: (from: Vendedor, to: Vendedor, qty: number) => void
): void {
  const otro = (v: Vendedor): Vendedor => VENDEDORES.find((x) => x !== v) ?? v;
  // Por defecto da el que trae mas: es el caso real, el que se esta quedando sin nada recibe.
  const sugeridoDonante =
    traeAhora(otro(vendedorActual)).restante > traeAhora(vendedorActual).restante
      ? otro(vendedorActual)
      : vendedorActual;

  const modal = el('dialog', { attrs: { 'aria-label': 'Pasar botellas' } });

  if (typeof modal.showModal !== 'function') {
    const destino = otro(sugeridoDonante);
    const parejo = sugerenciaEquilibrio(traeAhora(sugeridoDonante), traeAhora(destino));
    const respuesta = window.prompt(
      `Piezas que ${sugeridoDonante} le pasa a ${destino}:`,
      String(parejo)
    );
    const qty = Number(respuesta);
    if (Number.isInteger(qty) && qty >= 1) alConfirmar(sugeridoDonante, destino, qty);
    return;
  }

  const donante = selector(VENDEDORES, sugeridoDonante);
  const cantidad = entrada('number', '0', { min: '1', step: '1', inputmode: 'numeric' });
  const estado = el('p', { clase: 'detalle' });

  /** Las dos hieleras en juego, siempre en el sentido del selector: quien da y quien recibe. */
  const lados = (): { da: Hielera; recibe: Hielera } => {
    const quienDa = donante.value as Vendedor;
    return { da: traeAhora(quienDa), recibe: traeAhora(otro(quienDa)) };
  };

  const botonMitad = boton('Mitad y mitad', 'btn-chico acento', () => {
    const { da, recibe } = lados();
    cantidad.value = String(sugerenciaEquilibrio(da, recibe));
  });

  const refrescar = (): void => {
    const { da, recibe } = lados();
    cantidad.value = String(sugerenciaEquilibrio(da, recibe));
    // Sin carga ni traspaso registrado el restante no significa nada: sugerir la mitad de un
    // numero que no existe seria inventarla.
    const aCiegas = da.sinCarga || recibe.sinCarga;
    botonMitad.disabled = aCiegas;
    estado.textContent = aCiegas
      ? 'Falta registrar carga: la app no sabe cuántas trae cada quien.'
      : `${da.vendedor} trae ${da.restante} · ${recibe.vendedor} trae ${recibe.restante}`;
  };
  donante.addEventListener('change', refrescar);
  refrescar();

  const cerrar = (): void => {
    modal.close();
    modal.remove();
  };

  const confirmar = (): void => {
    const da = donante.value as Vendedor;
    const qty = Number(cantidad.value);
    if (!Number.isInteger(qty) || qty < 1) {
      toast('Cantidad invalida');
      return;
    }
    cerrar();
    alConfirmar(da, otro(da), qty);
  };

  modal.appendChild(
    el('div', {}, [
      el('h2', { texto: 'Pasar botellas' }),
      el('p', {
        clase: 'detalle',
        texto: 'Cambian de hielera, no se venden. El total cargado del día no se mueve.',
      }),
      campo('Las pasa', donante),
      campo('Piezas', cantidad),
      el('div', { clase: 'fila-chica' }, [botonMitad]),
      estado,
      el('div', { clase: 'fila-botones' }, [
        boton('Cancelar', 'btn', cerrar),
        boton('Pasar', 'btn activo', confirmar),
      ]),
    ])
  );

  document.body.appendChild(modal);
  modal.addEventListener('cancel', () => modal.remove());
  modal.showModal();
}

export function abrirMayoreo(
  puntos: readonly string[],
  alConfirmar: (punto: string, qty: number) => void
): void {
  const primero = puntos[0] ?? '';
  const modal = el('dialog', { attrs: { 'aria-label': 'Venta de mayoreo' } });

  if (typeof modal.showModal !== 'function') {
    // Fallback minimo para navegadores sin <dialog>.
    const respuesta = window.prompt(`Mayoreo en ${primero}. Cantidad:`, '10');
    const qty = Number(respuesta);
    if (Number.isInteger(qty) && qty >= 1) alConfirmar(primero, qty);
    return;
  }

  const punto = selector(puntos, primero);
  const cantidad = entrada('number', '10', { min: '1', step: '1', inputmode: 'numeric' });
  const cerrar = (): void => {
    modal.close();
    modal.remove();
  };

  modal.appendChild(
    el('div', {}, [
      el('h2', { texto: 'Mayoreo' }),
      el('p', { clase: 'detalle', texto: 'Solo cantidad; el precio lo aplica el Corte al cerrar el dia.' }),
      campo('Punto', punto),
      campo('Cantidad', cantidad),
      el('div', { clase: 'fila-botones' }, [
        boton('Cancelar', 'btn', cerrar),
        boton('Registrar', 'btn activo', () => {
          const qty = Number(cantidad.value);
          if (!Number.isInteger(qty) || qty < 1) {
            toast('Cantidad invalida');
            return;
          }
          cerrar();
          alConfirmar(punto.value, qty);
        }),
      ]),
    ])
  );

  document.body.appendChild(modal);
  modal.addEventListener('cancel', () => modal.remove());
  modal.showModal();
}

// ---------- vista: hoy ----------

export type PropsHoy = {
  eventos: readonly AppEvent[];
  ajustes: Settings;
  fecha: string;
  ahora: Date;
  alCambiarFecha: (f: string) => void;
  alAnular: (id: string) => void;
  alAbrirRetro: () => void;
  alAbrirCargaRetro: () => void;
};

/**
 * Linea de verificacion, no formulario: cargó + recibió = vendió + pasó + lo que queda.
 * Los traspasos solo se escriben cuando los hubo: en un dia normal la linea es la de siempre.
 */
function lineaCuadre(h: Hielera): HTMLElement {
  const sinMovimiento =
    h.cargado === 0 && h.vendido === 0 && h.recibido === 0 && h.entregado === 0;

  const separador = (): HTMLElement => el('span', { clase: 'detalle', texto: ' · ' });
  const cuentas: HTMLElement[] = [el('span', { texto: `Cargó ${h.cargado}` })];
  if (h.recibido > 0) cuentas.push(separador(), el('span', { texto: `recibió ${h.recibido}` }));
  if (h.entregado > 0) cuentas.push(separador(), el('span', { texto: `pasó ${h.entregado}` }));
  cuentas.push(separador(), el('span', { texto: `Vendió ${h.vendido}` }));
  cuentas.push(
    separador(),
    el('span', {
      clase: h.restante < 0 ? 'negativo' : '',
      texto: `En hielera ${h.restante}`,
    })
  );

  return el('div', { clase: 'cuadre-fila' }, [
    el('span', { clase: 'cuadre-vendedor', texto: h.vendedor }),
    sinMovimiento
      ? el('span', { clase: 'detalle', texto: 'sin movimientos' })
      : el('span', { clase: 'cuadre-cuentas num' }, cuentas),
    sinMovimiento
      ? null
      : el('span', {
          clase: `cuadre-marca ${h.cuadra ? 'ok' : 'alerta'}`,
          texto: h.cuadra ? '✓' : '!',
          attrs: { 'aria-label': h.cuadra ? 'cuadra' : 'no cuadra' },
        }),
  ]);
}

/**
 * El aviso del negativo tiene que decir la causa correcta. Si hubo traspasos, "falta una carga"
 * es una de dos explicaciones posibles y la otra es que se pasaron mal las piezas; mandar a
 * registrar una carga que no existio inflaria el cargado del dia contra el almacen.
 */
function causaDelNegativo(h: Hielera): string {
  const hubo = h.recibido > 0 || h.entregado > 0;
  return hubo
    ? `${h.vendedor} vendió ${-h.restante} más de las que tuvo: falta una carga, o el traspaso quedó mal contado.`
    : `${h.vendedor} vendió ${-h.restante} más de lo cargado: falta registrar una carga.`;
}

function bloqueCuadre(eventos: readonly AppEvent[], fecha: string): HTMLElement {
  const delDia = hieleras(eventos, fecha);
  const faltantes = delDia.filter((h) => h.restante < 0);
  // Los traspasos se cancelan entre las dos hieleras, asi que este total sigue siendo lo que
  // de verdad salio de casa y se puede contar contra el almacen.
  const cargadoDelDia = delDia.reduce((s, h) => s + h.cargado, 0);

  return el('section', { clase: 'bloque' }, [
    el('h2', { texto: 'Cuadre del día' }),
    el('p', { clase: 'detalle', texto: 'Cargadas + recibidas = vendidas + pasadas + restantes.' }),
    ...delDia.map(lineaCuadre),
    el('p', { clase: 'detalle num', texto: `Salieron ${cargadoDelDia} piezas de casa.` }),
    ...faltantes.map((h) => el('p', { clase: 'aviso', texto: causaDelNegativo(h) })),
  ]);
}

function insignias(v: SaleEvent): HTMLElement[] {
  const marcas: HTMLElement[] = [];
  if (v.channel === 'mayoreo') marcas.push(el('span', { clase: 'insignia', texto: 'MAYOREO' }));
  if (v.retro === true) marcas.push(el('span', { clase: 'insignia', texto: 'RETRO' }));
  return marcas;
}

/** Cada rato parado en un lugar, con lo que rindio. La lectura de "una hora aprox por lugar". */
function bloqueTurnos(turnos: readonly Turno[]): HTMLElement {
  return el('section', { clase: 'bloque-barras' }, [
    el('h3', { texto: 'Turnos' }),
    ...turnos.map((t) =>
      el('div', { clase: 'turno-fila' }, [
        el('span', { clase: 'turno-fila-lugar', texto: t.punto }),
        el('span', { clase: 'detalle num', texto: t.franja }),
        el('span', {
          clase: 'num turno-fila-cifra',
          texto: t.piezas === 0 ? '—' : String(t.piezas),
        }),
        el('span', {
          clase: 'detalle num',
          texto: t.piezas === 0 ? 'sin ventas' : `${t.porHora}/h`,
        }),
      ])
    ),
  ]);
}

/** 'de 18 cargados', y si hubo traspaso tambien de donde salieron las que no cargo el. */
function pieDeHielera(h: Hielera): string {
  const partes = [`de ${h.cargado} cargados`];
  if (h.recibido > 0) partes.push(`+${h.recibido} recibidas`);
  if (h.entregado > 0) partes.push(`−${h.entregado} pasadas`);
  return partes.join(' ');
}

/** Una cifra grande con su rotulo: el tablero se lee de un vistazo, sin interpretar barras. */
function metrica(rotulo: string, valor: string, pie: string, clase = ''): HTMLElement {
  return el('div', { clase: `metrica${clase === '' ? '' : ` ${clase}`}` }, [
    el('span', { clase: 'detalle metrica-rotulo', texto: rotulo }),
    el('span', { clase: 'metrica-cifra num', texto: valor }),
    el('span', { clase: 'detalle metrica-pie num', texto: pie }),
  ]);
}

function panelDelVendedor(panel: PanelVendedor, turnos: readonly Turno[]): HTMLElement {
  const { hielera: h, ritmo: r } = panel;
  const vendioAlgo = h.vendido > 0;

  const lugar =
    panel.mejorPunto === null
      ? el('p', { clase: 'vacio', texto: 'Sin ventas todavía en esta fecha.' })
      : el('p', { clase: 'detalle' }, [
          el('span', { texto: 'Mejor lugar ' }),
          el('strong', { texto: panel.mejorPunto.etiqueta }),
          el('span', { clase: 'num', texto: ` (${panel.mejorPunto.valor})` }),
          panel.mejorHora === null
            ? null
            : el('span', { clase: 'num', texto: ` · mejor hora ${panel.mejorHora.etiqueta}` }),
        ]);

  return el('section', { clase: 'bloque' }, [
    el('div', { clase: 'punto-nombre' }, [
      el('h2', { texto: panel.vendedor }),
      el('span', {
        clase: 'detalle num',
        texto: panel.mayoreo > 0 ? `calle ${panel.calle} · mayoreo ${panel.mayoreo}` : '',
      }),
    ]),
    el('div', { clase: 'metricas' }, [
      metrica(
        'En hielera',
        h.sinCarga ? '—' : String(h.restante),
        h.sinCarga ? 'sin carga registrada' : pieDeHielera(h),
        !h.sinCarga && h.restante <= HIELERA_BAJA ? 'alerta' : ''
      ),
      metrica('Vendió', String(h.vendido), 'piezas'),
      metrica(
        'Ritmo',
        r.porHora > 0 ? `${r.porHora}` : '—',
        r.porHora > 0 ? `por hora · en ${duracionLegible(r.minutos)}` : 'por hora'
      ),
    ]),
    h.restante < 0 ? el('p', { clase: 'aviso', texto: causaDelNegativo(h) }) : null,
    lugar,
    turnos.length === 0 ? null : bloqueTurnos(turnos),
    vendioAlgo ? bloqueBarras('Por lugar', panel.porPunto, true) : null,
    vendioAlgo ? bloqueBarras('Por hora', panel.porHora, true) : null,
  ]);
}

type Movimiento = SaleEvent | LoadEvent | ShiftEvent | TransferEvent;

function filaMovimiento(m: Movimiento): (HTMLElement | null)[] {
  const hora = el('span', { clase: 'num', texto: horaMinuto(m.ts) });
  if (m.type === 'load') {
    return [
      hora,
      el('span', { clase: 'insignia', texto: 'CARGA' }),
      el('span', { clase: 'detalle', texto: m.vendor }),
      el('span', { clase: 'num', texto: `×${m.qty}` }),
    ];
  }
  if (m.type === 'transfer') {
    return [
      hora,
      el('span', { clase: 'insignia', texto: 'PASA' }),
      el('span', { texto: `${m.from} → ${m.to}` }),
      el('span', { clase: 'num', texto: `×${m.qty}` }),
    ];
  }
  if (m.type === 'shift') {
    return [
      hora,
      el('span', { clase: 'insignia', texto: 'LUGAR' }),
      el('span', { texto: m.point }),
      el('span', { clase: 'detalle', texto: m.vendor }),
    ];
  }
  return [
    hora,
    el('span', { texto: m.point }),
    el('span', { clase: 'detalle', texto: m.vendor }),
    el('span', { clase: 'num', texto: `×${m.qty}` }),
    ...insignias(m),
  ];
}

export function vistaHoy(p: PropsHoy): HTMLElement {
  const ventas = ventasDeFecha(p.eventos, p.fecha);
  const cargas = cargasDeFecha(p.eventos, p.fecha);
  const turnos = turnosDeFecha(p.eventos, p.fecha);
  const traspasos = traspasosDeFecha(p.eventos, p.fecha);
  const anulados = idsAnulados(p.eventos);
  const activas = ventas.filter((v) => !anulados.has(v.id));
  const paneles = panelesDelDia(p.eventos, p.fecha, p.ajustes.points);
  const { turnos: cerrados, sinTurno } = jornada(p.eventos, p.fecha, p.ahora);

  const selectorFecha = entrada('date', p.fecha);
  selectorFecha.addEventListener('change', () => {
    if (selectorFecha.value !== '') p.alCambiarFecha(selectorFecha.value);
  });

  const movimientos = ordenarPorHora<Movimiento>([
    ...ventas,
    ...cargas,
    ...turnos,
    ...traspasos,
  ]);
  const filas =
    movimientos.length === 0
      ? [el('p', { clase: 'vacio', texto: 'Sin registros en esta fecha.' })]
      : movimientos.map((m) => {
          const anulada = anulados.has(m.id);
          return el('div', { clase: `fila${anulada ? ' anulada' : ''}` }, [
            el('div', { clase: 'fila-datos' }, filaMovimiento(m)),
            anulada
              ? el('span', { clase: 'detalle', texto: 'anulada' })
              : boton('Anular', 'btn peligro', () => p.alAnular(m.id)),
          ]);
        });

  return el('div', {}, [
    encabezado('Hoy', `${fechaLegible(p.fecha)} · ${totalPiezas(activas)} piezas`),
    campo('Fecha', selectorFecha),
    ...paneles.map((panel) =>
      panelDelVendedor(
        panel,
        cerrados.filter((t) => t.vendedor === panel.vendedor)
      )
    ),
    sinTurno === 0
      ? null
      : el('p', {
          clase: 'aviso',
          texto: `${sinTurno} piezas quedaron fuera de turno: se vendieron sin marcar lugar.`,
        }),
    el('div', { clase: 'separador' }),
    el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Movimientos' }),
      el('div', {}, filas),
      el('div', { clase: 'fila-botones espaciado' }, [
        boton('Venta retroactiva', 'btn', p.alAbrirRetro),
        boton('Carga retroactiva', 'btn', p.alAbrirCargaRetro),
      ]),
    ]),
    bloqueCuadre(p.eventos, p.fecha),
  ]);
}

// ---------- vista: stats ----------

export type PropsStats = {
  eventos: readonly AppEvent[];
  ajustes: Settings;
  rango: Rango;
  canal: Canal | 'todo';
  vendedor: Vendedor | 'todos';
  ahora: Date;
  alCambiarRango: (r: Rango) => void;
  alCambiarCanal: (c: Canal | 'todo') => void;
  alCambiarVendedor: (v: Vendedor | 'todos') => void;
};

/**
 * Lugar x hora en una cuadricula: la pregunta real del negocio, "donde y a que hora se vende".
 * La intensidad del fondo va contra el maximo de la tabla; el numero siempre esta escrito,
 * para que no haya que interpretar el color.
 */
function bloqueMatriz(titulo: string, m: Matriz): HTMLElement {
  if (m.filas.length === 0) {
    return el('section', { clase: 'bloque' }, [
      el('h2', { texto: titulo }),
      el('p', { clase: 'vacio', texto: 'Sin ventas en este rango.' }),
    ]);
  }

  const columnas = `minmax(6rem, 1fr) repeat(${m.horas.length}, 2.4rem) 2.8rem`;
  const rejilla = el('div', { clase: 'matriz' });
  rejilla.style.gridTemplateColumns = columnas;

  rejilla.appendChild(el('span', { clase: 'matriz-esquina' }));
  for (const h of m.horas) {
    rejilla.appendChild(el('span', { clase: 'matriz-cabeza num', texto: String(h) }));
  }
  rejilla.appendChild(el('span', { clase: 'matriz-cabeza num', texto: 'Tot' }));

  for (const fila of m.filas) {
    rejilla.appendChild(el('span', { clase: 'matriz-lugar', texto: fila.punto }));
    for (const celda of fila.celdas) {
      const nodo = el('span', {
        clase: `matriz-celda num${celda.valor === 0 ? ' vacia' : ''}`,
        texto: celda.valor === 0 ? '·' : String(celda.valor),
        attrs: { title: `${fila.punto} · ${celda.hora}:00 · ${celda.valor}` },
      });
      if (celda.valor > 0 && m.maximo > 0) {
        nodo.style.setProperty('--intensidad', String(celda.valor / m.maximo));
      }
      rejilla.appendChild(nodo);
    }
    rejilla.appendChild(el('span', { clase: 'matriz-total num', texto: String(fila.total) }));
  }

  return el('section', { clase: 'bloque' }, [
    el('h2', { texto: titulo }),
    el('p', { clase: 'detalle', texto: 'Columnas: hora del día. Filas: lugar.' }),
    el('div', { clase: 'matriz-marco' }, [rejilla]),
  ]);
}

export function vistaStats(p: PropsStats): HTMLElement {
  const enRango = filtrarCanal(filtrarRango(ventasActivas(p.eventos), p.rango, p.ahora), p.canal);
  const ventas =
    p.vendedor === 'todos' ? enRango : enRango.filter((v) => v.vendor === p.vendedor);
  const soloUno = p.vendedor !== 'todos';

  return el('div', {}, [
    encabezado('Stats', `${totalPiezas(ventas)} piezas`),
    segmentado(
      [
        { valor: 'hoy' as const, etiqueta: 'Hoy' },
        { valor: '7d' as const, etiqueta: '7 dias' },
        { valor: 'todo' as const, etiqueta: 'Todo' },
      ],
      p.rango,
      p.alCambiarRango
    ),
    segmentado(
      [
        { valor: 'todos' as const, etiqueta: 'Ambos' },
        ...VENDEDORES.map((v) => ({ valor: v, etiqueta: v })),
      ],
      p.vendedor,
      p.alCambiarVendedor
    ),
    segmentado(
      [
        { valor: 'calle' as const, etiqueta: 'Calle' },
        { valor: 'todo' as const, etiqueta: 'Calle + mayoreo' },
      ],
      p.canal,
      p.alCambiarCanal
    ),
    el('div', { clase: 'separador' }),
    bloqueMatriz('Lugar × hora', porLugarYHora(ventas)),
    bloqueBarras('Por hora', porHora(ventas)),
    bloqueBarras('Por lugar', porPunto(ventas, p.ajustes.points)),
    soloUno ? null : bloqueBarras('Por vendedor', porVendedor(ventas)),
    bloqueBarras('Por dia (14)', porDia(ventas, p.ahora)),
  ]);
}

// ---------- vista: ajustes ----------

export type DatosRetro = {
  fecha: string;
  hora: string;
  punto: string;
  canal: Canal;
  vendedor: Vendedor;
  qty: number;
};

export function abrirRetro(
  ajustes: Settings,
  fecha: string,
  alConfirmar: (datos: DatosRetro) => void
): void {
  const modal = el('dialog', { attrs: { 'aria-label': 'Captura retroactiva' } });
  if (typeof modal.showModal !== 'function') {
    toast('Este navegador no soporta la captura retroactiva');
    return;
  }

  const retroFecha = entrada('date', fecha);
  const retroHora = entrada('time', '12:00');
  const retroPunto = selector(ajustes.points, ajustes.points[0] ?? '');
  const retroCanal = selector(['calle', 'mayoreo'], 'calle');
  const retroVendedor = selector(VENDEDORES, ajustes.defaultVendor);
  const retroQty = entrada('number', '1', { min: '1', step: '1', inputmode: 'numeric' });
  const cerrar = (): void => {
    modal.close();
    modal.remove();
  };

  modal.appendChild(
    el('div', {}, [
      el('h2', { texto: 'Captura retroactiva' }),
      el('p', { clase: 'detalle', texto: 'Para pasar lo anotado en libreta. Queda marcado RETRO.' }),
      campo('Fecha', retroFecha),
      campo('Hora', retroHora),
      campo('Lugar', retroPunto),
      campo('Canal', retroCanal),
      campo('Vendedor', retroVendedor),
      campo('Cantidad', retroQty),
      el('div', { clase: 'fila-botones' }, [
        boton('Cancelar', 'btn', cerrar),
        boton('Registrar', 'btn activo', () => {
          cerrar();
          alConfirmar({
            fecha: retroFecha.value,
            hora: retroHora.value,
            punto: retroPunto.value,
            canal: retroCanal.value as Canal,
            vendedor: retroVendedor.value as Vendedor,
            qty: Number(retroQty.value),
          });
        }),
      ]),
    ])
  );

  document.body.appendChild(modal);
  modal.addEventListener('cancel', () => modal.remove());
  modal.showModal();
}

export type DatosCargaRetro = {
  fecha: string;
  hora: string;
  vendedor: Vendedor;
  qty: number;
};

/** Misma forma que la venta retroactiva: para registrar una carga que ya ocurrio. */
export function abrirCargaRetro(
  ajustes: Settings,
  fecha: string,
  alConfirmar: (datos: DatosCargaRetro) => void
): void {
  const modal = el('dialog', { attrs: { 'aria-label': 'Carga retroactiva' } });
  if (typeof modal.showModal !== 'function') {
    toast('Este navegador no soporta la captura retroactiva');
    return;
  }

  const retroFecha = entrada('date', fecha);
  const retroHora = entrada('time', '07:00');
  const retroVendedor = selector(VENDEDORES, ajustes.defaultVendor);
  const retroQty = entrada('number', String(LOTES[0] ?? 18), {
    min: '1',
    step: '1',
    inputmode: 'numeric',
  });
  const cerrar = (): void => {
    modal.close();
    modal.remove();
  };

  modal.appendChild(
    el('div', {}, [
      el('h2', { texto: 'Carga retroactiva' }),
      el('p', { clase: 'detalle', texto: 'Para registrar una carga que ya salió y no se capturó.' }),
      campo('Fecha', retroFecha),
      campo('Hora', retroHora),
      campo('Vendedor', retroVendedor),
      campo('Piezas', retroQty),
      el(
        'div',
        { clase: 'fila-chica' },
        LOTES.map((n) =>
          boton(String(n), 'btn-chico acento', () => {
            retroQty.value = String(n);
          })
        )
      ),
      el('div', { clase: 'fila-botones' }, [
        boton('Cancelar', 'btn', cerrar),
        boton('Registrar', 'btn activo', () => {
          cerrar();
          alConfirmar({
            fecha: retroFecha.value,
            hora: retroHora.value,
            vendedor: retroVendedor.value as Vendedor,
            qty: Number(retroQty.value),
          });
        }),
      ]),
    ])
  );

  document.body.appendChild(modal);
  modal.addEventListener('cancel', () => modal.remove());
  modal.showModal();
}

// ---------- vista: corte de caja ----------

export type PropsCorte = {
  fecha: string;
  /** Calculado del registro de ventas. El corte solo lee: nunca toca un evento. */
  ingreso: Ingreso;
  precios: Precios;
  borrador: Borrador;
  /** El corte cerrado de esa fecha, si ya existe. Con esto la vista pasa a solo lectura. */
  cerrado: CorteCerrado | null;
  alCambiarFecha: (f: string) => void;
  alAgregarGasto: (concepto: string, monto: string) => void;
  alQuitarGasto: (id: string) => void;
  alCambiarReponer: (monto: string) => void;
  alCambiarPrecios: (calle: string, mayoreo: string) => void;
  alCerrar: (reponer: string) => void;
  alCopiar: () => void;
};

const ID_CONCEPTO = 'corte-concepto';

/** Devuelve el foco al concepto tras agregar un gasto: se capturan varios seguidos, sin volver a tocar. */
export function enfocarGasto(): void {
  document.getElementById(ID_CONCEPTO)?.focus();
}

function entradaMonto(valor: string, attrs: Record<string, string> = {}): HTMLInputElement {
  // type=text y no number: en el teclado en español el separador decimal es la coma, y un
  // input numerico la rechaza en silencio dejando el campo vacio.
  return entrada('text', valor, {
    inputmode: 'decimal',
    maxlength: '12',
    placeholder: '0.00',
    ...attrs,
  });
}

function lineaDinero(rotulo: string, centavos: number, clase = ''): HTMLElement {
  return el('div', { clase: `corte-linea${clase === '' ? '' : ` ${clase}`}` }, [
    el('span', { texto: rotulo }),
    el('span', { clase: 'num', texto: importe(centavos) }),
  ]);
}

function bloqueIngreso(ingreso: Ingreso, precios: Precios): HTMLElement {
  return el('section', { clase: 'bloque' }, [
    el('h2', { texto: 'Ingreso' }),
    el('p', { clase: 'detalle', texto: 'Sumado de las ventas registradas. Valídalo contra el efectivo.' }),
    lineaDinero(
      `Calle · ${ingreso.calle.piezas} × ${importe(precios.calle)}`,
      ingreso.calle.centavos
    ),
    lineaDinero(
      `Mayoreo · ${ingreso.mayoreo.piezas} × ${importe(precios.mayoreo)}`,
      ingreso.mayoreo.centavos
    ),
    lineaDinero('Total', ingreso.total, 'corte-total'),
  ]);
}

/** alQuitar null = corte cerrado: se listan igual pero sin manera de tocarlos. */
function listaGastos(
  gastos: readonly LineaGasto[],
  alQuitar: ((id: string) => void) | null
): HTMLElement[] {
  if (gastos.length === 0) return [el('p', { clase: 'vacio', texto: 'Sin gastos capturados.' })];
  return gastos.map((g) =>
    el('div', { clase: 'fila' }, [
      el('div', { clase: 'fila-datos' }, [
        el('span', { texto: g.concepto }),
        el('span', { clase: 'num', texto: importe(g.centavos) }),
      ]),
      alQuitar === null ? null : boton('Borrar', 'btn peligro', () => alQuitar(g.id)),
    ])
  );
}

function contenidoUtilidad(reparto: Reparto, fondo: { gasto: number; cambio: number }): Node[] {
  const total = fondo.gasto + fondo.cambio;
  return [
    el('h2', { texto: 'Utilidad' }),
    lineaDinero('Ingreso', reparto.ingreso),
    lineaDinero('Gastos', -reparto.gastos),
    reparto.reponerCaja === 0 ? null : lineaDinero('Reponer caja', -reparto.reponerCaja),
    reparto.ajustes === 0 ? null : lineaDinero('Ajustes', reparto.ajustes),
    lineaDinero('Utilidad', reparto.utilidad, 'corte-total'),
    el('div', { clase: 'corte-reparto' }, [
      el('div', { clase: 'corte-socio' }, [
        el('span', { clase: 'detalle', texto: 'Fran' }),
        el('span', { clase: 'corte-cifra num', texto: importe(reparto.fran) }),
      ]),
      el('div', { clase: 'corte-socio' }, [
        el('span', { clase: 'detalle', texto: 'Primo' }),
        el('span', { clase: 'corte-cifra num', texto: importe(reparto.primo) }),
      ]),
    ]),
    el('p', {
      clase: 'detalle num',
      texto:
        `Deja ${importe(total)} en la caja (${pesos(fondo.gasto)} gasto + ` +
        `${pesos(fondo.cambio)} cambio). Efectivo esperado al cerrar: ` +
        `${importe(efectivoEsperado(reparto, total))}.`,
    }),
  ].filter((n): n is HTMLElement => n !== null);
}

/** Corte ya cerrado: se pinta desde el snapshot guardado, nunca recalculando contra las ventas de hoy. */
function corteCerrado(c: CorteCerrado, alCopiar: () => void): HTMLElement {
  return el('div', {}, [
    el('div', { clase: 'corte-sello' }, [
      el('span', { clase: 'insignia', texto: 'CERRADO' }),
      el('span', { clase: 'detalle', texto: `a las ${horaMinuto(c.cerradoEn)}` }),
    ]),
    bloqueIngreso(c.ingreso, c.precios),
    el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Gastos' }),
      ...listaGastos(c.gastos, null),
      lineaDinero('Total', c.reparto.gastos, 'corte-total'),
    ]),
    el('section', { clase: 'bloque' }, contenidoUtilidad(c.reparto, c.fondo)),
    boton('Copiar resumen', 'btn bloque-completo', alCopiar),
    el('p', {
      clase: 'detalle espaciado',
      texto:
        'Un corte cerrado no se edita ni se borra. Si salió mal, se compensa en un corte futuro.',
    }),
  ]);
}

export function vistaCorte(p: PropsCorte): HTMLElement {
  const selectorFecha = entrada('date', p.fecha);
  selectorFecha.addEventListener('change', () => {
    if (selectorFecha.value !== '') p.alCambiarFecha(selectorFecha.value);
  });

  const cabecera = [
    encabezado('Corte', fechaLegible(p.fecha)),
    campo('Fecha', selectorFecha),
  ];

  if (p.cerrado !== null) {
    return el('div', {}, [...cabecera, corteCerrado(p.cerrado, p.alCopiar)]);
  }

  const concepto = entrada('text', '', {
    maxlength: '100',
    placeholder: 'Concepto',
    id: ID_CONCEPTO,
  });
  const monto = entradaMonto('');
  const agregar = (): void => {
    p.alAgregarGasto(concepto.value, monto.value);
  };
  for (const control of [concepto, monto]) {
    control.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter') agregar();
    });
  }

  const reponer = entradaMonto(p.borrador.reponerCaja === 0 ? '' : pesos(p.borrador.reponerCaja));
  reponer.addEventListener('change', () => p.alCambiarReponer(reponer.value));

  const fondo = { gasto: FONDO_GASTO, cambio: FONDO_CAMBIO };
  const bloqueUtilidad = el('section', { clase: 'bloque' });

  /**
   * Repinta solo este bloque mientras se teclea el monto a reponer. Un render completo por
   * tecla le quitaria el foco al campo; y esperar al blur dejaria la utilidad mintiendo.
   */
  const pintarUtilidad = (): void => {
    const centavos = centavosDesde(reponer.value) ?? 0;
    const reparto = calcularReparto(p.ingreso.total, p.borrador.gastos, centavos);
    limpiar(bloqueUtilidad);
    for (const nodo of contenidoUtilidad(reparto, fondo)) bloqueUtilidad.appendChild(nodo);
  };
  reponer.addEventListener('input', pintarUtilidad);
  pintarUtilidad();

  const precioCalle = entradaMonto(pesos(p.precios.calle));
  const precioMayoreo = entradaMonto(pesos(p.precios.mayoreo));
  const guardarPrecios = (): void => p.alCambiarPrecios(precioCalle.value, precioMayoreo.value);

  return el('div', {}, [
    ...cabecera,

    bloqueIngreso(p.ingreso, p.precios),

    el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Gastos' }),
      ...listaGastos(p.borrador.gastos, p.alQuitarGasto),
      lineaDinero(
        'Total',
        p.borrador.gastos.reduce((s, g) => s + g.centavos, 0),
        'corte-total'
      ),
      el('div', { clase: 'espaciado' }, [concepto]),
      el('div', { clase: 'fila-botones' }, [monto, boton('Agregar', 'btn', agregar)]),
    ]),

    el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Reponer caja' }),
      el('p', {
        clase: 'detalle',
        texto:
          `Solo si la caja quedó abajo de ${importe(FONDO_CAJA)}. Los fondos son rotatorios: ` +
          'el cambio ya viene dentro del efectivo del día, restarlo sería contarlo dos veces.',
      }),
      reponer,
    ]),

    bloqueUtilidad,

    boton('Cerrar corte', 'btn-venta', () => p.alCerrar(reponer.value)),
    el('p', {
      clase: 'detalle espaciado',
      texto: 'Cerrar guarda el corte como registro inmutable. No se puede deshacer.',
    }),

    el('div', { clase: 'separador' }),
    el('section', { clase: 'bloque' }, [
      el('h3', { texto: 'Precios por pieza' }),
      el('p', {
        clase: 'detalle',
        texto: 'Cada corte cerrado guarda el precio con el que se calculó; cambiarlo no mueve el pasado.',
      }),
      el('div', { clase: 'corte-precios' }, [
        campo('Calle', precioCalle),
        campo('Mayoreo', precioMayoreo),
      ]),
      boton('Guardar precios', 'btn bloque-completo', guardarPrecios),
    ]),
  ]);
}

export type PropsAjustes = {
  ajustes: Settings;
  totalEventos: number;
  /** Cuantos eventos guardo la migracion, o null si nunca hubo datos previos que respaldar. */
  eventosRespaldados: number | null;
  alAgregarPunto: (nombre: string) => void;
  alQuitarPunto: (nombre: string) => void;
  alCambiarVendedorDefecto: (v: Vendedor) => void;
  alExportar: () => void;
  alCompartir: () => void;
  alImportar: (archivo: File) => void;
  alDescargarRespaldo: () => void;
};

export function vistaAjustes(p: PropsAjustes): HTMLElement {
  const nuevoPunto = entrada('text', '', { maxlength: '100', placeholder: 'Nombre del lugar' });

  const listaPuntos = p.ajustes.points.map((punto) =>
    el('div', { clase: 'fila' }, [
      el('span', { texto: punto }),
      p.ajustes.points.length > 1
        ? boton('Quitar', 'btn peligro', () => p.alQuitarPunto(punto))
        : el('span', { clase: 'detalle', texto: 'unico lugar' }),
    ])
  );

  const archivo = entrada('file', '', { accept: 'application/json,.json' });
  archivo.addEventListener('change', () => {
    const elegido = archivo.files?.[0];
    if (elegido !== undefined) p.alImportar(elegido);
    archivo.value = '';
  });

  return el('div', {}, [
    encabezado('Ajustes', `${p.totalEventos} eventos`),

    el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Lugares' }),
      ...listaPuntos,
      el('div', { clase: 'fila-botones' }, [
        nuevoPunto,
        boton('Agregar', 'btn', () => {
          p.alAgregarPunto(nuevoPunto.value);
          nuevoPunto.value = '';
        }),
      ]),
      el('p', { clase: 'detalle', texto: 'Quitar un lugar no borra su historico.' }),
    ]),

    el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Vendedor por defecto' }),
      el('p', { clase: 'detalle', texto: 'Con cual abre la pantalla Vender al iniciar la app.' }),
      segmentado(
        VENDEDORES.map((v) => ({ valor: v, etiqueta: v })),
        p.ajustes.defaultVendor,
        p.alCambiarVendedorDefecto
      ),
    ]),

    el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Respaldo' }),
      el('div', { clase: 'fila-botones' }, [
        boton('Exportar JSON', 'btn', p.alExportar),
        boton('Compartir resumen', 'btn', p.alCompartir),
      ]),
      el('p', { clase: 'detalle', texto: 'Importar (no duplica lo que ya esta)' }),
      archivo,
      p.eventosRespaldados === null
        ? null
        : el('div', { clase: 'espaciado' }, [
            el('p', {
              clase: 'detalle num',
              texto: `Respaldo previo a las cargas: ${p.eventosRespaldados} eventos intactos.`,
            }),
            boton('Descargar respaldo previo', 'btn bloque-completo', p.alDescargarRespaldo),
          ]),
    ]),

    el('p', { clase: 'detalle', texto: `Dispositivo: ${p.ajustes.deviceId}` }),
  ]);
}
