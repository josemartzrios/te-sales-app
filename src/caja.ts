import { FONDO_CAMBIO, FONDO_GASTO, MONTO_MAXIMO, importe, pesos } from './corte';
import { LARGO_MAXIMO_TEXTO, fechaLegible } from './dominio';

/**
 * La caja por dentro. El corte responde "cuanto ganamos"; este modulo responde "donde esta
 * el dinero y a quien le pertenece". Son dos libros distintos a proposito:
 *
 *   - Resultado  (corte.ts): ingreso - gastos = utilidad, mitad y mitad. Un gasto se cuenta
 *     el dia que se paga, sin importar de que sobre salio el efectivo.
 *   - Tesoreria  (aqui):     de los pesos que hay en la caja, cuales ya tienen dueño.
 *
 * Mezclarlos es el error que cuesta dinero: si tomo prestados 245 de la caja para comprar
 * insumos, los insumos ya bajaron la utilidad ese dia. Volver a restarlos manana al reponer
 * la caja los cobraria dos veces, igual que restar el fondo y el cambio del reparto.
 * Por eso NADA de este modulo toca la utilidad: solo mueve efectivo entre sobres.
 *
 * Todo en centavos enteros, como el resto de la app.
 */

// ---------- sobres ----------

/**
 * Los cinco destinos del dinero que vive en la caja. No son cajas fisicas separadas —el
 * efectivo es uno solo— sino a quien le toca cada peso del bulto.
 */
export type Sobre = 'fondo' | 'cambio' | 'gasolina' | 'gas' | 'primo';

export const SOBRES: readonly Sobre[] = ['fondo', 'cambio', 'gasolina', 'gas', 'primo'];

export const NOMBRE_SOBRE: Record<Sobre, string> = {
  fondo: 'Fondo',
  cambio: 'Cambio',
  gasolina: 'Gasolina',
  gas: 'Gas (Mamá Juani)',
  primo: 'Sueldo de Primo',
};

/**
 * Con cuanto arranca cada sobre antes de cualquier movimiento.
 *
 * Fondo y cambio son rotatorios: su objetivo es fijo y no crece, solo se repone cuando alguien
 * saca de ahi. Los otros tres arrancan en cero y se llenan solos: gasolina y gas con el
 * apartado de cada dia de venta, el de Primo con su mitad de cada corte cerrado.
 */
export const BASE_SOBRE: Record<Sobre, number> = {
  fondo: FONDO_GASTO,
  cambio: FONDO_CAMBIO,
  gasolina: 0,
  gas: 0,
  primo: 0,
};

/** Cuanto se aparta por cada dia en que hubo ventas. Editable en la vista Corte. */
export type Tasas = {
  gasolina: number;
  gas: number;
};

export const TASA_GASOLINA = 4500;
export const TASA_GAS = 4000;
export const TASAS_INICIALES: Tasas = { gasolina: TASA_GASOLINA, gas: TASA_GAS };

/** Los sobres que se llenan con el apartado diario, en el orden en que se muestran. */
export const SOBRES_APARTADO: readonly ('gasolina' | 'gas')[] = ['gasolina', 'gas'];

// ---------- movimientos ----------

/**
 * Que significa el movimiento. El SIGNO de `centavos` siempre dice lo mismo —positivo entra
 * a la caja, negativo sale—; el tipo dice ademas si tambien cambia lo que ese sobre *deberia*
 * tener guardado:
 *
 *   apartado    +  aparto 45 de las ventas para gasolina        deberia +, hay +
 *   pago        -  cargo gasolina, le pago a Primo              deberia -, hay -
 *   prestamo    -  saco del fondo para comprar insumos          deberia =, hay -   -> deuda
 *   reposicion  +  devuelvo lo prestado con lo que se vendio    deberia =, hay +   -> deuda
 *
 * La deuda a la caja no es un campo guardado: es exactamente lo prestado menos lo repuesto.
 *
 * No hay tipo 'correccion' a proposito: los cuatro van en pares exactos —apartado/pago mueven
 * las dos columnas, prestamo/reposicion solo el efectivo—, asi que cualquier captura mala se
 * deshace con su inverso, y las dos lineas quedan a la vista en el historial.
 */
export type TipoMovimiento = 'apartado' | 'pago' | 'prestamo' | 'reposicion';

/** Los tipos que mueven el objetivo del sobre. Los demas solo mueven el efectivo real. */
const MUEVE_OBJETIVO: Record<TipoMovimiento, boolean> = {
  apartado: true,
  pago: true,
  prestamo: false,
  reposicion: false,
};

/** Que se le muestra a Fran en el boton, y hacia donde va el signo del monto que teclea. */
export const ACCIONES: readonly { tipo: TipoMovimiento; etiqueta: string; signo: 1 | -1 }[] = [
  { tipo: 'prestamo', etiqueta: 'Tomé prestado', signo: -1 },
  { tipo: 'reposicion', etiqueta: 'Devolví', signo: 1 },
  { tipo: 'pago', etiqueta: 'Pagué', signo: -1 },
  { tipo: 'apartado', etiqueta: 'Aparté', signo: 1 },
];

/**
 * Un movimiento es inmutable, igual que una venta: no se edita ni se borra. Uno mal capturado
 * se corrige con su inverso, y los dos quedan a la vista en el historial.
 */
export type MovimientoCaja = {
  id: string;
  ts: string;
  /** Clave YYYY-MM-DD. Se guarda y no se deriva de ts: agrupa por dia de operacion. */
  fecha: string;
  device: string;
  tipo: TipoMovimiento;
  sobre: Sobre;
  /** Centavos con signo: + entra a la caja, - sale. Nunca cero. */
  centavos: number;
  concepto: string;
};

/**
 * Un movimiento con el id repetido no entra dos veces. Importa porque los apartados del cierre
 * llevan un id derivado de la fecha del corte: reintentar el cierre no puede apartar doble.
 */
export function agregarMovimientos(
  movimientos: readonly MovimientoCaja[],
  nuevos: readonly MovimientoCaja[]
): MovimientoCaja[] {
  const vistos = new Set(movimientos.map((m) => m.id));
  const salida = [...movimientos];
  for (const m of nuevos) {
    if (vistos.has(m.id)) continue;
    vistos.add(m.id);
    salida.push(m);
  }
  return salida;
}

/** Mas reciente primero: el historial se lee de arriba hacia abajo. */
export function movimientosRecientes(
  movimientos: readonly MovimientoCaja[],
  limite: number
): MovimientoCaja[] {
  return [...movimientos]
    .sort((a, b) => (a.ts === b.ts ? b.id.localeCompare(a.id) : b.ts.localeCompare(a.ts)))
    .slice(0, limite);
}

// ---------- saldos ----------

export type SaldoSobre = {
  sobre: Sobre;
  /** Lo que deberia estar guardado ahi. */
  objetivo: number;
  /** Lo que de verdad queda, ya descontado lo que se presto. */
  hay: number;
  /** objetivo - hay. Positivo = le debes a la caja. */
  deuda: number;
};

export function saldoDe(movimientos: readonly MovimientoCaja[], sobre: Sobre): SaldoSobre {
  let objetivo = BASE_SOBRE[sobre];
  let hay = BASE_SOBRE[sobre];
  for (const m of movimientos) {
    if (m.sobre !== sobre) continue;
    hay += m.centavos;
    if (MUEVE_OBJETIVO[m.tipo]) objetivo += m.centavos;
  }
  return { sobre, objetivo, hay, deuda: objetivo - hay };
}

export type EstadoCaja = {
  sobres: SaldoSobre[];
  /** Suma de los objetivos: lo que la caja deberia traer si nadie hubiera tomado prestado. */
  objetivo: number;
  /** Efectivo que deberia haber fisicamente en la caja ahora mismo. */
  hay: number;
  /** Lo que le debes a la caja. Cero cuando todo esta al corriente. */
  deuda: number;
};

export function estadoCaja(movimientos: readonly MovimientoCaja[]): EstadoCaja {
  const sobres = SOBRES.map((s) => saldoDe(movimientos, s));
  return {
    sobres,
    objetivo: sobres.reduce((t, s) => t + s.objetivo, 0),
    hay: sobres.reduce((t, s) => t + s.hay, 0),
    deuda: sobres.reduce((t, s) => t + s.deuda, 0),
  };
}

/** Los sobres que traen deuda, del que mas debe al que menos. Vacio = la caja esta completa. */
export function sobresEnDeuda(estado: EstadoCaja): SaldoSobre[] {
  return estado.sobres.filter((s) => s.deuda > 0).sort((a, b) => b.deuda - a.deuda);
}

// ---------- el plan del dia ----------

/**
 * Lo que hay que hacer con el efectivo antes de repartir. No es utilidad: la utilidad ya la
 * calculo el corte y no se mueve de aqui. Esto solo dice cuanto de ese efectivo se queda en
 * la caja y cuanto sale.
 */
export type PlanCaja = {
  /** Lo que se aparta hoy para gasolina y gas. Vacio si no hubo ventas o si no alcanzo. */
  apartados: { sobre: 'gasolina' | 'gas'; centavos: number }[];
  totalApartado: number;
  /** La mitad de Primo: se queda en la caja hasta el pago semanal. Negativa en un dia malo. */
  primo: number;
  /** Lo que se le debe a la caja antes de tocar el efectivo de hoy. */
  deuda: number;
  /** Cuanto de esa deuda alcanza a cubrirse hoy sin dejar a Fran en negativo. */
  reponer: number;
  /** Deuda que queda viva para mañana. */
  restante: number;
  /** Efectivo del dia que NO sale de la caja. */
  seQuedaEnCaja: number;
  /** Lo que Fran se lleva: el residuo. Puede quedar en cero en un dia flojo. */
  paraFran: number;
};

/**
 * `utilidad` y `primo` vienen del corte tal cual; este modulo no los recalcula.
 *
 * El apartado y la reposicion salen del lado de Fran, no del de Primo, y es correcto: Primo
 * cobra su mitad completa cada semana, y la gasolina y el gas le van a pegar a su mitad el dia
 * que se paguen y bajen la utilidad. Dentro de la misma semana el desfase se cierra solo.
 *
 * Tanto el apartado como la reposicion se topan a lo que quedo de efectivo despues de guardarle
 * su mitad a Primo: en un dia flojo se aparta lo que se pueda y el resto se arrastra. Llenar los
 * sobres completos siempre obligaria a Fran a poner dinero de su bolsa, o a sacarlo de la caja
 * para meterlo a la caja, que es contarse un peso a si mismo.
 */
export function planCaja(entrada: {
  utilidad: number;
  primo: number;
  deuda: number;
  tasas: Tasas;
  huboVentas: boolean;
}): PlanCaja {
  // El efectivo del dia despues de apartar la mitad de Primo. En un dia malo no queda nada.
  let disponible = Math.max(0, entrada.utilidad - entrada.primo);

  const apartados: { sobre: 'gasolina' | 'gas'; centavos: number }[] = [];
  if (entrada.huboVentas) {
    for (const sobre of SOBRES_APARTADO) {
      const centavos = Math.min(entrada.tasas[sobre], disponible);
      if (centavos <= 0) continue;
      apartados.push({ sobre, centavos });
      disponible -= centavos;
    }
  }
  const totalApartado = apartados.reduce((t, a) => t + a.centavos, 0);
  const reponer = Math.max(0, Math.min(entrada.deuda, disponible));

  return {
    apartados,
    totalApartado,
    primo: entrada.primo,
    deuda: entrada.deuda,
    reponer,
    restante: entrada.deuda - reponer,
    seQuedaEnCaja: entrada.primo + totalApartado + reponer,
    paraFran: entrada.utilidad - entrada.primo - totalApartado - reponer,
  };
}

/**
 * Los movimientos que genera cerrar un corte: el apartado del dia y la mitad de Primo.
 *
 * Los ids se derivan de la fecha del corte, no del reloj: cerrar dos veces la misma fecha
 * —que la app ya no permite, pero aqui no se confia en eso— no puede apartar el doble.
 * La reposicion NO se genera aqui: esa la captura Fran, porque depende de cuanto efectivo
 * quiso dejar realmente en la caja.
 */
export function movimientosDeCierre(entrada: {
  fecha: string;
  ts: string;
  device: string;
  primo: number;
  plan: PlanCaja;
}): MovimientoCaja[] {
  const base = { ts: entrada.ts, fecha: entrada.fecha, device: entrada.device };
  const movimientos: MovimientoCaja[] = [];

  for (const apartado of entrada.plan.apartados) {
    movimientos.push({
      ...base,
      id: `caja-${entrada.fecha}-apartado-${apartado.sobre}`,
      tipo: 'apartado',
      sobre: apartado.sobre,
      centavos: apartado.centavos,
      concepto: `Apartado del ${fechaLegible(entrada.fecha)}`,
    });
  }

  // Una utilidad negativa le resta a lo que Primo lleva acumulado: el mal dia tambien es suyo.
  if (entrada.primo !== 0) {
    movimientos.push({
      ...base,
      id: `caja-${entrada.fecha}-primo`,
      tipo: 'apartado',
      sobre: 'primo',
      centavos: entrada.primo,
      concepto: `Mitad del ${fechaLegible(entrada.fecha)}`,
    });
  }

  return movimientos;
}

// ---------- validacion defensiva de lo guardado ----------

const TIPOS: readonly TipoMovimiento[] = ['apartado', 'pago', 'prestamo', 'reposicion'];

function textoValido(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length > 0 && valor.length <= LARGO_MAXIMO_TEXTO;
}

export function validarTasas(valor: unknown): Tasas {
  if (typeof valor !== 'object' || valor === null) return { ...TASAS_INICIALES };
  const { gasolina, gas } = valor as Record<string, unknown>;
  const tasa = (v: unknown, porDefecto: number): number =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MONTO_MAXIMO ? v : porDefecto;
  return { gasolina: tasa(gasolina, TASA_GASOLINA), gas: tasa(gas, TASA_GAS) };
}

/** Un movimiento ilegible se descarta solo; el resto de la caja se sigue leyendo. */
export function validarMovimiento(valor: unknown): MovimientoCaja | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return null;
  const { id, ts, fecha, device, tipo, sobre, centavos, concepto } = valor as Record<
    string,
    unknown
  >;
  if (!textoValido(id) || !textoValido(ts) || !textoValido(device)) return null;
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  if (!TIPOS.includes(tipo as TipoMovimiento)) return null;
  if (!SOBRES.includes(sobre as Sobre)) return null;
  if (
    typeof centavos !== 'number' ||
    !Number.isInteger(centavos) ||
    centavos === 0 ||
    Math.abs(centavos) > MONTO_MAXIMO
  ) {
    return null;
  }
  if (!textoValido(concepto)) return null;
  return {
    id,
    ts,
    fecha,
    device,
    tipo: tipo as TipoMovimiento,
    sobre: sobre as Sobre,
    centavos,
    concepto,
  };
}

// ---------- resumen copiable ----------

/** Texto plano para pegar en WhatsApp, con el mismo criterio que el resumen del corte. */
export function resumenCaja(estado: EstadoCaja): string {
  const lineas: string[] = ['Caja', ''];
  for (const s of estado.sobres) {
    const falta = s.deuda > 0 ? ` (faltan ${importe(s.deuda)})` : '';
    lineas.push(`${NOMBRE_SOBRE[s.sobre]}: ${importe(s.hay)} de ${pesos(s.objetivo)}${falta}`);
  }
  lineas.push('', `Efectivo en la caja: ${importe(estado.hay)}`);
  lineas.push(
    estado.deuda > 0 ? `Debemos a la caja: ${importe(estado.deuda)}` : 'La caja está al corriente'
  );
  return lineas.join('\n');
}
