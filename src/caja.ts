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
 * Los seis destinos del dinero que vive en la caja. No son cajas fisicas separadas —el
 * efectivo es uno solo— sino a quien le toca cada peso del bulto.
 */
export type Sobre = 'fondo' | 'cambio' | 'gasolina' | 'gas' | 'fran' | 'primo';

export const SOBRES: readonly Sobre[] = [
  'fondo',
  'cambio',
  'gasolina',
  'gas',
  'fran',
  'primo',
];

export const NOMBRE_SOBRE: Record<Sobre, string> = {
  fondo: 'Fondo',
  cambio: 'Cambio',
  gasolina: 'Gasolina',
  gas: 'Gas (Mamá Juani)',
  fran: 'Lo tuyo',
  primo: 'Sueldo de Primo',
};

/** Los dos socios. Su sobre acumula lo que les toca y de ahi lo sacan cuando cobran. */
export const SOBRES_SOCIOS: readonly Sobre[] = ['fran', 'primo'];

/**
 * Con cuanto arranca cada sobre antes de cualquier movimiento.
 *
 * Fondo y cambio son rotatorios: su objetivo es fijo y no crece, solo se repone cuando alguien
 * saca de ahi. Los otros cuatro arrancan en cero y se llenan solos: gasolina y gas con el
 * apartado de cada dia de venta, los de los socios con su mitad de cada corte cerrado.
 */
export const BASE_SOBRE: Record<Sobre, number> = {
  fondo: FONDO_GASTO,
  cambio: FONDO_CAMBIO,
  gasolina: 0,
  gas: 0,
  fran: 0,
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

/**
 * Los sobres cuyo objetivo es fijo: se vacian y se reponen, pero lo que deberian traer no se
 * mueve nunca. Los otros tres se llenan con el apartado diario y se vacian el domingo.
 */
export const SOBRES_ROTATORIOS: readonly Sobre[] = ['fondo', 'cambio'];

/** Los sobres que el cierre del domingo paga y deja en cero, en el orden en que se muestran. */
export const SOBRES_DE_PAGO: readonly Sobre[] = ['gasolina', 'gas', 'primo'];

/**
 * Sacar de su sobre lo que un socio ya tiene ganado. Es un pago y no un prestamo: baja lo que
 * el sobre deberia traer, porque ese dinero ya era suyo y cobrarlo no deja ninguna deuda.
 *
 * Devuelve null si no hay nada que cobrar. Con saldo negativo tampoco escribe: no se le cobra
 * a un socio por un mal dia, se espera a que la utilidad lo compense.
 */
export function movimientoDeCobro(entrada: {
  id: string;
  ts: string;
  fecha: string;
  device: string;
  sobre: Sobre;
  centavos: number;
}): MovimientoCaja | null {
  if (entrada.centavos <= 0) return null;
  return {
    id: entrada.id,
    ts: entrada.ts,
    fecha: entrada.fecha,
    device: entrada.device,
    tipo: 'pago',
    sobre: entrada.sobre,
    centavos: -entrada.centavos,
    concepto: `Cobrado el ${fechaLegible(entrada.fecha)}`,
  };
}

/**
 * Lo que se teclea a mano SIEMPRE es un movimiento de efectivo puro: sale y queda debiendo,
 * entra y salda. Nunca cambia lo que un sobre deberia traer.
 *
 * Esa columna solo la mueven los dos cierres, que son los que conocen la regla:
 *   - el corte del dia aparta   (sube el objetivo de gasolina, gas y Primo)
 *   - el cierre del domingo paga (lo baja al vaciarlos)
 *
 * Asi "saque 18 de la gasolina para las botellas" queda como deuda —que es lo que es— sin
 * confundirse con "cargue gasolina el domingo", que es el gasto para el que se aparto. Los dos
 * son dinero saliendo del mismo sobre y por el signo son indistinguibles; lo que los separa es
 * quien los escribe, no que boton se apreto.
 */
export function tipoDeMovimiento(signo: 1 | -1): TipoMovimiento {
  return signo < 0 ? 'prestamo' : 'reposicion';
}

/** Los dos botones de captura. El signo lo pone el boton, nunca el teclado. */
export const SIGNOS: readonly { etiqueta: string; signo: 1 | -1 }[] = [
  { etiqueta: 'Entró', signo: 1 },
  { etiqueta: 'Salió', signo: -1 },
];

/**
 * Un movimiento se puede corregir mientras siga abierto, igual que un gasto del borrador; en
 * cuanto pasa por un cierre queda sellado y ya solo se corrige con su inverso.
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
  /**
   * Capturado a mano y todavia sin pasar por un cierre: se puede editar y borrar.
   *
   * La marca dice "abierto" y no "cerrado" a proposito. Lo guardado antes de que existiera este
   * campo no la trae, y ausente significa sellado: el historico de Fran no se vuelve editable
   * solo por instalar esta version. Los movimientos que genera el cierre nacen sin ella.
   */
  abierto?: true;
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

// ---------- corregir lo capturado ----------

/**
 * Cambia monto, sobre o concepto de un movimiento abierto. El tipo se recalcula solo: mover el
 * mismo monto de la gasolina al fondo lo convierte de pago a prestamo, y olvidarlo dejaria una
 * deuda fantasma.
 *
 * Devuelve null si el movimiento no existe o ya esta sellado; el llamador avisa y no guarda.
 */
export function editarMovimiento(
  movimientos: readonly MovimientoCaja[],
  id: string,
  cambios: { sobre: Sobre; centavos: number; concepto: string }
): MovimientoCaja[] | null {
  const indice = movimientos.findIndex((m) => m.id === id);
  const actual = movimientos[indice];
  if (actual === undefined || actual.abierto !== true) return null;
  if (!Number.isInteger(cambios.centavos) || cambios.centavos === 0) return null;

  const salida = [...movimientos];
  salida[indice] = {
    ...actual,
    sobre: cambios.sobre,
    centavos: cambios.centavos,
    concepto: cambios.concepto,
    tipo: tipoDeMovimiento(cambios.centavos < 0 ? -1 : 1),
  };
  return salida;
}

/** Quita un movimiento abierto. null si no existe o ya esta sellado. */
export function borrarMovimiento(
  movimientos: readonly MovimientoCaja[],
  id: string
): MovimientoCaja[] | null {
  const objetivo = movimientos.find((m) => m.id === id);
  if (objetivo === undefined || objetivo.abierto !== true) return null;
  return movimientos.filter((m) => m.id !== id);
}

/**
 * Sella todo lo que estaba abierto. Lo corre el cierre del corte: a partir de ahi el corte ya
 * guardo como quedo la caja, y editar un movimiento de esos desmentiria un registro inmutable.
 */
export function sellarMovimientos(movimientos: readonly MovimientoCaja[]): MovimientoCaja[] {
  return movimientos.map((m) => {
    if (m.abierto !== true) return m;
    const { abierto, ...sellado } = m;
    void abierto;
    return sellado;
  });
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
  /** Lo que queda para los socios despues de apartar. Negativo en un dia malo. */
  repartible: number;
  /** La mitad de cada quien. El centavo impar se lo queda Fran, que trae la caja. */
  fran: number;
  primo: number;
  /** Lo que se le debe a la caja. Informativo: no se cobra aqui, ver abajo. */
  deuda: number;
  /** Efectivo del dia que NO sale de la caja. */
  seQuedaEnCaja: number;
};

/**
 * Se paga todo y se reparte lo que queda. En ese orden, que es como se opera con la mano:
 *
 *   1. la utilidad ya trae restados los gastos del dia (el corte la calculo)
 *   2. de ahi se aparta la gasolina y el gas
 *   3. lo que sobra se parte a la mitad, y cada mitad se va al sobre de su dueño
 *
 * El apartado sale ANTES de repartir, o sea que lo pagan los dos. Antes salia solo del lado de
 * Fran —Primo cobraba su mitad completa y Fran financiaba la gasolina— y eso no es mitad y
 * mitad. Un dia de 360 con 154 de te daba 0 para Fran y 103 para Primo; ahora da 60.50 y 60.50.
 *
 * La deuda NO se cobra aqui, y esa es la otra correccion. Sacar 154 del fondo para comprar el
 * te y capturar el gasto de 154 es el MISMO peso: el gasto ya bajo la utilidad de los dos, y el
 * fondo se rellena solo con el efectivo que la caja retiene. Restar ademas una linea de
 * "reponer" cobraba el gasto una segunda vez, y completa, a Fran. Se asume que todo prestamo
 * termina en un gasto capturado, que es como se opera: los gastos se cubren con el fondo.
 *
 * En un dia malo el repartible es negativo y los dos sobres bajan. Nadie pone dinero de su
 * bolsa: el faltante se queda registrado en el sobre de cada quien y se cobra solo el dia que
 * vuelve a haber utilidad. Por eso Fran necesita sobre igual que Primo — sin el, su parte del
 * mal dia se evaporaba y terminaba absorbiendola completa.
 */
export function planCaja(entrada: {
  utilidad: number;
  tasas: Tasas;
  huboVentas: boolean;
  /** Solo para mostrarla. El plan no la cobra. */
  deuda: number;
}): PlanCaja {
  let disponible = Math.max(0, entrada.utilidad);

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

  const repartible = entrada.utilidad - totalApartado;
  const primo = Math.trunc(repartible / 2);
  const fran = repartible - primo;

  return {
    apartados,
    totalApartado,
    repartible,
    fran,
    primo,
    deuda: entrada.deuda,
    seQuedaEnCaja: totalApartado + primo,
  };
}

/**
 * Los movimientos que genera cerrar un corte: el apartado del dia y la mitad de cada socio.
 *
 * Los ids se derivan de la fecha del corte, no del reloj: cerrar dos veces la misma fecha
 * —que la app ya no permite, pero aqui no se confia en eso— no puede apartar el doble.
 *
 * Sacar el dinero de su sobre NO se genera aqui: eso lo captura cada quien el dia que cobra,
 * porque cobrar es una decision y no una consecuencia de cerrar el corte.
 */
export function movimientosDeCierre(entrada: {
  fecha: string;
  ts: string;
  device: string;
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

  // Un repartible negativo le baja el acumulado a los dos: el mal dia tambien es de los dos.
  // Ese es justo el registro que faltaba cuando Fran no tenia sobre.
  for (const sobre of SOBRES_SOCIOS) {
    const centavos = sobre === 'fran' ? entrada.plan.fran : entrada.plan.primo;
    if (centavos === 0) continue;
    movimientos.push({
      ...base,
      id: `caja-${entrada.fecha}-${sobre}`,
      tipo: 'apartado',
      sobre,
      centavos,
      concepto: `Mitad del ${fechaLegible(entrada.fecha)}`,
    });
  }

  return movimientos;
}

// ---------- el efectivo con el que se paga un gasto ----------

/**
 * De donde sale el dinero para pagar un gasto, en orden: primero el fondo y, si no alcanza, lo
 * apartado para gasolina. Es la regla del negocio tal cual se opera.
 */
export const ORDEN_PARA_GASTOS: readonly Sobre[] = ['fondo', 'gasolina'];

/**
 * Reparte un gasto entre los sobres que pueden pagarlo, sin sacar de ninguno mas de lo que
 * tiene.
 *
 * Lo que no alcance a cubrirse NO se registra: si el fondo y la gasolina estan vacios, ese
 * dinero salio de la venta del dia o de la bolsa de alguien, no de la caja, y anotarlo aqui
 * inventaria efectivo que la caja nunca tuvo. El gasto igual cuenta completo en el corte, que
 * es lo que decide la utilidad.
 */
export function origenDelGasto(
  estado: EstadoCaja,
  centavos: number
): { sobre: Sobre; centavos: number }[] {
  const salida: { sobre: Sobre; centavos: number }[] = [];
  let restante = centavos;
  for (const sobre of ORDEN_PARA_GASTOS) {
    if (restante <= 0) break;
    const saldo = estado.sobres.find((s) => s.sobre === sobre);
    const disponible = Math.max(0, saldo?.hay ?? 0);
    const toma = Math.min(disponible, restante);
    if (toma <= 0) continue;
    salida.push({ sobre, centavos: toma });
    restante -= toma;
  }
  return salida;
}

/** El prefijo del id ata el movimiento a su linea de gasto: quitar el gasto quita el movimiento. */
function idDeGasto(gastoId: string, sobre: Sobre): string {
  return `caja-gasto-${gastoId}-${sobre}`;
}

/**
 * Los movimientos que escribe capturar un gasto en el corte. Salen del fondo, asi que dejan
 * deuda: el gasto ya bajo la utilidad de los dos y la caja se rellena sola con el efectivo que
 * retiene al cerrar.
 *
 * Nacen sellados a proposito. No son capturas sueltas sino el reflejo de una linea del corte:
 * se corrigen borrando o reescribiendo el gasto, que es de donde salieron. Dejarlos editables
 * por su lado permitiria que el corte y la caja dijeran cosas distintas del mismo peso.
 */
export function movimientosDeGasto(entrada: {
  gastoId: string;
  concepto: string;
  ts: string;
  fecha: string;
  device: string;
  origen: readonly { sobre: Sobre; centavos: number }[];
}): MovimientoCaja[] {
  return entrada.origen.map((parte) => ({
    id: idDeGasto(entrada.gastoId, parte.sobre),
    ts: entrada.ts,
    fecha: entrada.fecha,
    device: entrada.device,
    tipo: 'prestamo' as const,
    sobre: parte.sobre,
    centavos: -parte.centavos,
    concepto: entrada.concepto,
  }));
}

/** Quita los movimientos de una linea de gasto borrada. */
export function sinMovimientosDeGasto(
  movimientos: readonly MovimientoCaja[],
  gastoId: string
): MovimientoCaja[] {
  const suyos = new Set(ORDEN_PARA_GASTOS.map((sobre) => idDeGasto(gastoId, sobre)));
  return movimientos.filter((m) => !suyos.has(m.id));
}

// ---------- el cierre del domingo ----------

/**
 * Lo que se ejecuta el domingo: se carga gasolina, se le paga a Mama Juani el gas, se le paga
 * su sueldo a Primo y los sobres quedan en cero para volver a llenarse la semana que entra.
 *
 * El fondo y el cambio NO se tocan aqui: la deuda se abona en cada corte del dia, asi que para
 * el domingo ya suelen estar completos. Si algo falta, el plan lo dice y se arrastra.
 */
export type PlanSemana = {
  /** Lo que se paga de cada sobre: exactamente el efectivo que trae, no lo que deberia traer. */
  pagos: { sobre: Sobre; centavos: number }[];
  total: number;
  /** Lo que la caja sigue debiendo despues de pagar. Cero cuando la semana cerro limpia. */
  deuda: number;
};

/**
 * Se paga lo que HAY, no el objetivo. Si entre semana se tomaron prestados 18 de la gasolina,
 * el domingo solo hay para cargar lo que quedo; el objetivo baja con el pago y los 18 siguen
 * apareciendo como deuda hasta que se repongan. No se inventa dinero que no esta en la caja.
 */
export function planSemana(estado: EstadoCaja): PlanSemana {
  const pagos: { sobre: Sobre; centavos: number }[] = [];
  for (const sobre of SOBRES_DE_PAGO) {
    const saldo = estado.sobres.find((s) => s.sobre === sobre);
    if (saldo === undefined || saldo.hay <= 0) continue;
    pagos.push({ sobre, centavos: saldo.hay });
  }
  return {
    pagos,
    total: pagos.reduce((t, p) => t + p.centavos, 0),
    deuda: estado.deuda,
  };
}

/**
 * Los movimientos que escribe cerrar la semana. Como en el cierre del dia, los ids se derivan
 * de la fecha y no del reloj: repetir el cierre del mismo domingo no puede pagar dos veces.
 * Nacen sellados, porque un pago ya hecho no se edita.
 */
export function movimientosDeSemana(entrada: {
  fecha: string;
  ts: string;
  device: string;
  plan: PlanSemana;
}): MovimientoCaja[] {
  const base = { ts: entrada.ts, fecha: entrada.fecha, device: entrada.device };
  return entrada.plan.pagos.map((pago) => ({
    ...base,
    id: `caja-semana-${entrada.fecha}-pago-${pago.sobre}`,
    tipo: 'pago' as const,
    sobre: pago.sobre,
    centavos: -pago.centavos,
    concepto: `Pago del ${fechaLegible(entrada.fecha)}`,
  }));
}

// ---------- arqueo: contar el bulto contra el libro ----------

export type Arqueo = {
  /** Lo que Fran conto con la mano. */
  contado: number;
  /** Lo que la caja dice que deberia haber. */
  calculado: number;
  /** contado - calculado. Negativo = falta dinero, positivo = sobra. */
  diferencia: number;
};

export function arquear(estado: EstadoCaja, contado: number): Arqueo {
  return { contado, calculado: estado.hay, diferencia: contado - estado.hay };
}

/**
 * El movimiento que cuadra un arqueo que no dio. No hace falta un tipo nuevo: un faltante se
 * comporta igual que dinero que salio sin registrarse —queda como deuda a la caja, y el corte
 * del dia la va reponiendo— y un sobrante igual que dinero devuelto.
 *
 * Va sellado: el arqueo es una foto de un conteo que ya se hizo, no un borrador.
 */
export function movimientoDeArqueo(entrada: {
  id: string;
  ts: string;
  fecha: string;
  device: string;
  sobre: Sobre;
  diferencia: number;
}): MovimientoCaja | null {
  if (entrada.diferencia === 0) return null;
  return {
    id: entrada.id,
    ts: entrada.ts,
    fecha: entrada.fecha,
    device: entrada.device,
    tipo: tipoDeMovimiento(entrada.diferencia < 0 ? -1 : 1),
    sobre: entrada.sobre,
    centavos: entrada.diferencia,
    concepto: `Arqueo del ${fechaLegible(entrada.fecha)}`,
  };
}

// ---------- lo que se le suma a la utilidad para contar el bulto ----------

/**
 * El efectivo que la caja traia al EMPEZAR el dia, menos lo que salio hoy sin que ningun gasto
 * del corte lo respalde.
 *
 * Con el saldo de ahora la cuenta se cae: si hoy se sacaron 200 del fondo para pagar unas
 * botellas de 218, esos 200 ya bajaron el saldo de la caja Y ademas van dentro del gasto de
 * 218, asi que se restarian dos veces y el bulto pareceria tener 200 de menos.
 *
 * La unica salida que si hay que restar aparte es el sueldo de Primo: su mitad ya salio de la
 * utilidad el dia que se gano, asi que pagarsela mueve efectivo sin volver a costar. La
 * gasolina y el gas no entran aqui porque el dia que se pagan tambien se capturan como gasto.
 *
 * Se asume que todo prestamo termina en un gasto del negocio, que es como se opera: los gastos
 * se cubren con el fondo y, si no alcanza, con lo apartado para gasolina.
 */
export function cajaParaEsperado(
  movimientos: readonly MovimientoCaja[],
  fecha: string
): number {
  const alAbrir = estadoCaja(movimientos.filter((m) => m.fecha < fecha)).hay;
  const sueldoPagadoHoy = movimientos
    .filter((m) => m.fecha === fecha && m.tipo === 'pago' && m.sobre === 'primo')
    .reduce((total, m) => total + m.centavos, 0);
  return alAbrir + sueldoPagadoHoy;
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
  const { id, ts, fecha, device, tipo, sobre, centavos, concepto, abierto } = valor as Record<
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
  const base = {
    id,
    ts,
    fecha,
    device,
    tipo: tipo as TipoMovimiento,
    sobre: sobre as Sobre,
    centavos,
    concepto,
  };
  // Cualquier cosa que no sea true exactamente cuenta como sellado: ante un dato dudoso se
  // prefiere no dejar editable algo que ya podria estar dentro de un corte cerrado.
  return abierto === true ? { ...base, abierto: true } : base;
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
