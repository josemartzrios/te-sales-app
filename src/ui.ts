import type { AppEvent, Canal, LoadEvent, SaleEvent, Settings, Vendedor } from './tipos';
import type { Barra, Hielera, PanelVendedor, Rango } from './dominio';
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
  ordenarPorHora,
  panelesDelDia,
  porDia,
  porHora,
  porPunto,
  porVendedor,
  totalDelDia,
  totalPiezas,
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

export type Vista = 'vender' | 'hoy' | 'stats' | 'ajustes';

const SECCIONES: readonly { valor: Vista; etiqueta: string }[] = [
  { valor: 'vender', etiqueta: 'Vender' },
  { valor: 'hoy', etiqueta: 'Hoy' },
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
  alCambiarVendedor: (v: Vendedor) => void;
  alVender: (punto: string, qty: number) => void;
  alRestar: (punto: string) => void;
  alAbrirMayoreo: () => void;
  alAbrirCarga: (v: Vendedor) => void;
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

/** El corazon de la pantalla: nombre, contador y botones. Solo los botones registran. */
function bloquePunto(p: PropsVender, punto: string): HTMLElement {
  const calle = totalDelDia(p.eventos, p.hoy, punto, 'calle');
  const mayoreo = totalDelDia(p.eventos, p.hoy, punto, 'mayoreo');

  // Sin texto del vendedor adentro: ya esta en la barra, y el pulgar tapa medio boton.
  const botonPrincipal = boton('+1', 'btn-venta', () => p.alVender(punto, 1));
  botonPrincipal.setAttribute('aria-label', `Registrar una venta en ${punto}`);

  const hayQueAnular = ultimaVentaActiva(p.eventos, punto, p.hoy) !== null;
  const botonRestar = boton('−1', 'btn-chico peligro', () => p.alRestar(punto));
  botonRestar.disabled = !hayQueAnular;
  botonRestar.setAttribute('aria-label', `Anular la última venta en ${punto}`);

  return el('section', { clase: 'punto' }, [
    el('div', { clase: 'punto-nombre' }, [
      el('h2', { texto: punto }),
      el('span', { clase: 'conteo num', texto: String(calle) }),
    ]),
    mayoreo > 0 ? el('p', { clase: 'detalle num punto-pie', texto: `mayoreo hoy ${mayoreo}` }) : null,
    botonPrincipal,
    el('div', { clase: 'fila-chica' }, [
      boton('+2', 'btn-chico acento', () => p.alVender(punto, 2)),
      boton('+3', 'btn-chico acento', () => p.alVender(punto, 3)),
      botonRestar,
    ]),
  ]);
}

export function vistaVender(p: PropsVender): HTMLElement {
  return el('div', { clase: 'pantalla-vender' }, [
    el('h1', { clase: 'solo-lectores', texto: 'Vender' }),
    barraEstado(p),
    el('div', { clase: 'puntos' }, p.ajustes.points.map((punto) => bloquePunto(p, punto))),
    el('div', { clase: 'acciones-secundarias' }, [
      boton('Cargar hielera', 'btn-texto', () => p.alAbrirCarga(p.vendedor)),
      boton('Mayoreo', 'btn-texto', p.alAbrirMayoreo),
    ]),
  ]);
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
      el('p', { clase: 'detalle', texto: 'Solo cantidad; el precio se resuelve fuera de esta app.' }),
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
  alCambiarFecha: (f: string) => void;
  alAnular: (id: string) => void;
  alAbrirRetro: () => void;
  alAbrirCargaRetro: () => void;
};

/** Linea de verificacion, no formulario: cargadas = vendidas + restantes, por vendedor. */
function lineaCuadre(h: Hielera): HTMLElement {
  const sinMovimiento = h.cargado === 0 && h.vendido === 0;
  const bien = h.cuadra && h.restante >= 0;

  return el('div', { clase: 'cuadre-fila' }, [
    el('span', { clase: 'cuadre-vendedor', texto: h.vendedor }),
    sinMovimiento
      ? el('span', { clase: 'detalle', texto: 'sin movimientos' })
      : el('span', { clase: 'cuadre-cuentas num' }, [
          el('span', { texto: `Cargó ${h.cargado}` }),
          el('span', { clase: 'detalle', texto: ' · ' }),
          el('span', { texto: `Vendió ${h.vendido}` }),
          el('span', { clase: 'detalle', texto: ' · ' }),
          el('span', {
            clase: h.restante < 0 ? 'negativo' : '',
            texto: `En hielera ${h.restante}`,
          }),
        ]),
    sinMovimiento
      ? null
      : el('span', {
          clase: `cuadre-marca ${bien ? 'ok' : 'alerta'}`,
          texto: bien ? '✓' : '!',
          attrs: { 'aria-label': bien ? 'cuadra' : 'no cuadra' },
        }),
  ]);
}

function bloqueCuadre(eventos: readonly AppEvent[], fecha: string): HTMLElement {
  const delDia = hieleras(eventos, fecha);
  const faltantes = delDia.filter((h) => h.restante < 0);

  return el('section', { clase: 'bloque' }, [
    el('h2', { texto: 'Cuadre del día' }),
    el('p', { clase: 'detalle', texto: 'Cargadas = vendidas + restantes.' }),
    ...delDia.map(lineaCuadre),
    faltantes.length === 0
      ? null
      : el('p', {
          clase: 'aviso',
          texto: `${faltantes
            .map((h) => `${h.vendedor} vendió ${-h.restante} más de lo cargado`)
            .join(' · ')}: falta registrar una carga.`,
        }),
  ]);
}

function insignias(v: SaleEvent): HTMLElement[] {
  const marcas: HTMLElement[] = [];
  if (v.channel === 'mayoreo') marcas.push(el('span', { clase: 'insignia', texto: 'MAYOREO' }));
  if (v.retro === true) marcas.push(el('span', { clase: 'insignia', texto: 'RETRO' }));
  return marcas;
}

/** Una cifra grande con su rotulo: el tablero se lee de un vistazo, sin interpretar barras. */
function metrica(rotulo: string, valor: string, pie: string, clase = ''): HTMLElement {
  return el('div', { clase: `metrica${clase === '' ? '' : ` ${clase}`}` }, [
    el('span', { clase: 'detalle metrica-rotulo', texto: rotulo }),
    el('span', { clase: 'metrica-cifra num', texto: valor }),
    el('span', { clase: 'detalle metrica-pie num', texto: pie }),
  ]);
}

function panelDelVendedor(panel: PanelVendedor): HTMLElement {
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
        h.sinCarga ? 'sin carga registrada' : `de ${h.cargado} cargados`,
        !h.sinCarga && h.restante <= HIELERA_BAJA ? 'alerta' : ''
      ),
      metrica('Vendió', String(h.vendido), 'piezas'),
      metrica(
        'Ritmo',
        r.porHora > 0 ? `${r.porHora}` : '—',
        r.porHora > 0 ? `por hora · en ${duracionLegible(r.minutos)}` : 'por hora'
      ),
    ]),
    h.restante < 0
      ? el('p', {
          clase: 'aviso',
          texto: `Vendió ${-h.restante} más de lo cargado: falta registrar una carga.`,
        })
      : null,
    lugar,
    vendioAlgo ? bloqueBarras('Por lugar', panel.porPunto, true) : null,
    vendioAlgo ? bloqueBarras('Por hora', panel.porHora, true) : null,
  ]);
}

export function vistaHoy(p: PropsHoy): HTMLElement {
  const ventas = ventasDeFecha(p.eventos, p.fecha);
  const cargas = cargasDeFecha(p.eventos, p.fecha);
  const anulados = idsAnulados(p.eventos);
  const activas = ventas.filter((v) => !anulados.has(v.id));
  const paneles = panelesDelDia(p.eventos, p.fecha, p.ajustes.points);

  const selectorFecha = entrada('date', p.fecha);
  selectorFecha.addEventListener('change', () => {
    if (selectorFecha.value !== '') p.alCambiarFecha(selectorFecha.value);
  });

  const movimientos = ordenarPorHora<SaleEvent | LoadEvent>([...ventas, ...cargas]);
  const filas =
    movimientos.length === 0
      ? [el('p', { clase: 'vacio', texto: 'Sin registros en esta fecha.' })]
      : movimientos.map((m) => {
          const anulada = anulados.has(m.id);
          const datos =
            m.type === 'load'
              ? [
                  el('span', { clase: 'num', texto: horaMinuto(m.ts) }),
                  el('span', { clase: 'insignia', texto: 'CARGA' }),
                  el('span', { clase: 'detalle', texto: m.vendor }),
                  el('span', { clase: 'num', texto: `×${m.qty}` }),
                ]
              : [
                  el('span', { clase: 'num', texto: horaMinuto(m.ts) }),
                  el('span', { texto: m.point }),
                  el('span', { clase: 'detalle', texto: m.vendor }),
                  el('span', { clase: 'num', texto: `×${m.qty}` }),
                  ...insignias(m),
                ];
          return el('div', { clase: `fila${anulada ? ' anulada' : ''}` }, [
            el('div', { clase: 'fila-datos' }, datos),
            anulada
              ? el('span', { clase: 'detalle', texto: 'anulada' })
              : boton('Anular', 'btn peligro', () => p.alAnular(m.id)),
          ]);
        });

  return el('div', {}, [
    encabezado('Hoy', `${fechaLegible(p.fecha)} · ${totalPiezas(activas)} piezas`),
    campo('Fecha', selectorFecha),
    ...paneles.map(panelDelVendedor),
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
