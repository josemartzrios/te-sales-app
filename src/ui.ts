import type {
  AppEvent,
  Canal,
  LoadEvent,
  Producto,
  SaleEvent,
  Settings,
  ShiftEvent,
  TransferEvent,
  Vendedor,
} from './tipos';
import type { Barra, Hielera, Matriz, PanelVendedor, Rango, Turno } from './dominio';
import type {
  Apartado,
  Borrador,
  CorteCerrado,
  Ingreso,
  LineaGasto,
  Precios,
  Reparto,
} from './corte';
import { calcularReparto, efectivoEsperado, importe, pesos } from './corte';
import type {
  EstadoCaja,
  MovimientoCaja,
  PlanCaja,
  PlanSemana,
  SaldoSobre,
  Sobre,
} from './caja';
import {
  NOMBRE_SOBRE,
  SIGNOS,
  SOBRES,
  SOBRES_DE_GASTO,
  SOBRES_SOCIOS,
  movimientosRecientes,
  planCaja,
  sobresEnDeuda,
  sobresVisibles,
} from './caja';
import {
  HIELERA_BAJA,
  HIELERA_CRITICA,
  PRODUCTOS,
  VENDEDORES_ACTIVOS,
  VENDEDOR_ACTIVO,
  cargasDeFecha,
  claveFecha,
  duracionLegible,
  fechaLegible,
  hieleraDe,
  hieleras,
  vendedoresDelDia,
  horaMinuto,
  idsAnulados,
  filtrarCanal,
  filtrarProducto,
  filtrarRango,
  jornada,
  ordenarPorHora,
  panelesDelDia,
  porDia,
  porHora,
  porLugarYHora,
  porPunto,
  porVendedor,
  totalDelDia,
  totalPiezas,
  traspasosDeFecha,
  turnoActual,
  turnosDeFecha,
  ultimaVentaActiva,
  ventasActivas,
  ventasDeFecha,
} from './dominio';
import { boton, campo, el, entrada, selector } from './dom';
import type { PropsConteo } from './vender';
import { NOMBRE_PRODUCTO, bloqueConteo, insigniaDeProducto } from './vender';

// Toda la escritura de texto pasa por textContent (ver dom.ts): nunca innerHTML con datos del
// usuario.

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
  { valor: 'stats', etiqueta: 'Stats', detalle: 'Lugar × hora, por día, por lugar y por producto' },
  { valor: 'ajustes', etiqueta: 'Ajustes', detalle: 'Lugares y respaldo' },
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
  hoy: string;
  ahora: Date;
  alVender: (punto: string, qty: number) => void;
  alRestar: (punto: string) => void;
  alMarcarLugar: (punto: string) => void;
  alCorregirLugar: () => void;
  alAbrirMayoreo: () => void;
  alAbrirCarga: () => void;
  alIrA: (v: Vista) => void;
  /**
   * La captura principal: lugar, hora de llegada y lo que QUEDA en la hielera de cada producto
   * al cerrar el rato. null en un producto = no lo conto, y a ese no se le registra nada.
   */
  alRegistrarHora: PropsConteo['alRegistrar'];
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

/**
 * Lo que queda en la hielera y lo vendido hoy, en una linea. El resto es para vender.
 *
 * "Hielera" y "Hoy" hablan de botellas las dos: sumar litros a "Hoy" mezclaria tamanos y la
 * cifra no cuadraria contra la hielera de al lado. Los litros salen en su propio dato, y solo
 * el dia que se vendieron.
 */
function barraEstado(p: PropsVender): HTMLElement {
  const h = hieleraDe(p.eventos, VENDEDOR_ACTIVO, p.hoy);
  const deHoy = ventasActivas(p.eventos).filter((v) => claveFecha(v.ts) === p.hoy);
  const vendidoHoy = totalPiezas(filtrarProducto(deHoy, 'botella'));
  const litrosHoy = totalPiezas(filtrarProducto(deHoy, 'litro'));

  // Sin cargas ni ventas todavia el restante no significa nada: mejor un guion que un 0 rojo.
  const enBlanco = h.sinCarga && h.vendido === 0;
  const critico = !enBlanco && h.restante <= HIELERA_CRITICA;

  const cifraHielera = el('span', {
    clase: `barra-cifra num${critico ? ' critico' : ''}`,
    texto: enBlanco ? '—' : String(h.restante),
    attrs: { id: ID_HIELERA },
  });

  // Vender no tiene encabezado propio: esta barra pegada arriba hace de encabezado, asi que el
  // "⋯" va aqui, en el mismo extremo derecho que en las otras tres pantallas.
  return el('div', { clase: 'barra-estado' }, [
    el('div', { clase: 'barra-datos' }, [
      el('span', { clase: 'barra-dato' }, [
        el('span', { clase: 'detalle', texto: 'Hielera ' }),
        cifraHielera,
      ]),
      el('span', { clase: 'barra-dato' }, [
        el('span', { clase: 'detalle', texto: 'Hoy ' }),
        el('span', { clase: 'barra-cifra num', texto: String(vendidoHoy) }),
      ]),
      litrosHoy === 0
        ? null
        : el('span', { clase: 'barra-dato' }, [
            el('span', { clase: 'detalle', texto: 'Litros ' }),
            el('span', { clase: 'barra-cifra num', texto: String(litrosHoy) }),
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
      texto: 'Marca el lugar una vez: abre el turno y ahí se acredita todo.',
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

  const botonPrincipal = boton('+1', 'btn-venta', () => p.alVender(punto, 1));
  botonPrincipal.setAttribute('aria-label', `Registrar una venta en ${punto}`);

  const hayQueAnular = ultimaVentaActiva(p.eventos, punto, p.hoy, VENDEDOR_ACTIVO) !== null;
  const botonRestar = boton('−1', 'btn-chico peligro', () => p.alRestar(punto));
  botonRestar.disabled = !hayQueAnular;
  botonRestar.setAttribute('aria-label', `Anular la última venta en ${punto}`);

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

export function vistaVender(p: PropsVender): HTMLElement {
  const marcado = turnoActual(p.eventos, VENDEDOR_ACTIVO, p.hoy);
  const turno =
    marcado === null
      ? null
      : jornada(p.eventos, p.hoy, p.ahora).turnos.find((t) => t.id === marcado.id) ?? null;

  return el('div', { clase: 'pantalla-vender' }, [
    el('h1', { clase: 'solo-lectores', texto: 'Vender' }),
    barraEstado(p),
    bloqueConteo({
      eventos: p.eventos,
      hoy: p.hoy,
      ahora: p.ahora,
      puntos: p.ajustes.points,
      lugarInicial: marcado?.point ?? p.ajustes.points[0] ?? '',
      alRegistrar: p.alRegistrarHora,
      alAbrirCarga: p.alAbrirCarga,
      alAbrirMayoreo: p.alAbrirMayoreo,
    }),
    resumenDeHoy(p),
    el('div', { clase: 'separador' }),
    // El conteo en vivo sigue disponible para el rato que se quiera contar botella por botella.
    el('p', { clase: 'detalle', texto: '¿Contar en vivo?' }),
    turno === null ? tarjetaSinLugar(p) : tarjetaTurno(p, turno),
    turno === null ? null : bloqueVenta(p, turno.punto),
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
    texto: 'Desde este momento las ventas se acreditan al lugar nuevo.',
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
  const quienes = `Pasas a ${punto}`;
  if (plan.piezas === 0) return `${quienes}. No hay ventas que reacreditar.`;
  const ventas = plan.ventasMovidas === 1 ? '1 venta' : `${plan.ventasMovidas} ventas`;
  return `${quienes} · se reacreditan ${ventas} (${plan.piezas} piezas).`;
}

/**
 * "Ya estabamos en otro lugar desde las HH:MM". Antes de escribir nada dice en voz alta cuantas
 * piezas va a mover: la correccion toca el historico y no se confirma a ciegas.
 */
export function abrirCorreccionLugar(p: PropsCorregirLugar): void {
  const modal = el('dialog', { attrs: { 'aria-label': 'Estabas en otro lugar' } });
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
      el('h2', { texto: 'Estabas en otro lugar' }),
      el('p', {
        clase: 'detalle',
        texto:
          p.actual === null
            ? 'Marca el lugar desde la hora en que llegaste.'
            : `El registro dice ${p.actual}. Marca dónde estabas de verdad y desde qué hora: las ventas de ahí en adelante se reacreditan solas.`,
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

/** La pregunta del prompt de respaldo, con su genero: "cuántas botellas", "cuántos litros". */
const PREGUNTA_CARGA: Record<Producto, string> = {
  botella: '¿Cuántas botellas cargas en la hielera?',
  litro: '¿Cuántos litros cargas en la hielera?',
};

/** Tamanos tipicos de lote: casi siempre la carga es una de estas dos. */
const LOTES: readonly number[] = [18, 19];

export function abrirCarga(
  productoInicial: Producto,
  cargadoDe: (producto: Producto) => Hielera,
  alConfirmar: (producto: Producto, qty: number) => void
): void {
  const modal = el('dialog', { attrs: { 'aria-label': 'Cargar hielera' } });
  const nombre = (x: Producto): string => NOMBRE_PRODUCTO[x].plural;

  if (typeof modal.showModal !== 'function') {
    const respuesta = window.prompt(PREGUNTA_CARGA[productoInicial], '18');
    const qty = Number(respuesta);
    if (Number.isInteger(qty) && qty >= 1) alConfirmar(productoInicial, qty);
    return;
  }

  let producto = productoInicial;
  const cantidad = entrada('number', String(LOTES[0] ?? 18), {
    min: '1',
    step: '1',
    inputmode: 'numeric',
  });
  const estado = el('p', { clase: 'detalle' });
  const productos = PRODUCTOS.map((x) =>
    boton(NOMBRE_PRODUCTO[x].titulo, 'seg', () => {
      producto = x;
      refrescar();
    })
  );
  const refrescar = (): void => {
    productos.forEach((b, i) => {
      const activo = PRODUCTOS[i] === producto;
      b.classList.toggle('activo', activo);
      b.setAttribute('aria-pressed', String(activo));
    });
    const h = cargadoDe(producto);
    // Sin participio: "botellas cargadas" y "litros cargados" no concuerdan con una sola forma.
    estado.textContent = h.sinCarga
      ? `Hoy no has cargado ${nombre(producto)}.`
      : `Hoy ya cargaste ${h.cargado} ${nombre(producto)}; esto se suma.`;
  };
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
    alConfirmar(producto, qty);
  };

  modal.appendChild(
    el('div', {}, [
      el('h2', { texto: 'Cargar hielera' }),
      el('p', { clase: 'detalle', texto: 'Piezas que salen en la hielera. Las recargas del día suman.' }),
      el(
        'div',
        { clase: 'segmentado', attrs: { role: 'group', 'aria-label': 'Producto' } },
        productos
      ),
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

function sinMovimientos(h: Hielera): boolean {
  return h.cargado === 0 && h.vendido === 0 && h.recibido === 0 && h.entregado === 0;
}

/** La hielera de litros de cada quien, solo si ese dia se movio: un dia sin litros no la pinta. */
function hielerasDeLitro(eventos: readonly AppEvent[], fecha: string): Hielera[] {
  return vendedoresDelDia(eventos, fecha)
    .map((v) => hieleraDe(eventos, v, fecha, 'litro'))
    .filter((h) => !sinMovimientos(h));
}

/**
 * Linea de verificacion, no formulario: cargó + recibió = vendió + pasó + lo que queda.
 * Los traspasos solo se escriben cuando los hubo: en un dia normal la linea es la de siempre.
 */
function lineaCuadre(h: Hielera, rotulo: string = h.vendedor): HTMLElement {
  const sinMovimiento = sinMovimientos(h);

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
    el('span', { clase: 'cuadre-vendedor', texto: rotulo }),
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
function causaDelNegativo(h: Hielera, producto: Producto = 'botella'): string {
  const hubo = h.recibido > 0 || h.entregado > 0;
  const de = producto === 'litro' ? ' litros' : '';
  return hubo
    ? `${h.vendedor} vendió ${-h.restante} más de las que tuvo: falta una carga, o el traspaso quedó mal contado.`
    : `${h.vendedor} vendió ${-h.restante}${de} más de lo cargado: falta registrar una carga.`;
}

function bloqueCuadre(eventos: readonly AppEvent[], fecha: string): HTMLElement {
  const delDia = hieleras(eventos, fecha);
  const litros = hielerasDeLitro(eventos, fecha);
  const faltantes = delDia.filter((h) => h.restante < 0);
  const faltanLitros = litros.filter((h) => h.restante < 0);
  // Los traspasos se cancelan entre las hieleras, asi que este total sigue siendo lo que de
  // verdad salio de casa y se puede contar contra el almacen. Los dias viejos con Primo suman
  // las dos hieleras de botella.
  const cargadoDelDia = delDia.reduce((s, h) => s + h.cargado, 0);
  const litrosDelDia = litros.reduce((s, h) => s + h.cargado, 0);
  const salieron =
    litrosDelDia === 0
      ? `Salieron ${cargadoDelDia} piezas de casa.`
      : `Salieron ${cargadoDelDia} botellas y ${litrosDelDia} litros de casa.`;

  return el('section', { clase: 'bloque' }, [
    el('h2', { texto: 'Cuadre del día' }),
    el('p', { clase: 'detalle', texto: 'Cargadas + recibidas = vendidas + pasadas + restantes.' }),
    ...delDia.map((h) => lineaCuadre(h)),
    ...litros.map((h) => lineaCuadre(h, `${h.vendedor} · litros`)),
    el('p', { clase: 'detalle num', texto: salieron }),
    ...faltantes.map((h) => el('p', { clase: 'aviso', texto: causaDelNegativo(h) })),
    ...faltanLitros.map((h) => el('p', { clase: 'aviso', texto: causaDelNegativo(h, 'litro') })),
  ]);
}

/** La insignia LITRO, o nada para botellas y eventos viejos. */
function insigniaProducto(e: { product?: Producto }): HTMLElement | null {
  const texto = insigniaDeProducto(e);
  return texto === null ? null : el('span', { clase: 'insignia', texto });
}

function insignias(v: SaleEvent): HTMLElement[] {
  const marcas: HTMLElement[] = [];
  const producto = insigniaProducto(v);
  if (producto !== null) marcas.push(producto);
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

/**
 * '24 piezas' los dias de puras botellas, '24 botellas · 6 litros' cuando hubo litros: no se
 * suman piezas de tamanos distintos en una sola cifra.
 */
function piezasPorProducto(ventas: readonly SaleEvent[]): string {
  const litros = totalPiezas(filtrarProducto(ventas, 'litro'));
  const botellas = totalPiezas(filtrarProducto(ventas, 'botella'));
  return litros === 0 ? `${botellas} piezas` : `${botellas} botellas · ${litros} litros`;
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
  const { hielera: h, litro: l, ritmo: r } = panel;
  // Los litros se pintan aparte y solo el dia que se movieron: los dias de puras botellas (y
  // todos los historicos) se ven igual que siempre.
  const conLitros = !sinMovimientos(l);
  const vendioAlgo = h.vendido > 0 || l.vendido > 0;

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
      metrica('Vendió', String(h.vendido), conLitros ? 'botellas' : 'piezas'),
      conLitros
        ? metrica(
            'Litros',
            String(l.vendido),
            l.sinCarga ? 'vendidos · sin carga' : `vendidos · quedan ${l.restante} de ${l.cargado}`,
            l.restante < 0 ? 'alerta' : ''
          )
        : null,
      metrica(
        'Ritmo',
        r.porHora > 0 ? `${r.porHora}` : '—',
        r.porHora > 0 ? `por hora · en ${duracionLegible(r.minutos)}` : 'por hora'
      ),
    ]),
    h.restante < 0 ? el('p', { clase: 'aviso', texto: causaDelNegativo(h) }) : null,
    l.restante < 0 ? el('p', { clase: 'aviso', texto: causaDelNegativo(l, 'litro') }) : null,
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
      insigniaProducto(m),
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
    encabezado('Hoy', `${fechaLegible(p.fecha)} · ${piezasPorProducto(activas)}`, botonMenu(p.alIrA)),
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
        boton('Estabas en otro lugar', 'btn', p.alCorregirLugar),
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
  /** Botellas y litros se miran por separado o juntos; ya no hay filtro por vendedor. */
  producto: Producto | 'todos';
  ahora: Date;
  alCambiarRango: (r: Rango) => void;
  alCambiarCanal: (c: Canal | 'todo') => void;
  alCambiarProducto: (p: Producto | 'todos') => void;
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

/**
 * Sin filtro por vendedor: hoy vende uno solo. Los rangos que llegan a dias con Primo siguen
 * sumando sus ventas, y "Por vendedor" aparece solo cuando en el rango vendio mas de uno.
 */
export function vistaStats(p: PropsStats): HTMLElement {
  const enRango = filtrarCanal(filtrarRango(ventasActivas(p.eventos), p.rango, p.ahora), p.canal);
  const ventas = p.producto === 'todos' ? enRango : filtrarProducto(enRango, p.producto);
  const variosVendedores = new Set(ventas.map((v) => v.vendor)).size > 1;
  const detalle =
    p.producto === 'todos'
      ? piezasPorProducto(ventas)
      : `${totalPiezas(ventas)} ${NOMBRE_PRODUCTO[p.producto].plural}`;

  return el('div', {}, [
    encabezadoSecundario('Stats', detalle, p.alVolver),
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
        { valor: 'todos' as const, etiqueta: 'Todo' },
        ...PRODUCTOS.map((x) => ({ valor: x, etiqueta: NOMBRE_PRODUCTO[x].titulo })),
      ],
      p.producto,
      p.alCambiarProducto
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
    variosVendedores ? bloqueBarras('Por vendedor', porVendedor(ventas)) : null,
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
  producto: Producto;
  qty: number;
};

/** Producto de una captura retroactiva, con los nombres de pantalla. Arranca en botella. */
function selectorProducto(): HTMLSelectElement {
  const control = selector(PRODUCTOS, 'botella');
  control.querySelectorAll('option').forEach((opcion, i) => {
    const x = PRODUCTOS[i];
    if (x !== undefined) opcion.textContent = NOMBRE_PRODUCTO[x].titulo;
  });
  return control;
}

/**
 * Quien vendio o cargo. Solo se pregunta si hoy vende mas de uno: con un solo vendedor el
 * campo es un selector de una opcion que no decide nada.
 */
function selectorVendedor(): { control: HTMLSelectElement; nodo: HTMLElement | null } {
  const control = selector(VENDEDORES_ACTIVOS, VENDEDOR_ACTIVO);
  return { control, nodo: VENDEDORES_ACTIVOS.length > 1 ? campo('Vendedor', control) : null };
}

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
  const retroProducto = selectorProducto();
  const retroVendedor = selectorVendedor();
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
      campo('Producto', retroProducto),
      campo('Canal', retroCanal),
      retroVendedor.nodo,
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
            vendedor: retroVendedor.control.value as Vendedor,
            producto: retroProducto.value as Producto,
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
  producto: Producto;
  qty: number;
};

/** Misma forma que la venta retroactiva: para registrar una carga que ya ocurrio. */
export function abrirCargaRetro(
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
  const retroProducto = selectorProducto();
  const retroVendedor = selectorVendedor();
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
      campo('Producto', retroProducto),
      retroVendedor.nodo,
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
            vendedor: retroVendedor.control.value as Vendedor,
            producto: retroProducto.value as Producto,
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
  alCambiarFecha: (f: string) => void;
  /** `origen` null = no salio de la caja: se pago con el efectivo del dia o de una bolsa. */
  alAgregarGasto: (concepto: string, monto: string, origen: Sobre | null) => void;
  alQuitarGasto: (id: string) => void;
  /** Lo que se aparta hoy para la gasolina del domingo. Vacio cuenta como cero. */
  alCambiarApartado: (gasolina: string) => void;
  alCambiarPrecios: (calle: string, mayoreo: string, litro: string) => void;
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
    // Solo el dia que hubo litros: los cortes de puras botellas (y los historicos) no cambian.
    ingreso.litro.piezas > 0
      ? lineaDinero(
          `Litros · ${ingreso.litro.piezas} × ${importe(precios.litro)}`,
          ingreso.litro.centavos
        )
      : null,
    lineaDinero('Total', ingreso.total, 'corte-total'),
  ]);
}

/** El valor de "no salió de la caja". Vacio y no un sobre: no hay efectivo que mover. */
const ORIGEN_FUERA = '';

/**
 * De que sobre salio el efectivo de un gasto. Arranca en el fondo, que es el caso de todos los
 * dias —los insumos—, pero el gas de Mama Juani se paga con el efectivo de la venta y ese no
 * mueve la caja. Antes no se preguntaba y todo vaciaba el fondo.
 */
function selectorOrigen(): HTMLSelectElement {
  const valores = [...SOBRES_DE_GASTO, ORIGEN_FUERA];
  const control = selector(valores, SOBRES_DE_GASTO[0] ?? ORIGEN_FUERA);
  const opciones = control.querySelectorAll('option');
  valores.forEach((v, i) => {
    const opcion = opciones[i];
    if (opcion === undefined) return;
    opcion.textContent = v === ORIGEN_FUERA ? 'No salió de la caja' : NOMBRE_SOBRE[v as Sobre];
  });
  return control;
}

function leerOrigen(control: HTMLSelectElement): Sobre | null {
  return control.value === ORIGEN_FUERA ? null : (control.value as Sobre);
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
 * Lo que se aparta hoy para cargar gasolina el domingo.
 *
 * Se teclea cada dia y arranca vacio a proposito: antes salia de una tarifa fija que apartaba
 * los dias que no se cargo nada y apartaba de menos los dias que se cargo mas. Lo que se aparta
 * es lo que Fran deja en la caja con la mano, y eso solo lo sabe el.
 *
 * El gas de Mama Juani no esta aqui: se le paga cada dos lotes con el efectivo de ese dia, asi
 * que va como un gasto mas. Ponerlo en los dos lados lo cobraria dos veces.
 *
 * Se guarda con su boton, como los precios: lo tecleado sin guardar no entra al corte. El
 * dialogo de cerrar vuelve a decir cuanto se aparta, antes de que sea irreversible.
 */
function bloqueApartado(apartado: Apartado, alCambiar: (gasolina: string) => void): HTMLElement {
  // Cero se pinta como campo vacio, no como '0.00': lo que no se aparto no se teclea.
  const gasolina = entradaMonto(apartado.gasolina === 0 ? '' : pesos(apartado.gasolina));
  const guardar = (): void => alCambiar(gasolina.value);
  gasolina.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') guardar();
  });

  return el('section', { clase: 'bloque' }, [
    el('h2', { texto: 'Se aparta hoy' }),
    el('p', {
      clase: 'detalle',
      texto:
        'Lo que hoy dejas guardado en la caja para cargar gasolina el domingo. Déjalo vacío el ' +
        'día que no apartes nada. Sale de la utilidad antes de lo que te llevas.',
    }),
    campo(NOMBRE_SOBRE.gasolina, gasolina),
    boton('Guardar lo apartado', 'btn bloque-completo espaciado', guardar),
  ]);
}

/**
 * La cifra grande: lo que te llevas. Se pinta una sola vez por pantalla.
 *
 * Una sola tarjeta "Lo tuyo" cuando `primo` es 0, que es todo corte nuevo. Los cortes cerrados
 * cuando eran dos socios a mitad guardan la de Primo y se siguen pintando con las dos.
 */
function tarjetasSocios(fran: number, primo: number): HTMLElement {
  const tarjeta = (rotulo: string, centavos: number): HTMLElement =>
    el('div', { clase: 'corte-socio' }, [
      el('span', { clase: 'detalle', texto: rotulo }),
      el('span', { clase: 'corte-cifra num', texto: importe(centavos) }),
    ]);
  return el(
    'div',
    { clase: `corte-reparto${primo === 0 ? ' corte-reparto-uno' : ''}` },
    primo === 0 ? [tarjeta('Lo tuyo', fran)] : [tarjeta('Lo tuyo', fran), tarjeta('Primo', primo)]
  );
}

/**
 * El desglose completo en un solo bloque: del ingreso a lo que te llevas, restando
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
  // Con un solo dueño no se parte nada: los cortes viejos con Primo conservan "Se reparte".
  const unSoloDueno = reparto.primo === 0;
  return [
    el('h2', { texto: unSoloDueno ? 'Tu utilidad' : 'Se reparte' }),
    lineaDinero('Ingreso', reparto.ingreso),
    lineaDinero('Gastos del día', -reparto.gastos),
    reparto.reponerCaja === 0 ? null : lineaDinero('Reponer caja', -reparto.reponerCaja),
    reparto.ajustes === 0 ? null : lineaDinero('Ajustes', reparto.ajustes),
    // Con el desglose por sobre cuando lo hay; el corte ya cerrado solo guardo el total, y los
    // de antes de esta regla lo traen con la gasolina y el gas juntos: por eso el rotulo neutro.
    ...(apartados.length > 0
      ? apartados.map((a) => lineaDinero(NOMBRE_SOBRE[a.sobre], -a.centavos))
      : reparto.apartado === 0
        ? []
        : [lineaDinero('Se apartó', -reparto.apartado)]),
    lineaDinero(unSoloDueno ? 'Tu utilidad' : 'Se reparte', reparto.repartible, 'corte-total'),
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
  /** Lo que pagaria cerrar la semana hoy. */
  semana: PlanSemana;
  alMover: (captura: CapturaCaja) => void;
  alEditar: (id: string, captura: CapturaCaja) => void;
  alBorrar: (id: string) => void;
  alArquear: (contado: string) => void;
  alCerrarSemana: () => void;
  /** Sacar de su sobre lo ya ganado: lo tuyo, o el saldo viejo de Primo. */
  alCobrar: (sobre: Sobre) => void;
  alCopiar: () => void;
  alIrA: (v: Vista) => void;
};

/**
 * Una linea de sobre: cuanto hay contra cuanto deberia haber, y lo que falta si falta. Lo tuyo
 * —y el sobre de Primo mientras traiga saldo de los cortes viejos— trae su boton de cobrar,
 * porque ese dinero se saca, no se repone.
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

/**
 * El selector de sobre con los nombres largos, que es como Fran los llama en voz alta. Solo
 * ofrece los sobres visibles (el de Primo sale mientras traiga saldo viejo), mas el del
 * movimiento que se corrige, para no cambiarlo de sobre sin querer.
 */
function selectorSobre(inicial: Sobre, visibles: readonly Sobre[]): HTMLSelectElement {
  const ofrecidos = SOBRES.filter((s) => s === inicial || visibles.includes(s));
  const control = selector(ofrecidos, inicial);
  const opciones = control.querySelectorAll('option');
  ofrecidos.forEach((s, i) => {
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
function camposMovimiento(
  inicial: { sobre: Sobre; monto: string; concepto: string },
  visibles: readonly Sobre[]
): {
  nodos: HTMLElement[];
  leer: (signo: 1 | -1) => CapturaCaja;
  limpiar: () => void;
} {
  const sobre = selectorSobre(inicial.sobre, visibles);
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

function capturaCaja(
  visibles: readonly Sobre[],
  alMover: (captura: CapturaCaja) => void
): HTMLElement {
  const campos = camposMovimiento({ sobre: 'gasolina', monto: '', concepto: '' }, visibles);
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
function abrirEdicionCaja(
  m: MovimientoCaja,
  visibles: readonly Sobre[],
  alGuardar: (captura: CapturaCaja) => void
): void {
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
  const campos = camposMovimiento(
    { sobre: m.sobre, monto: pesos(Math.abs(m.centavos)), concepto: m.concepto },
    visibles
  );

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
        'El domingo: se carga gasolina y se le paga el gas a Mamá Juani. ' +
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
  const visibles = sobresVisibles(p.caja);

  return el('div', {}, [
    // La frase va debajo y no de dato de cabecera: es una linea entera, y apretada contra el
    // titulo en una fila de flex se parte donde le toca, no donde se lee.
    encabezado('Caja', '', botonMenu(p.alIrA)),
    el('p', { clase: 'detalle encabezado-nota', texto: 'Dónde está el dinero, no cuánto ganamos.' }),

    el('section', { clase: 'bloque' }, [
      // El sobre de Primo solo sale si todavia trae saldo de cuando eran dos socios.
      ...p.caja.sobres
        .filter((s) => visibles.includes(s.sobre))
        .map((s) => lineaSobre(s, p.alCobrar)),
      lineaDinero('Efectivo en la caja', p.caja.hay, 'corte-total'),
      faltantes.length === 0
        ? el('p', { clase: 'detalle', texto: 'La caja está al corriente.' })
        : el('p', {
            clase: 'aviso num',
            texto:
              `Debes a la caja ${importe(p.caja.deuda)}: ` +
              faltantes.map((s) => `${NOMBRE_SOBRE[s.sobre]} ${importe(s.deuda)}`).join(' · '),
          }),
      // El estado de la caja en texto, para mandarlo o guardarlo.
      boton('Copiar caja', 'btn bloque-completo espaciado', p.alCopiar),
    ]),

    el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Registrar movimiento' }),
      el('p', {
        clase: 'detalle',
        texto:
          'Sacar de cualquier sobre queda como deuda hasta que lo devuelvas — del fondo o de ' +
          'la gasolina, da igual. Pagar lo apartado no es esto: eso sale del gasto que capturas ' +
          'en el corte o del cierre del domingo. Nada de aquí toca la utilidad.',
      }),
      capturaCaja(visibles, p.alMover),
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
        (m) => abrirEdicionCaja(m, visibles, (captura) => p.alEditar(m.id, captura)),
        p.alBorrar
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
        'Lo tuyo se va a tu sobre y cobras de ahí cuando quieras.',
    }),
    plan.deuda === 0
      ? null
      : el('p', {
          clase: 'detalle num',
          texto:
            `La caja trae ${importe(plan.deuda)} prestados. No se cobran aquí: el gasto que ` +
            'los generó ya bajó la utilidad.',
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
  const origen = selectorOrigen();
  const agregar = (): void => {
    p.alAgregarGasto(concepto.value, monto.value, leerOrigen(origen));
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
    apartado: p.borrador.apartado,
  });
  const reparto = calcularReparto(
    p.ingreso.total,
    p.borrador.gastos,
    [],
    plan.totalApartado
  );

  const precioCalle = entradaMonto(pesos(p.precios.calle));
  const precioMayoreo = entradaMonto(pesos(p.precios.mayoreo));
  const precioLitro = entradaMonto(pesos(p.precios.litro));
  const guardarPrecios = (): void =>
    p.alCambiarPrecios(precioCalle.value, precioMayoreo.value, precioLitro.value);

  return el('div', {}, [
    ...cabecera,

    bloqueIngreso(p.ingreso, p.precios),

    el('section', { clase: 'bloque' }, [
      el('h2', { texto: 'Gastos' }),
      el('p', {
        clase: 'detalle',
        texto:
          'Di de qué sobre salió el efectivo. Del fondo salen los insumos, y lo que saques queda ' +
          'como deuda hasta que se reponga. Lo que pagas con el efectivo de la venta —el gas de ' +
          'Mamá Juani— va con «no salió de la caja». Borrar un gasto devuelve su efectivo.',
      }),
      ...listaGastos(p.borrador.gastos, p.alQuitarGasto),
      lineaDinero(
        'Total',
        p.borrador.gastos.reduce((s, g) => s + g.centavos, 0),
        'corte-total'
      ),
      el('div', { clase: 'espaciado' }, [concepto]),
      campo('Sale de', origen),
      el('div', { clase: 'fila-botones' }, [monto, boton('Agregar', 'btn', agregar)]),
    ]),

    bloqueApartado(p.borrador.apartado, p.alCambiarApartado),

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
        campo('Litro', precioLitro),
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
