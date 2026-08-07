import type { AppEvent } from './tipos';
import { LARGO_MAXIMO_TEXTO, claveFecha, fechaLegible, totalPiezas, ventasActivas } from './dominio';

/**
 * Corte de caja del dia. Solo LEE los eventos del registro de ventas: nunca los modifica,
 * ni los migra, ni los reescribe. Escribe unicamente en sus propias claves.
 *
 * Todo el dinero se maneja en centavos enteros. Nunca floats: 0.1 + 0.2 no es 0.3, y aqui
 * el error no es academico, es un peso que no le cuadra a alguien al final de la semana.
 */

// ---------- constantes de negocio ----------

/** Precios de fabrica. Se pueden cambiar en la vista Corte y quedan congelados en cada cierre. */
export const PRECIO_CALLE = 2000;
export const PRECIO_MAYOREO = 1400;

/**
 * Fondos rotatorios de la caja, en centavos. NO son gastos ni se restan del reparto:
 * el cambio sale en morralla y regresa dentro del efectivo de las ventas, asi que restarlo
 * seria contarlo dos veces. Solo aparecen como la linea de verificacion "deja esto en la caja".
 *
 * Son la base de los sobres 'fondo' y 'cambio' de caja.ts, que lleva el resto de la tesoreria.
 */
export const FONDO_GASTO = 20000;
export const FONDO_CAMBIO = 12000;
export const FONDO_CAJA = FONDO_GASTO + FONDO_CAMBIO;

/** Tope defensivo de captura: 100,000.00 pesos. Arriba de esto es un dedazo, no un gasto. */
export const MONTO_MAXIMO = 10000000;

// ---------- tipos ----------

export type Precios = {
  /** Centavos por pieza vendida en la calle. */
  calle: number;
  /** Centavos por pieza vendida a mayoreo. */
  mayoreo: number;
};

export type LineaGasto = {
  id: string;
  concepto: string;
  /** Centavos, siempre positivo: es lo que salio de la caja. */
  centavos: number;
};

/**
 * Adeudos y compensaciones: la mecanica formal llega en v2. En v1 el arreglo siempre va vacio.
 * Existe desde ahora para que agregarlas sea empujar objetos a un arreglo que ya esta escrito
 * en cada corte guardado, no una migracion sobre cortes cerrados que son inmutables.
 * Signo libre: un adeudo resta, una compensacion suma.
 */
export type LineaAjuste = {
  id: string;
  concepto: string;
  centavos: number;
};

export type IngresoCanal = {
  piezas: number;
  centavos: number;
};

export type Ingreso = {
  calle: IngresoCanal;
  mayoreo: IngresoCanal;
  total: number;
};

export type Reparto = {
  ingreso: number;
  gastos: number;
  /**
   * Congelado en 0 desde que la caja se lleva en sobres (caja.ts). Se conserva en el tipo
   * porque los cortes ya cerrados lo traen con valor y son inmutables: se leen tal cual.
   */
  reponerCaja: number;
  ajustes: number;
  utilidad: number;
  fran: number;
  primo: number;
};

/** El corte del dia mientras se captura. Editable hasta que se cierra. */
export type Borrador = {
  fecha: string;
  gastos: LineaGasto[];
};

/** Como estaba la caja en el momento de cerrar. null en los cortes anteriores a los sobres. */
export type CajaAlCerrar = {
  /** Efectivo que debia quedar en la caja despues del cierre. */
  hay: number;
  /** Lo que seguia debiendosele a la caja. */
  deuda: number;
};

/**
 * Corte cerrado: registro inmutable. No se edita ni se borra; un corte que salio mal se
 * compensa en uno futuro. Guarda el snapshot completo (piezas y precios del momento), no una
 * referencia a las ventas: si manana se anula una venta de ayer, el corte de ayer no se mueve.
 */
export type CorteCerrado = {
  version: 1;
  fecha: string;
  cerradoEn: string;
  device: string;
  precios: Precios;
  ingreso: Ingreso;
  gastos: LineaGasto[];
  reponerCaja: number;
  ajustes: LineaAjuste[];
  fondo: { gasto: number; cambio: number };
  /** Snapshot de la caja al cerrar. null en los cortes cerrados antes de que existieran los sobres. */
  caja: CajaAlCerrar | null;
  /** Congelado, no derivado en lectura: cambiar la formula manana no puede mover un corte de ayer. */
  reparto: Reparto;
};

export const PRECIOS_INICIALES: Precios = { calle: PRECIO_CALLE, mayoreo: PRECIO_MAYOREO };

export function borradorVacio(fecha: string): Borrador {
  return { fecha, gastos: [] };
}

// ---------- dinero: formato y captura ----------

/** '1,234.50' / '-85.00'. Sin simbolo: quien llama decide si antepone el $. */
export function pesos(centavos: number): string {
  const redondeado = Math.round(centavos);
  const signo = redondeado < 0 ? '-' : '';
  const absoluto = Math.abs(redondeado);
  const enteros = Math.floor(absoluto / 100);
  const decimales = absoluto % 100;
  const conSeparador = String(enteros).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${signo}${conSeparador}.${decimales < 10 ? '0' : ''}${decimales}`;
}

/** '$1,234.50'. */
export function importe(centavos: number): string {
  return `$${pesos(centavos)}`;
}

/**
 * Texto capturado a centavos. Acepta '45', '45.5', '45,50' y espacios; la coma decimal es
 * lo que sale del teclado de un telefono en español. null = no es un monto usable.
 * Se parsea por partes en vez de multiplicar por 100: Number('45.55') * 100 da 4554.9999.
 */
export function centavosDesde(texto: string): number | null {
  // Solo se recortan los extremos: borrar un espacio de en medio convertiria '4 5' en 45.
  const limpio = texto.trim().replace(',', '.');
  if (limpio === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;

  const partes = limpio.split('.');
  const enteros = Number(partes[0]);
  const decimales = Number(`${partes[1] ?? ''}00`.slice(0, 2));
  const centavos = enteros * 100 + decimales;
  return centavos > MONTO_MAXIMO ? null : centavos;
}

// ---------- ingreso: se calcula, no se captura ----------

/**
 * Lo que entro ese dia segun el registro de ventas, a los precios vigentes.
 * Usa ventasActivas: una venta anulada no entra, igual que en el resto de la app.
 */
export function ingresoDeFecha(
  eventos: readonly AppEvent[],
  fecha: string,
  precios: Precios
): Ingreso {
  const delDia = ventasActivas(eventos).filter((v) => claveFecha(v.ts) === fecha);
  const piezasCalle = totalPiezas(delDia.filter((v) => v.channel === 'calle'));
  const piezasMayoreo = totalPiezas(delDia.filter((v) => v.channel === 'mayoreo'));

  const calle: IngresoCanal = { piezas: piezasCalle, centavos: piezasCalle * precios.calle };
  const mayoreo: IngresoCanal = {
    piezas: piezasMayoreo,
    centavos: piezasMayoreo * precios.mayoreo,
  };
  return { calle, mayoreo, total: calle.centavos + mayoreo.centavos };
}

// ---------- aritmetica del corte ----------

function sumar(lineas: readonly { centavos: number }[]): number {
  return lineas.reduce((total, l) => total + l.centavos, 0);
}

/**
 * utilidad = ingreso - gastos (+ ajustes de v2).
 *
 * Nada de la caja se resta aqui. Los fondos son rotatorios, no costos. Y reponer la caja
 * tampoco es un costo: es devolver efectivo prestado, y lo que se compro con ese efectivo ya
 * bajo la utilidad el dia que se compro. Restarlo otra vez al reponer cobraba el mismo gasto
 * dos veces —el error que ya se habia corregido con el fondo y el cambio, escondido en otra
 * linea—. La tesoreria de la caja vive completa en caja.ts y no toca este numero.
 *
 * El reparto es mitad y mitad. El centavo impar se lo queda Fran, que es quien trae la caja:
 * en una utilidad positiva le toca de mas y en una negativa absorbe de mas, siempre igual.
 */
export function calcularReparto(
  ingreso: number,
  gastos: readonly LineaGasto[],
  ajustes: readonly LineaAjuste[] = []
): Reparto {
  const totalGastos = sumar(gastos);
  const totalAjustes = sumar(ajustes);
  const utilidad = ingreso - totalGastos + totalAjustes;
  const primo = Math.trunc(utilidad / 2);

  return {
    ingreso,
    gastos: totalGastos,
    reponerCaja: 0,
    ajustes: totalAjustes,
    utilidad,
    fran: utilidad - primo,
    primo,
  };
}

export function repartoDeBorrador(borrador: Borrador, ingreso: Ingreso): Reparto {
  return calcularReparto(ingreso.total, borrador.gastos);
}

/**
 * Lo que debe haber en efectivo al cerrar, antes de repartir: lo que traia la caja al abrir
 * mas la utilidad del dia. Fran cuenta el dinero y lo compara.
 *
 * `enCaja` es el efectivo real de los sobres al abrir (caja.ts), no el fondo teorico: si ayer
 * quedo debiendo, hoy hay menos en la caja y esperar los 320 completos seria mentir.
 */
export function efectivoEsperado(reparto: Reparto, enCaja = FONDO_CAJA): number {
  return enCaja + reparto.utilidad;
}

// ---------- cierre ----------

export function cerrarCorte(entrada: {
  borrador: Borrador;
  ingreso: Ingreso;
  precios: Precios;
  device: string;
  cerradoEn: string;
  /** Como quedo la caja despues de aplicar los movimientos del cierre. */
  caja?: CajaAlCerrar;
}): CorteCerrado {
  return {
    version: 1,
    fecha: entrada.borrador.fecha,
    cerradoEn: entrada.cerradoEn,
    device: entrada.device,
    precios: { ...entrada.precios },
    ingreso: {
      calle: { ...entrada.ingreso.calle },
      mayoreo: { ...entrada.ingreso.mayoreo },
      total: entrada.ingreso.total,
    },
    gastos: entrada.borrador.gastos.map((g) => ({ ...g })),
    reponerCaja: 0,
    ajustes: [],
    fondo: { gasto: FONDO_GASTO, cambio: FONDO_CAMBIO },
    caja: entrada.caja === undefined ? null : { ...entrada.caja },
    reparto: repartoDeBorrador(entrada.borrador, entrada.ingreso),
  };
}

export function corteDeFecha(
  cortes: readonly CorteCerrado[],
  fecha: string
): CorteCerrado | null {
  return cortes.find((c) => c.fecha === fecha) ?? null;
}

/**
 * Un corte por fecha, y el cerrado nunca se pisa. null = ya habia uno; el que llama no debe
 * insistir. La regla vive aqui y no solo en la UI: es la que protege el historico.
 */
export function agregarCorte(
  cortes: readonly CorteCerrado[],
  corte: CorteCerrado
): CorteCerrado[] | null {
  if (corteDeFecha(cortes, corte.fecha) !== null) return null;
  return [...cortes, corte].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ---------- borradores ----------

export function borradorDe(borradores: readonly Borrador[], fecha: string): Borrador {
  return borradores.find((b) => b.fecha === fecha) ?? borradorVacio(fecha);
}

/** Reemplaza el borrador de esa fecha, o lo agrega. Un borrador sin nada capturado no se guarda. */
export function guardarBorrador(
  borradores: readonly Borrador[],
  borrador: Borrador
): Borrador[] {
  const otros = borradores.filter((b) => b.fecha !== borrador.fecha);
  return borrador.gastos.length === 0 ? otros : [...otros, borrador];
}

export function nuevaLinea(concepto: string, centavos: number, semilla: string): LineaGasto {
  return { id: semilla, concepto: concepto.trim(), centavos };
}

export function conGasto(borrador: Borrador, gasto: LineaGasto): Borrador {
  return { ...borrador, gastos: [...borrador.gastos, gasto] };
}

export function sinGasto(borrador: Borrador, id: string): Borrador {
  return { ...borrador, gastos: borrador.gastos.filter((g) => g.id !== id) };
}

// ---------- validacion defensiva de lo guardado ----------

function textoValido(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length > 0 && valor.length <= LARGO_MAXIMO_TEXTO;
}

function fechaValida(valor: unknown): valor is string {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

/** Entero de centavos dentro de un rango sano. Rechaza NaN, Infinity y decimales. */
function centavosValidos(valor: unknown, minimo: number): valor is number {
  return (
    typeof valor === 'number' &&
    Number.isInteger(valor) &&
    valor >= minimo &&
    Math.abs(valor) <= MONTO_MAXIMO
  );
}

function validarLinea(valor: unknown, minimo: number): LineaGasto | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return null;
  const { id, concepto, centavos } = valor as Record<string, unknown>;
  if (!textoValido(id) || !textoValido(concepto) || !centavosValidos(centavos, minimo)) return null;
  return { id, concepto, centavos };
}

/** Las lineas ilegibles se descartan una por una: un gasto raro no tira el corte entero. */
function validarLineas(valor: unknown, minimo: number): LineaGasto[] {
  if (!Array.isArray(valor)) return [];
  const lineas: LineaGasto[] = [];
  for (const item of valor) {
    const linea = validarLinea(item, minimo);
    if (linea !== null) lineas.push(linea);
  }
  return lineas;
}

export function validarPrecios(valor: unknown): Precios {
  if (typeof valor !== 'object' || valor === null) return { ...PRECIOS_INICIALES };
  const { calle, mayoreo } = valor as Record<string, unknown>;
  return {
    calle: centavosValidos(calle, 1) ? calle : PRECIO_CALLE,
    mayoreo: centavosValidos(mayoreo, 1) ? mayoreo : PRECIO_MAYOREO,
  };
}

/** El 'reponerCaja' de los borradores viejos se ignora: ese monto ahora vive en caja.ts. */
export function validarBorrador(valor: unknown): Borrador | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return null;
  const { fecha, gastos } = valor as Record<string, unknown>;
  if (!fechaValida(fecha)) return null;
  return { fecha, gastos: validarLineas(gastos, 1) };
}

function validarCanal(valor: unknown): IngresoCanal | null {
  if (typeof valor !== 'object' || valor === null) return null;
  const { piezas, centavos } = valor as Record<string, unknown>;
  if (typeof piezas !== 'number' || !Number.isInteger(piezas) || piezas < 0) return null;
  if (!centavosValidos(centavos, 0)) return null;
  return { piezas, centavos };
}

function validarReparto(valor: unknown): Reparto | null {
  if (typeof valor !== 'object' || valor === null) return null;
  const campos = valor as Record<string, unknown>;
  const nombres = ['ingreso', 'gastos', 'reponerCaja', 'ajustes', 'utilidad', 'fran', 'primo'];
  for (const nombre of nombres) {
    const n = campos[nombre];
    if (typeof n !== 'number' || !Number.isInteger(n) || Math.abs(n) > MONTO_MAXIMO) return null;
  }
  return {
    ingreso: campos['ingreso'] as number,
    gastos: campos['gastos'] as number,
    reponerCaja: campos['reponerCaja'] as number,
    ajustes: campos['ajustes'] as number,
    utilidad: campos['utilidad'] as number,
    fran: campos['fran'] as number,
    primo: campos['primo'] as number,
  };
}

/** Ausente o ilegible = corte anterior a los sobres: se lee sin snapshot de caja, no se inventa. */
function validarCajaAlCerrar(valor: unknown): CajaAlCerrar | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return null;
  const { hay, deuda } = valor as Record<string, unknown>;
  if (!centavosValidos(hay, -MONTO_MAXIMO) || !centavosValidos(deuda, -MONTO_MAXIMO)) return null;
  return { hay, deuda };
}

/**
 * Un corte cerrado se lee tal como se escribio o no se lee. No se recalcula nada al leer:
 * recalcular es justamente lo que un registro inmutable no debe permitir.
 */
export function validarCorte(valor: unknown): CorteCerrado | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return null;
  const campos = valor as Record<string, unknown>;
  if (campos['version'] !== 1) return null;
  if (!fechaValida(campos['fecha'])) return null;
  if (!textoValido(campos['cerradoEn']) || !textoValido(campos['device'])) return null;

  const ingresoBruto = campos['ingreso'];
  if (typeof ingresoBruto !== 'object' || ingresoBruto === null) return null;
  const { calle, mayoreo, total } = ingresoBruto as Record<string, unknown>;
  const canalCalle = validarCanal(calle);
  const canalMayoreo = validarCanal(mayoreo);
  if (canalCalle === null || canalMayoreo === null || !centavosValidos(total, 0)) return null;

  const reparto = validarReparto(campos['reparto']);
  if (reparto === null) return null;

  const fondoBruto = campos['fondo'];
  const fondo =
    typeof fondoBruto === 'object' && fondoBruto !== null
      ? (fondoBruto as Record<string, unknown>)
      : {};
  const gasto = fondo['gasto'];
  const cambio = fondo['cambio'];

  return {
    caja: validarCajaAlCerrar(campos['caja']),
    version: 1,
    fecha: campos['fecha'],
    cerradoEn: campos['cerradoEn'],
    device: campos['device'],
    precios: validarPrecios(campos['precios']),
    ingreso: { calle: canalCalle, mayoreo: canalMayoreo, total },
    gastos: validarLineas(campos['gastos'], 1),
    reponerCaja: centavosValidos(campos['reponerCaja'], 0) ? campos['reponerCaja'] : 0,
    ajustes: validarLineas(campos['ajustes'], -MONTO_MAXIMO),
    fondo: {
      gasto: centavosValidos(gasto, 0) ? gasto : FONDO_GASTO,
      cambio: centavosValidos(cambio, 0) ? cambio : FONDO_CAMBIO,
    },
    reparto,
  };
}

// ---------- resumen copiable ----------

/**
 * Texto plano para pegar en notas o en el chat. Sin alineacion por espacios: en WhatsApp la
 * fuente es proporcional y una tabla ASCII llega chueca.
 */
export function resumenCorte(corte: CorteCerrado): string {
  const { ingreso, reparto, precios, fondo } = corte;
  const lineas: string[] = [`Corte ${fechaLegible(corte.fecha)}`, ''];

  lineas.push(
    `Calle: ${ingreso.calle.piezas} × ${importe(precios.calle)} = ${importe(ingreso.calle.centavos)}`
  );
  if (ingreso.mayoreo.piezas > 0) {
    lineas.push(
      `Mayoreo: ${ingreso.mayoreo.piezas} × ${importe(precios.mayoreo)} = ${importe(ingreso.mayoreo.centavos)}`
    );
  }
  lineas.push(`Ingreso: ${importe(ingreso.total)}`, '');

  lineas.push(`Gastos: ${importe(reparto.gastos)}`);
  for (const g of corte.gastos) lineas.push(`- ${g.concepto}: ${importe(g.centavos)}`);
  if (reparto.reponerCaja > 0) lineas.push(`Reponer caja: ${importe(reparto.reponerCaja)}`);
  for (const a of corte.ajustes) lineas.push(`Ajuste ${a.concepto}: ${importe(a.centavos)}`);
  lineas.push('');

  lineas.push(`Utilidad: ${importe(reparto.utilidad)}`);
  lineas.push(`Fran: ${importe(reparto.fran)}`);
  lineas.push(`Primo: ${importe(reparto.primo)}`);
  lineas.push('');

  if (corte.caja === null) {
    // Corte anterior a los sobres: la unica verdad que guardo fue el fondo teorico.
    const total = fondo.gasto + fondo.cambio;
    lineas.push(
      `Caja: dejar ${importe(total)} (${pesos(fondo.gasto)} gasto + ${pesos(fondo.cambio)} cambio)`
    );
    lineas.push(`Efectivo esperado al cerrar: ${importe(efectivoEsperado(reparto, total))}`);
  } else {
    lineas.push(`Caja: dejar ${importe(corte.caja.hay)}`);
    if (corte.caja.deuda > 0) lineas.push(`Debemos a la caja: ${importe(corte.caja.deuda)}`);
  }
  return lineas.join('\n');
}
