import type { AppEvent, Producto } from './tipos';
import type { Hielera, LineaConteo } from './dominio';
import { PRODUCTOS, VENDEDOR_ACTIVO, hieleraDe, productoDe } from './dominio';
import { boton, campo, el, entrada, horaEnPunto, selector } from './dom';

// La captura principal de la pantalla Vender: "¿cuantas te quedan?". Aqui vive el bloque de
// conteo y lo que lo rodea; la barra de estado y el conteo en vivo siguen en ui.ts.

/** Como se nombra cada producto en pantalla. Un producto nuevo es una entrada mas, no un if. */
export const NOMBRE_PRODUCTO: Record<Producto, { titulo: string; plural: string }> = {
  botella: { titulo: 'Botellas', plural: 'botellas' },
  litro: { titulo: 'Litros', plural: 'litros' },
};

/**
 * La insignia de un evento en la lista de movimientos de Hoy. Solo el litro la lleva: ahi se
 * anula y se mueve, y anular el renglon equivocado cambia dinero ($35 contra $20) y la hielera.
 * Botella y eventos viejos sin `product` devuelven null y se ven igual que siempre.
 */
export function insigniaDeProducto(e: { product?: Producto }): string | null {
  return productoDe(e) === 'litro' ? 'LITRO' : null;
}

/**
 * La pregunta de cada producto. El principal siempre se pregunta y va en grande; los demas solo
 * aparecen si ese dia se cargaron, para no poner un campo vacio que nadie va a llenar.
 */
const CONTEO: Record<Producto, { pregunta: string; principal: boolean }> = {
  botella: { pregunta: '¿Cuántas te quedan?', principal: true },
  litro: { pregunta: 'Litros: ¿cuántos te quedan?', principal: false },
};

export type Quedan = Record<Producto, number | null>;

/**
 * Registrar se habilita con al menos un conteo. El campo vacio es "no lo conte" (null), pero un
 * 0 tecleado si cuenta: es haber vendido la hielera entera.
 */
export function estadoRegistrar(quedan: Readonly<Quedan>): { habilitado: boolean } {
  return { habilitado: PRODUCTOS.some((p) => quedan[p] !== null) };
}

/**
 * Lo que deberia traer, al lado del campo donde teclea lo que conto. Sin carga registrada el
 * numero no significa nada todavia, y decirlo evita teclear contra un 0.
 */
function pistaDeConteo(h: Hielera): string {
  if (h.sinCarga && h.vendido === 0) return 'sin carga registrada hoy';
  if (h.restante < 0) return `${-h.restante} de más: falta registrar una carga`;
  return `traes ${h.restante}`;
}

export type PropsConteo = {
  eventos: readonly AppEvent[];
  hoy: string;
  ahora: Date;
  puntos: readonly string[];
  /** El lugar del turno en curso, o el primero de la lista si todavia no se marco ninguno. */
  lugarInicial: string;
  alRegistrar(datos: { punto: string; hora: string; quedan: Quedan }): void;
  alAbrirCarga(): void;
  alAbrirMayoreo(): void;
};

type FilaConteo = { producto: Producto; control: HTMLInputElement; nodo: HTMLElement };

function filaConteo(producto: Producto, h: Hielera): FilaConteo {
  const { pregunta, principal } = CONTEO[producto];
  const id = `conteo-${producto}`;
  const control = entrada('number', '', {
    id,
    min: '0',
    step: '1',
    inputmode: 'numeric',
    autocomplete: 'off',
    // Un guion y no un 0: un 0 invitaria a dejarlo asi, y un 0 contado es vender la hielera entera.
    placeholder: '—',
    'aria-describedby': `${id}-pista`,
  });
  const clase = `conteo ${principal ? 'conteo-principal' : 'conteo-secundario'}`;
  const nodo = el('div', { clase }, [
    el('label', { clase: 'conteo-pregunta', texto: pregunta, attrs: { for: id } }),
    control,
    el('p', {
      clase: 'detalle num conteo-pista',
      texto: pistaDeConteo(h),
      attrs: { id: `${id}-pista` },
    }),
  ]);
  return { producto, control, nodo };
}

function leerConteo(filas: readonly FilaConteo[]): Quedan {
  const quedan = Object.fromEntries(PRODUCTOS.map((p) => [p, null])) as Quedan;
  for (const f of filas) {
    quedan[f.producto] = f.control.value === '' ? null : Number(f.control.value);
  }
  return quedan;
}

/**
 * La captura principal: cuantas quedan en la hielera, donde y desde que hora. Va arriba de todo
 * porque es como se trabaja; tocar +1 por botella tiene friccion en la calle.
 *
 * Se cuenta al CERRAR el rato, pero la hora que se teclea es la de llegada: las piezas se
 * acreditan al lugar y a la franja en que de verdad se fueron, que es como se lee la cuadricula.
 * La hora arranca en la de ahora redondeada hacia abajo y se teclea encima si se llego antes.
 *
 * Es un <form> para que el "Ir" del teclado numerico registre igual que el boton; con el boton
 * deshabilitado el navegador tampoco envia.
 */
export function bloqueConteo(p: PropsConteo): HTMLElement {
  const filas = PRODUCTOS.flatMap((producto) => {
    const h = hieleraDe(p.eventos, VENDEDOR_ACTIVO, p.hoy, producto);
    return CONTEO[producto].principal || !h.sinCarga ? [filaConteo(producto, h)] : [];
  });

  const lugar = selector(p.puntos, p.lugarInicial);
  const hora = entrada('time', horaEnPunto(p.ahora));
  const registrar = el('button', {
    clase: 'btn-venta',
    texto: 'Registrar',
    attrs: { type: 'submit' },
  });

  const refrescar = (): void => {
    registrar.disabled = !estadoRegistrar(leerConteo(filas)).habilitado;
  };
  for (const f of filas) f.control.addEventListener('input', refrescar);
  refrescar();

  const donde = el('div', { clase: 'corte-precios conteo-donde' }, [
    campo('Lugar', lugar),
    campo('Desde las', hora),
  ]);
  const formulario = el(
    'form',
    { clase: 'conteo-form', attrs: { 'aria-label': 'Conteo de la hielera' } },
    [...filas.map((f) => f.nodo), donde, registrar]
  );
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const quedan = leerConteo(filas);
    if (!estadoRegistrar(quedan).habilitado) return;
    p.alRegistrar({ punto: lugar.value, hora: hora.value, quedan });
  });

  return el('section', { clase: 'bloque conteo-bloque' }, [
    formulario,
    el('div', { clase: 'acciones-secundarias' }, [
      boton('Cargar hielera', 'btn-texto', () => p.alAbrirCarga()),
      boton('Mayoreo', 'btn-texto', () => p.alAbrirMayoreo()),
    ]),
  ]);
}

/** Un producto cuyo conteo salio mayor a lo que deberia traer. */
export type SobranteConteo = { producto: Producto; linea: LineaConteo };

function textoSobrante({ producto, linea }: SobranteConteo): string {
  const traia = linea.sinCarga ? 'no hay carga registrada hoy' : `deberías traer ${linea.esperado}`;
  const cuenta = linea.contado ?? 0;
  const titulo = NOMBRE_PRODUCTO[producto].titulo;
  return `${titulo}: cuentas ${cuenta} y ${traia}. Sobran ${linea.sobran}.`;
}

/**
 * Contar mas de las que el sistema cree que quedan solo tiene una explicacion fisica: una carga
 * que no se registro. La captura se detiene aqui en vez de escribir una venta negativa o tragarse
 * el descuadre, y ofrece de un toque lo unico que lo arregla, ya en el producto que sobra.
 *
 * Tampoco registra el conteo del otro producto: los numeros se teclearon juntos y se vuelven a
 * enviar juntos; partirlos dejaria a medias una captura que el vendedor cree hecha.
 */
export function abrirSobranteConteo(
  sobrantes: readonly SobranteConteo[],
  alCargar: (producto: Producto) => void
): void {
  const primero = sobrantes[0];
  if (primero === undefined) return;
  const modal = el('dialog', { attrs: { 'aria-label': 'Sobran piezas' } });

  if (typeof modal.showModal !== 'function') {
    const texto = `${sobrantes.map(textoSobrante).join('\n')}\n\n¿Registrar la carga que falta?`;
    if (window.confirm(texto)) alCargar(primero.producto);
    return;
  }

  const cerrar = (): void => {
    modal.close();
    modal.remove();
  };

  // Un boton por producto que sobra: con uno solo dice "Cargar hielera", como en la pantalla.
  const cargas = sobrantes.map((s) =>
    boton(
      sobrantes.length === 1 ? 'Cargar hielera' : `Cargar ${NOMBRE_PRODUCTO[s.producto].plural}`,
      'btn activo',
      () => {
        cerrar();
        alCargar(s.producto);
      }
    )
  );

  modal.appendChild(
    el('div', {}, [
      el('h2', { texto: 'Sobran piezas' }),
      el('div', {}, sobrantes.map((s) => el('p', { texto: textoSobrante(s) }))),
      el('p', {
        clase: 'detalle',
        texto: 'De la nada no salen: falta registrar una carga. Regístrala y vuelve a contar.',
      }),
      el('div', { clase: 'fila-botones' }, [boton('Cancelar', 'btn', cerrar), ...cargas]),
    ])
  );

  document.body.appendChild(modal);
  modal.addEventListener('cancel', () => modal.remove());
  modal.showModal();
}
