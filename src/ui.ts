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
import { calcularReparto, efectivoEsperado, importe, pesos } from './corte';
import type {
  EstadoCaja,
  MovimientoCaja,
  PlanCaja,
  PlanSemana,
  SaldoSobre,
  Sobre,
  Tasas,
} from './caja';
import {
  NOMBRE_SOBRE,
  SIGNOS,
  SOBRES,
  SOBRES_SOCIOS,
  movimientosRecientes,
  planCaja,
  sobresEnDeuda,
} from './caja';
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

/**
 * El titulo de la pantalla, su dato de cabecera y —si la pantalla vive en la barra de abajo— el
 * boton que abre lo que no cabe ahi. La accion va al extremo derecho en todas por igual: si
 * cambiara de sitio segun la pantalla habria que buscarla cada vez.
 */
function encabezado(titulo: string, detalle: string, accion: HTMLElement | null = null): HTMLElement {
  return el('div', { clase: 'encabezado' }, [
    el('h1', { texto: titulo }),
    el('div', { clase: 'encabezado-fin' }, [
      detalle === '' ? null : el('span', { clase: 'detalle num', texto: detalle }),
      accion,
    ]),
  ]);
}

/**
 * Pantalla de consulta: no esta en la barra de abajo, asi que trae su propio camino de vuelta
 * al sitio del que se entro. Sin esto quedaria en un callejon sin salida.
 */
function encabezadoSecundario(titulo: string, detalle: string, alVolver: () => void): HTMLElement {
  return el('div', { clase: 'encabezado-secundario' }, [
    boton('‹ Volver', 'btn-texto btn-volver', alVolver),
    encabezado(titulo, detalle),
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

/** La hora de ahora en punto, HH:MM. Es el arranque bueno casi siempre; se teclea encima si no. */
function horaEnPunto(ahora: Date): string {
  return `${String(ahora.getHours()).padStart(2, '0')}:00`;
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

export type Vista = 'vender' | 'hoy' | 'caja' | 'corte' | 'stats' | 'ajustes';

/**
 * Lo que se toca todos los dias, y nada mas: vender en la calle, revisar el dia, el corte y la
 * caja. Cuatro botones de pulgar en el ancho de un telefono.
 */
const SECCIONES: readonly { valor: Vista; etiqueta: string }[] = [
  { valor: 'vender', etiqueta: 'Vender' },
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: 'corte', etiqueta: 'Corte' },
  { valor: 'caja', etiqueta: 'Caja' },
];

/**
 * Lo que se consulta de vez en cuando. Fuera de la barra a proposito: con seis destinos, cada
 * boton bajaba a ~80px y lo de una vez al mes pesaba lo mismo que lo de cada dia. Aqui se llega
 * en dos toques y la barra vuelve a decir lo que importa.
 */
const SECUNDARIAS: readonly { valor: Vista; etiqueta: string; detalle: string }[] = [
  { valor: 'stats', etiqueta: 'Stats', detalle: 'Lugar × hora, por día, por lugar y por vendedor' },
  { valor: 'ajustes', etiqueta: 'Ajustes', detalle: 'Lugares, vendedor por defecto y respaldo' },
];

export function pintarNav(contenedor: HTMLElement, activa: Vista, alCambiar: (v: Vista) => void): void {
  limpiar(contenedor);
  for (const s of SECCIONES) {
    const b = boton(s.etiqueta, `nav-btn${s.valor === activa ? ' activo' : ''}`, () => alCambiar(s.valor));
    b.setAttribute('aria-current', s.valor === activa ? 'page' : 'false');
    contenedor.appendChild(b);
  }
}

/** El menu del "⋯": las pantallas de consulta, con una linea que dice que hay en cada una. */
function abrirMenu(alIr: (v: Vista) => void): void {
  const modal = el('dialog', { attrs: { 'aria-label': 'Más' } });

  if (typeof modal.showModal !== 'function') {
    const respuesta = window.prompt('Ir a (stats / ajustes):', 'stats');
    const destino = SECUNDARIAS.find((s) => s.valor === respuesta?.trim().toLowerCase());
    if (destino !== undefined) alIr(destino.valor);
    return;
  }

  const cerrar = (): void => {
    modal.close();
    modal.remove();
  };

  // Cada opcion lleva su linea de que hay dentro: "Stats" y "Ajustes" a secas obligan a entrar
  // a ver, y el menu esta justo para no tener que entrar a ver.
  const opcion = (s: (typeof SECUNDARIAS)[number]): HTMLElement => {
    const irYCerrar = (): void => {
      cerrar();
      alIr(s.valor);
    };
    return el('button', { clase: 'menu-opcion', attrs: { type: 'button' }, onClick: irYCerrar }, [
      el('span', { clase: 'menu-titulo', texto: s.etiqueta }),
      el('span', { clase: 'detalle', texto: s.detalle }),
    ]);
  };

  modal.appendChild(
    el('div', {}, [
      el('h2', { texto: 'Más' }),
      el('div', { clase: 'lugares' }, SECUNDARIAS.map(opcion)),
      el('div', { clase: 'fila-botones' }, [boton('Cancelar', 'btn', cerrar)]),
    ])
  );

  document.body.appendChild(modal);
  modal.addEventListener('cancel', () => modal.remove());
  modal.showModal();
}

/** El "⋯" del encabezado. Va en las cuatro pantallas de la barra, siempre en el mismo rincon. */
function botonMenu(alIr: (v: Vista) => void): HTMLButtonElement {
  const b = boton('⋯', 'btn-mas', () => abrirMenu(alIr));
  b.setAttribute('aria-label', 'Más: Stats y Ajustes');
  b.setAttribute('aria-haspopup', 'dialog');
  return b;
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
  alCorregirLugar: () => void;
  alAbrirMayoreo: () => void;
  alAbrirCarga: (v: Vendedor) => void;
  alAbrirTraspaso: () => void;
  alIrA: (v: Vista) => void;
  /** La captura principal: lugar, hora de llegada y piezas de ese rato por vendedor. */
  alRegistrarHora: (datos: {
    punto: string;
    hora: string;
    piezas: Record<Vendedor, number>;
  }) => void;
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

  // Vender no tiene encabezado propio: esta barra pegada arriba hace de encabezado, asi que el
  // "⋯" va aqui, en el mismo extremo derecho que en las otras tres pantallas.
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
    botonMenu(p.alIrA),
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
    // Se toca en caliente, en la calle: el error de lugar se nota justo despues de registrar,
    // y mandarlo hasta la pestana Hoy a buscar el renglon garantiza que no se corrija nunca.
    el('div', { clase: 'punto-correccion' }, [
      boton('Estábamos en otro lugar', 'btn-texto', p.alCorregirLugar),
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

/**
 * La captura principal: donde estuvimos, a que hora llegamos y cuantas se fueron en ese rato.
 * Va arriba de todo porque es como se trabaja; tocar +1 por botella tiene friccion en la calle.
 *
 * La hora arranca en la de ahora redondeada hacia abajo, que casi siempre es la buena, y se
 * teclea encima cuando se captura un rato pasado.
 */
function bloqueHora(p: PropsVender): HTMLElement {
  const lugar = selector(p.ajustes.points, turnoActual(p.eventos, p.vendedor, p.hoy)?.point ?? p.ajustes.points[0] ?? '');
  const hora = entrada('time', horaEnPunto(p.ahora));
  const piezas = VENDEDORES.map((v) => ({
    vendedor: v,
    control: entrada('number', '', { min: '0', step: '1', inputmode: 'numeric', placeholder: '0' }),
  }));

  const registrar = (): void => {
    p.alRegistrarHora({
      punto: lugar.value,
      hora: hora.value,
      piezas: Object.fromEntries(
        piezas.map((c) => [c.vendedor, Number(c.control.value === '' ? '0' : c.control.value)])
      ) as Record<Vendedor, number>,
    });
    for (const c of piezas) c.control.value = '';
  };

  return el('section', { clase: 'bloque' }, [
    el('h2', { texto: '¿Dónde y a qué hora?' }),
    el('div', { clase: 'corte-precios' }, [campo('Lugar', lugar), campo('Llegamos', hora)]),
    el('p', { clase: 'detalle espaciado', texto: 'Piezas de ese rato' }),
    el(
      'div',
      { clase: 'corte-precios' },
      piezas.map((c) => campo(c.vendedor, c.control))
    ),
    boton('Registrar', 'btn-venta espaciado', registrar),
  ]);
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
    bloqueHora(p),
    resumenDeHoy(p),
    el('div', { clase: 'separador' }),
    // El conteo en vivo sigue disponible para el rato que se quiera contar botella por botella.
    el('p', { clase: 'detalle', texto: '¿Contar en vivo?' }),
    turno === null ? tarjetaSinLugar(p) : tarjetaTurno(p, turno),
    turno === null ? null : bloqueVenta(p, turno.punto),
    el('div', { clase: 'acciones-secundarias' }, [
      boton('Cargar hielera', 'btn-texto', () => p.alAbrirCarga(p.vendedor)),
      boton('Pasar botellas', 'btn-texto', p.alAbrirTraspaso),
      boton('Mayoreo', 'btn-texto', p.alAbrirMayoreo),
    ]),
  ]);
}

type PropsSelectorLugar = {
  titulo: string;
  texto: string;
  puntos: readonly string[];
  /** El lugar de ahora, marcado en la lista. Elegirlo otra vez no hace nada, y esta bien asi. */
  actual: string | null;
  alConfirmar: (punto: string) => void;
};

/** Una lista de lugares y ya: sirve para cambiarse de lugar y para corregir una venta suelta. */
function abrirSelectorLugar(p: PropsSelectorLugar): void {
  const modal = el('dialog', { attrs: { 'aria-label': p.titulo } });

  if (typeof modal.showModal !== 'function') {
    const respuesta = window.prompt(
      `${p.titulo} (${p.puntos.join(', ')}):`,
      p.actual ?? p.puntos[0] ?? ''
    );
    if (respuesta !== null && p.puntos.includes(respuesta)) p.alConfirmar(respuesta);
    return;
  }

  const cerrar = (): void => {
    modal.close();
    modal.remove();
  };

  modal.appendChild(
    el('div', {}, [
      el('h2', { texto: p.titulo }),
      el('p', { clase: 'detalle', texto: p.texto }),
      el(
        'div',
        { clase: 'lugares' },
        p.puntos.map((punto) =>
          boton(punto, `btn-lugar${punto === p.actual ? ' activo' : ''}`, () => {
            cerrar();
            p.alConfirmar(punto);
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

/** Cambiar de lugar es marcar uno nuevo: el turno anterior se cierra solo a esa hora. */
function abrirLugar(
  puntos: readonly string[],
  actual: string | null,
  alConfirmar: (punto: string) => void
): void {
  abrirSelectorLugar({
    titulo: 'Cambiar de lugar',
    texto: 'Desde este momento las ventas de los dos se acreditan al lugar nuevo.',
    puntos,
    actual,
    alConfirmar,
  });
}

/** Corregir una venta suelta que se fue al lugar equivocado. No cambia el turno ni el dinero. */
export function abrirMoverVenta(
  puntos: readonly string[],
  actual: string,
  alConfirmar: (punto: string) => void
): void {
  abrirSelectorLugar({
    titulo: '¿A qué lugar iba?',
    texto: `Está acreditada en ${actual}. Se anula y se vuelve a escribir con su misma hora en el lugar correcto.`,
    puntos,
    actual,
    alConfirmar,
  });
}

export type PlanCorreccion = {
  vendedores: readonly string[];
  piezas: number;
  ventasMovidas: number;
};

export type PropsCorregirLugar = {
  puntos: readonly string[];
  /** Donde dice el registro que estaban parados: sale marcado para que se vea el error. */
  actual: string | null;
  /** Hora inicial del campo, ya en HH:MM. */
  hora: string;
  /**
   * Las dos horas que se pueden poner de un toque. La etiqueta dice **que va a pasar** y el pie
   * desde cuando: un boton que solo dijera la hora obliga a deducir el efecto, y aqui el efecto
   * es cuantas piezas se mueven.
   */
  atajos: readonly { etiqueta: string; pie: string; hora: string }[];
  /** Que pasaria al confirmar con esos datos. null = con eso no hay nada que corregir. */
  alPrevisualizar: (punto: string, hora: string) => PlanCorreccion | null;
  alConfirmar: (punto: string, hora: string) => void;
};

function textoDelPlan(plan: PlanCorreccion, punto: string): string {
  const quienes = `${plan.vendedores.join(' y ')} ${plan.vendedores.length > 1 ? 'pasan' : 'pasa'} a ${punto}`;
  if (plan.piezas === 0) return `${quienes}. No hay ventas que reacreditar.`;
  const ventas = plan.ventasMovidas === 1 ? '1 venta' : `${plan.ventasMovidas} ventas`;
  return `${quienes} · se reacreditan ${ventas} (${plan.piezas} piezas).`;
}

/**
 * "Ya estabamos en otro lugar desde las HH:MM". Antes de escribir nada dice en voz alta cuantas
 * piezas va a mover: la correccion toca el historico de los dos y no se confirma a ciegas.
 */
export function abrirCorreccionLugar(p: PropsCorregirLugar): void {
  const modal = el('dialog', { attrs: { 'aria-label': 'Estaban en otro lugar' } });
  if (typeof modal.showModal !== 'function') {
    toast('Este navegador no soporta la correccion de lugar');
    return;
  }

  // Arranca en un lugar distinto al que trae mal: elegir el mismo no corrige nada.
  let elegido = p.puntos.find((x) => x !== p.actual) ?? p.puntos[0] ?? '';
  const hora = entrada('time', p.hora);
  const resumen = el('p', { clase: 'detalle' });
  const aceptar = boton('Corregir', 'btn activo', () => {
    const punto = elegido;
    const valor = hora.value;
    if (p.alPrevisualizar(punto, valor) === null) return;
    cerrar();
    p.alConfirmar(punto, valor);
  });

  const lugares = p.puntos.map((punto) =>
    boton(punto, 'btn-lugar', () => {
      elegido = punto;
      refrescar();
    })
  );

  const refrescar = (): void => {
    lugares.forEach((b, i) => b.classList.toggle('activo', p.puntos[i] === elegido));
    const plan = p.alPrevisualizar(elegido, hora.value);
    aceptar.disabled = plan === null;
    resumen.textContent =
      plan === null ? 'Con esos datos no hay nada que corregir.' : textoDelPlan(plan, elegido);
  };

  const cerrar = (): void => {
    modal.close();
    modal.remove();
  };

  hora.addEventListener('input', refrescar);
  hora.addEventListener('change', refrescar);
  refrescar();

  modal.appendChild(
    el('div', {}, [
      el('h2', { texto: 'Estaban en otro lugar' }),
      el('p', {
        clase: 'detalle',
        texto:
          p.actual === null
            ? 'Marca el lugar desde la hora en que llegaron.'
            : `El registro dice ${p.actual}. Marca dónde estaban de verdad y desde qué hora: las ventas de ahí en adelante se reacreditan solas.`,
      }),
      el('div', { clase: 'lugares' }, lugares),
      campo('Desde las', hora),
      p.atajos.length === 0
        ? null
        : el(
            'div',
            { clase: 'fila-chica' },
            p.atajos.map((a) =>
              el(
                'button',
                {
                  clase: 'btn-chico acento atajo',
                  attrs: { type: 'button' },
                  onClick: () => {
                    hora.value = a.hora;
                    refrescar();
                  },
                },
                [el('span', { texto: a.etiqueta }), el('span', { clase: 'detalle', texto: a.pie })]
              )
            )
          ),
      resumen,
      el('div', { clase: 'fila-botones' }, [boton('Cancelar', 'btn', cerrar), aceptar]),
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
  alMoverVenta: (id: string) => void;
  alCorregirLugar: () => void;
  alAbrirRetro: () => void;
  alAbrirCargaRetro: () => void;
  alIrA: (v: Vista) => void;
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
  if (v.movedFrom !== undefined) {
    marcas.push(el('span', { clase: 'insignia', texto: 'MOVIDA' }));
    marcas.push(el('span', { clase: 'detalle', texto: `antes en ${v.movedFrom}` }));
  }
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
              : el('div', { clase: 'fila-acciones' }, [
                  // Mover antes que Anular: casi siempre la venta si ocurrio y lo unico malo
                  // fue el lugar. Anularla y recapturarla a mano es la manera de perderla.
                  m.type === 'sale' ? boton('Mover', 'btn', () => p.alMoverVenta(m.id)) : null,
                  boton('Anular', 'btn peligro', () => p.alAnular(m.id)),
                ]),
          ]);
        });

  return el('div', {}, [
    encabezado(
      'Hoy',
      `${fechaLegible(p.fecha)} · ${totalPiezas(activas)} piezas`,
      botonMenu(p.alIrA)
    ),
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
      el('div', { clase: 'fila-botones' }, [
        boton('Estaban en otro lugar', 'btn', p.alCorregirLugar),
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
  alVolver: () => void;
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
    encabezadoSecundario('Stats', `${totalPiezas(ventas)} piezas`, p.alVolver),
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
  /**
   * Estado de la caja ahora mismo. El corte solo lo lee: necesita la deuda para armar el plan
   * del cierre. Moverla es cosa de la pestaña Caja.
   */
  caja: EstadoCaja;
  /**
   * Efectivo que traia la caja al EMPEZAR esta fecha, ya descontado lo que salio hoy sin gasto
   * detras. Es lo que se suma a la utilidad para contar el bulto; ver `cajaParaEsperado`.
   */
  cajaAlAbrir: number;
  /** Tasas de apartado. Tambien de solo lectura aqui; se editan en la pestaña Caja. */
  tasas: Tasas;
  alCambiarFecha: (f: string) => void;
  alAgregarGasto: (concepto: string, monto: string) => void;
  alQuitarGasto: (id: string) => void;
  alCambiarPrecios: (calle: string, mayoreo: string) => void;
  alCerrar: () => void;
  alCopiar: () => void;
  /** Lleva a la pestaña Caja desde el plan del cierre, sin buscar la barra de abajo. */
  alVerCaja: () => void;
  alIrA: (v: Vista) => void;
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

/**
 * Solo el resultado del dia: ingreso, gastos y la mitad de cada quien. Nada de la caja entra
 * aqui —ni fondos, ni apartados, ni reponer lo prestado—: eso es efectivo cambiando de sobre,
 * no dinero que el negocio gano o perdio, y restarlo cobraria el mismo gasto dos veces.
 */
/** Las dos cifras grandes: lo que le toca a cada quien. Se pintan una sola vez por pantalla. */
function tarjetasSocios(fran: number, primo: number): HTMLElement {
  return el('div', { clase: 'corte-reparto' }, [
    el('div', { clase: 'corte-socio' }, [
      el('span', { clase: 'detalle', texto: 'Lo tuyo' }),
      el('span', { clase: 'corte-cifra num', texto: importe(fran) }),
    ]),
    el('div', { clase: 'corte-socio' }, [
      el('span', { clase: 'detalle', texto: 'Primo' }),
      el('span', { clase: 'corte-cifra num', texto: importe(primo) }),
    ]),
  ]);
}

/**
 * El desglose completo en un solo bloque: del ingreso a lo que se lleva cada quien, restando
 * por el camino los gastos variables del dia y los fijos que se apartan.
 *
 * Antes esto vivia partido en dos —"Utilidad" y "Al cerrar"— y cada mitad pintaba su propio
 * reparto con numeros distintos: la de arriba partia la utilidad completa y la de abajo lo que
 * de verdad queda. Ver 103 y 103 arriba y 60.50 y 60.50 abajo no era redundante, era una de las
 * dos mintiendo.
 */
function contenidoUtilidad(
  reparto: Reparto,
  apartados: readonly { sobre: 'gasolina' | 'gas'; centavos: number }[],
  pie: HTMLElement | null
): Node[] {
  return [
    el('h2', { texto: 'Se reparte' }),
    lineaDinero('Ingreso', reparto.ingreso),
    lineaDinero('Gastos del día', -reparto.gastos),
    reparto.reponerCaja === 0 ? null : lineaDinero('Reponer caja', -reparto.reponerCaja),
    reparto.ajustes === 0 ? null : lineaDinero('Ajustes', reparto.ajustes),
    // Con el desglose por sobre cuando lo hay; el corte ya cerrado solo guardo el total.
    ...(apartados.length > 0
      ? apartados.map((a) => lineaDinero(NOMBRE_SOBRE[a.sobre], -a.centavos))
      : reparto.apartado === 0
        ? []
        : [lineaDinero('Gasolina y gas', -reparto.apartado)]),
    lineaDinero('Se reparte', reparto.repartible, 'corte-total'),
    tarjetasSocios(reparto.fran, reparto.primo),
    pie,
  ].filter((n): n is HTMLElement => n !== null);
}

// ---------- vista: caja ----------

/**
 * La caja tiene pestaña propia porque responde otra pregunta que el corte: no "cuanto ganamos
 * hoy" sino "donde esta el dinero y de quien es". Las dos pantallas se hablan por el estado de
 * la caja —el corte lee la deuda para armar el plan del cierre, y cerrar escribe el apartado
 * del dia y sella lo capturado— pero no comparten ni un formulario.
 */

/** Lo que teclea Fran. El tipo del movimiento no se pregunta: lo deduce el dominio del sobre. */
export type CapturaCaja = {
  sobre: Sobre;
  signo: 1 | -1;
  monto: string;
  concepto: string;
};

export type PropsCaja = {
  /** Estado de la caja ahora mismo, no al cierre: se repinta con cada movimiento. */
  caja: EstadoCaja;
  movimientos: readonly MovimientoCaja[];
  tasas: Tasas;
  /** Lo que pagaria cerrar la semana hoy. */
  semana: PlanSemana;
  alMover: (captura: CapturaCaja) => void;
  alEditar: (id: string, captura: CapturaCaja) => void;
  alBorrar: (id: string) => void;
  alArquear: (contado: string) => void;
  alCerrarSemana: () => void;
  /** Sacar de su sobre lo que un socio ya tiene ganado. */
  alCobrar: (sobre: Sobre) => void;
  alCambiarTasas: (gasolina: string, gas: string) => void;
  alCopiar: () => void;
  alIrA: (v: Vista) => void;
};

/**
 * Una linea de sobre: cuanto hay contra cuanto deberia haber, y lo que falta si falta. Los
 * sobres de los socios traen su boton de cobrar, porque ese dinero se saca, no se repone.
 */
function lineaSobre(s: SaldoSobre, alCobrar: ((sobre: Sobre) => void) | null): HTMLElement {
  const rotulo = el('span', {}, [
    document.createTextNode(NOMBRE_SOBRE[s.sobre]),
    s.deuda > 0
      ? el('span', { clase: 'detalle', texto: ` faltan ${importe(s.deuda)}` })
      : null,
  ]);
  const monto = el('span', {
    clase: 'num',
    texto: s.hay === s.objetivo ? importe(s.hay) : `${importe(s.hay)} / ${pesos(s.objetivo)}`,
  });
  const cobrable = alCobrar !== null && SOBRES_SOCIOS.includes(s.sobre) && s.hay > 0;
  return el('div', { clase: `corte-linea${s.deuda > 0 ? ' caja-corto' : ''}` }, [
    rotulo,
    cobrable
      ? el('span', { clase: 'fila-acciones' }, [
          monto,
          boton('Cobrar', 'btn', () => alCobrar(s.sobre)),
        ])
      : monto,
  ]);
}

/** El selector de sobre con los nombres largos, que es como Fran los llama en voz alta. */
function selectorSobre(inicial: Sobre): HTMLSelectElement {
  const control = selector([...SOBRES], inicial);
  const opciones = control.querySelectorAll('option');
  SOBRES.forEach((s, i) => {
    const opcion = opciones[i];
    if (opcion !== undefined) opcion.textContent = NOMBRE_SOBRE[s];
  });
  return control;
}

/**
 * Los tres campos de un movimiento y como leerlos. Los comparten la captura y la correccion
 * para que corregir un renglon se teclee exactamente igual que capturarlo: mismos campos,
 * mismos dos botones, mismo orden.
 */
function camposMovimiento(inicial: { sobre: Sobre; monto: string; concepto: string }): {
  nodos: HTMLElement[];
  leer: (signo: 1 | -1) => CapturaCaja;
  limpiar: () => void;
} {
  const sobre = selectorSobre(inicial.sobre);
  const monto = entradaMonto(inicial.monto);
  const concepto = entrada('text', inicial.concepto, {
    maxlength: '100',
    placeholder: 'Concepto (insumos…)',
  });
  return {
    nodos: [campo('Sobre', sobre), campo('Cantidad', monto), campo('Concepto', concepto)],
    leer: (signo) => ({
      sobre: sobre.value as Sobre,
      signo,
      monto: monto.value,
      concepto: concepto.value,
    }),
    limpiar: () => {
      monto.value = '';
      concepto.value = '';
    },
  };
}

/**
 * Los dos botones que cierran la captura. El signo lo pone el boton y nunca el teclado: a las
 * once de la noche un menos de mas descuadra la caja y el error no se ve hasta el sabado.
 */
function botonesDeSigno(alElegir: (signo: 1 | -1) => void): HTMLElement {
  return el(
    'div',
    { clase: 'caja-acciones' },
    SIGNOS.map((s) => boton(s.etiqueta, `btn ${s.signo > 0 ? 'caja-entra' : 'caja-sale'}`, () => alElegir(s.signo)))
  );
}

function capturaCaja(alMover: (captura: CapturaCaja) => void): HTMLElement {
  const campos = camposMovimiento({ sobre: 'gasolina', monto: '', concepto: '' });
  return el('div', {}, [
    ...campos.nodos,
    botonesDeSigno((signo) => {
      alMover(campos.leer(signo));
      campos.limpiar();
    }),
  ]);
}

/**
 * Corregir un movimiento que todavia no ha pasado por un cierre. Va en modal y no en el renglon
 * para no partir la lista en dos maneras distintas de teclear lo mismo.
 */
function abrirEdicionCaja(m: MovimientoCaja, alGuardar: (captura: CapturaCaja) => void): void {
  const modal = el('dialog', { attrs: { 'aria-label': 'Corregir movimiento' } });

  if (typeof modal.showModal !== 'function') {
    const respuesta = window.prompt('Cantidad (con menos adelante si salió):', pesos(m.centavos));
    if (respuesta === null) return;
    const negativo = respuesta.trim().startsWith('-');
    alGuardar({
      sobre: m.sobre,
      signo: negativo ? -1 : 1,
      monto: respuesta.replace('-', ''),
      concepto: m.concepto,
    });
    return;
  }

  const cerrar = (): void => {
    modal.close();
    modal.remove();
  };
  const campos = camposMovimiento({
    sobre: m.sobre,
    monto: pesos(Math.abs(m.centavos)),
    concepto: m.concepto,
  });

  modal.appendChild(
    el('div', {}, [
      el('h2', { texto: 'Corregir movimiento' }),
      el('p', {
        clase: 'detalle',
        texto: `Capturado a las ${horaMinuto(m.ts)}. Se puede corregir porque el corte de ese día sigue abierto.`,
      }),
      ...campos.nodos,
      botonesDeSigno((signo) => {
        cerrar();
        alGuardar(campos.leer(signo));
      }),
      el('div', { clase: 'fila-botones espaciado' }, [boton('Cancelar', 'btn', cerrar)]),
    ])
  );

  document.body.appendChild(modal);
  modal.addEventListener('cancel', () => modal.remove());
  modal.showModal();
}

/**
 * Los movimientos del mas reciente al mas viejo. Los abiertos traen sus botones; los sellados
 * se leen igual pero ya no se tocan, y esa diferencia a la vista es la que dice que ese dia ya
 * quedo cerrado.
 */
function historialCaja(
  movimientos: readonly MovimientoCaja[],
  alEditar: (m: MovimientoCaja) => void,
  alBorrar: (id: string) => void
): HTMLElement[] {
  const recientes = movimientosRecientes(movimientos, 20);
  if (recientes.length === 0) {
    return [el('p', { clase: 'vacio', texto: 'Sin movimientos todavía.' })];
  }
  return recientes.map((m) =>
    el('div', { clase: 'fila' }, [
      el('div', { clase: 'fila-datos' }, [
        el('span', { texto: `${NOMBRE_SOBRE[m.sobre]} · ${m.concepto}` }),
        el('span', { clase: 'num', texto: importe(m.centavos) }),
        el('span', { clase: 'detalle', texto: horaMinuto(m.ts) }),
      ]),
      m.abierto !== true
        ? null
        : el('div', { clase: 'fila-acciones' }, [
            boton('Editar', 'btn', () => alEditar(m)),
            boton('Borrar', 'btn peligro', () => alBorrar(m.id)),
          ]),
    ])
  );
}

/** Contar el bulto contra el libro. Lo que se teclea es un conteo, no una correccion. */
function bloqueArqueo(caja: EstadoCaja, alArquear: (contado: string) => void): HTMLElement {
  const contado = entradaMonto('');
  return el('section', { clase: 'bloque' }, [
    el('h2', { texto: 'Arqueo' }),
    el('p', {
      clase: 'detalle',
      texto:
        'Cuenta el efectivo y captura lo que traes. Si no cuadra te dice cuánto falta y tú ' +
        'decides si lo ajustas: nada se reescribe solo.',
    }),
    lineaDinero('La caja dice', caja.hay),
    campo('Contado', contado),
    boton('Comparar', 'btn bloque-completo espaciado', () => alArquear(contado.value)),
  ]);
}

/**
 * El domingo. Va en la caja y no en el corte porque no es resultado: es el efectivo apartado
 * saliendo hacia donde siempre estuvo destinado.
 */
function bloqueSemana(plan: PlanSemana, alCerrar: () => void): HTMLElement {
  return el('section', { clase: 'bloque' }, [
    el('h2', { texto: 'Cierre semanal' }),
    el('p', {
      clase: 'detalle',
      texto:
        'El domingo: se carga gasolina, se le paga el gas a Mamá Juani y su sueldo a Primo. ' +
        'Se paga lo que hay en cada sobre y quedan en cero.',
    }),
    ...plan.pagos.map((pago) => lineaDinero(NOMBRE_SOBRE[pago.sobre], pago.centavos)),
    plan.pagos.length === 0
      ? el('p', { clase: 'vacio', texto: 'No hay nada apartado todavía.' })
      : lineaDinero('Total a pagar', plan.total, 'corte-total'),
    plan.deuda === 0
      ? null
      : el('p', {
          clase: 'aviso num',
          texto:
            `La caja sigue debiendo ${importe(plan.deuda)}. No se repone aquí: ` +
            'cada corte del día abona lo que alcance.',
        }),
    plan.total === 0
      ? null
      : boton('Cerrar semana', 'btn bloque-completo espaciado', alCerrar),
  ]);
}

export function vistaCaja(p: PropsCaja): HTMLElement {
  const faltantes = sobresEnDeuda(p.caja);
  const tasaGasolina = entradaMonto(pesos(p.tasas.gasolina));
  const tasaGas = entradaMonto(pesos(p.tasas.gas));

  return el('div', {}, [
    // La frase va debajo y no de dato de cabecera: es una linea entera, y apretada contra el
    // titulo en una fila de flex se parte donde le toca, no donde se lee.
    encabezado('Caja', '', botonMenu(p.alIrA)),
    el('p', { clase: 'detalle encabezado-nota', texto: 'Dónde está el dinero, no cuánto ganamos.' }),

    el('section', { clase: 'bloque' }, [
      ...p.caja.sobres.map((s) => lineaSobre(s, p.alCobrar)),
      lineaDinero('Efectivo en la caja', p.caja.hay, 'corte-total'),
      faltantes.length === 0
        ? el('p', { clase: 'detalle', texto: 'La caja está al corriente.' })
        : el('p', {
            clase: 'aviso num',
            texto:
              `Debes a la caja ${importe(p.caja.deuda)}: ` +
              faltantes.map((s) => `${NOMBRE_SOBRE[s.sobre]} ${importe(s.deuda)}`).join(' · '),
          }),
      // Lo que se le manda a Primo el sabado: cuanto lleva acumulado y como esta la caja.
      boton('Copiar caja', 'btn bloque-completo espaciado', p.alCopiar),
    ]),

    el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Registrar movimiento' }),
      el('p', {
        clase: 'detalle',
        texto:
          'Sacar de cualquier sobre queda como deuda hasta que lo devuelvas — del fondo o de ' +
          'la gasolina, da igual. Pagar la gasolina y el sueldo es el cierre del domingo, no ' +
          'esto. Nada de aquí toca la utilidad.',
      }),
      capturaCaja(p.alMover),
    ]),

    bloqueArqueo(p.caja, p.alArquear),

    bloqueSemana(p.semana, p.alCerrarSemana),

    el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Movimientos' }),
      el('p', {
        clase: 'detalle',
        texto: 'Lo de hoy se corrige y se borra hasta que cierres el corte. Después queda sellado.',
      }),
      ...historialCaja(
        p.movimientos,
        (m) => abrirEdicionCaja(m, (captura) => p.alEditar(m.id, captura)),
        p.alBorrar
      ),
    ]),

    el('div', { clase: 'separador' }),
    el('section', { clase: 'bloque' }, [
      el('h3', { texto: 'Apartado por día de venta' }),
      el('p', {
        clase: 'detalle',
        texto:
          'Lo que se guarda en la caja cada día que se vende, al cerrar el corte. No es gasto: ' +
          'el gasto entra el día que se paga la gasolina o el gas.',
      }),
      el('div', { clase: 'corte-precios' }, [
        campo('Gasolina', tasaGasolina),
        campo('Gas (Mamá Juani)', tasaGas),
      ]),
      boton('Guardar apartado', 'btn bloque-completo', () =>
        p.alCambiarTasas(tasaGasolina.value, tasaGas.value)
      ),
    ]),
  ]);
}

// ---------- vista: corte ----------

/**
 * Solo el conteo del efectivo. El reparto ya lo pinto el bloque de arriba y no se repite: dos
 * veces la misma cifra invita a que se separen, y separadas una de las dos miente.
 */
function bloqueCierre(
  plan: PlanCaja,
  cajaAlAbrir: number,
  reparto: Reparto,
  alVerCaja: () => void
): HTMLElement {
  return el('section', { clase: 'bloque' }, [
    el('h2', { texto: 'Al cerrar' }),
    lineaDinero('Efectivo esperado', efectivoEsperado(reparto, cajaAlAbrir)),
    el('p', {
      clase: 'detalle',
      // Al ABRIR, no ahora: lo que se tomo prestado hoy ya va dentro del gasto que se pago con
      // ello, y restarlo tambien del saldo lo cobraria dos veces contra el bulto.
      texto:
        'Cuenta el bulto y compáralo: lo que traía la caja al empezar el día más la utilidad. ' +
        'Cada mitad se va a su sobre y cobras de ahí cuando quieras.',
    }),
    plan.deuda === 0
      ? null
      : el('p', {
          clase: 'detalle num',
          texto:
            `La caja trae ${importe(plan.deuda)} prestados. No se cobran aquí: el gasto que ` +
            'los generó ya bajó la utilidad de los dos.',
        }),
    // El plan sale de como esta la caja: si algo de esto no cuadra, se arregla alla, no aqui.
    boton('Ver la caja', 'btn bloque-completo espaciado', alVerCaja),
  ]);
}

/**
 * Como quedo la caja segun el corte, leido de su snapshot. Los cortes cerrados antes de los
 * sobres no lo traen: de esos solo se sabe el fondo teorico que se guardo entonces.
 */
function pieCajaCerrada(c: CorteCerrado): HTMLElement {
  if (c.caja === null) {
    const total = c.fondo.gasto + c.fondo.cambio;
    return el('p', {
      clase: 'detalle num',
      texto:
        `Deja ${importe(total)} en la caja (${pesos(c.fondo.gasto)} gasto + ` +
        `${pesos(c.fondo.cambio)} cambio). Efectivo esperado al cerrar: ` +
        `${importe(efectivoEsperado(c.reparto, total))}.`,
    });
  }
  const deuda =
    c.caja.deuda > 0 ? ` Quedaron debiendo ${importe(c.caja.deuda)} a la caja.` : '';
  return el('p', {
    clase: 'detalle num',
    texto: `Quedaron ${importe(c.caja.hay)} en la caja.${deuda}`,
  });
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
    el('section', { clase: 'bloque' }, contenidoUtilidad(c.reparto, [], pieCajaCerrada(c))),
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
    encabezado('Corte', fechaLegible(p.fecha), botonMenu(p.alIrA)),
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

  // El apartado sale de la utilidad, y el reparto sale de lo que queda despues del apartado:
  // por eso son dos pasadas y no una. La segunda es la que se pinta y la que se guarda.
  const utilidadSola = calcularReparto(p.ingreso.total, p.borrador.gastos);
  const plan = planCaja({
    utilidad: utilidadSola.utilidad,
    deuda: p.caja.deuda,
    tasas: p.tasas,
    huboVentas: p.ingreso.total > 0,
  });
  const reparto = calcularReparto(
    p.ingreso.total,
    p.borrador.gastos,
    [],
    plan.totalApartado
  );

  const precioCalle = entradaMonto(pesos(p.precios.calle));
  const precioMayoreo = entradaMonto(pesos(p.precios.mayoreo));
  const guardarPrecios = (): void => p.alCambiarPrecios(precioCalle.value, precioMayoreo.value);

  return el('div', {}, [
    ...cabecera,

    bloqueIngreso(p.ingreso, p.precios),

    el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Gastos' }),
      el('p', {
        clase: 'detalle',
        texto:
          'El efectivo se descuenta solo de la caja: primero del fondo y, si no alcanza, de lo ' +
          'apartado para gasolina. Borrar un gasto se lo devuelve.',
      }),
      ...listaGastos(p.borrador.gastos, p.alQuitarGasto),
      lineaDinero(
        'Total',
        p.borrador.gastos.reduce((s, g) => s + g.centavos, 0),
        'corte-total'
      ),
      el('div', { clase: 'espaciado' }, [concepto]),
      el('div', { clase: 'fila-botones' }, [monto, boton('Agregar', 'btn', agregar)]),
    ]),

    el('section', { clase: 'bloque' }, contenidoUtilidad(reparto, plan.apartados, null)),

    bloqueCierre(plan, p.cajaAlAbrir, reparto, p.alVerCaja),

    boton('Cerrar corte', 'btn-venta', p.alCerrar),
    el('p', {
      clase: 'detalle espaciado',
      texto:
        'Cerrar guarda el corte como registro inmutable, aparta lo del día en la caja y sella ' +
        'los movimientos que quedaban abiertos. No se puede deshacer.',
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
  alVolver: () => void;
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
    encabezadoSecundario('Ajustes', `${p.totalEventos} eventos`, p.alVolver),

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
