import type { AppEvent, Settings } from './tipos';
import type { Borrador, CorteCerrado, Precios } from './corte';
import type { MovimientoCaja, Tasas } from './caja';
import { nuevoDeviceId, planRespaldo, validarAjustes, validarEvento } from './dominio';
import { PRECIOS_INICIALES, validarBorrador, validarCorte, validarPrecios } from './corte';
import { TASAS_INICIALES, validarMovimiento, validarTasas } from './caja';

// Unico modulo que toca localStorage. Cambiar a sync remoto se hace aqui adentro.

const CLAVE_EVENTOS = 'refreskte:eventos:v1';
const CLAVE_AJUSTES = 'refreskte:ajustes:v1';
/** Respaldo previo a la llegada de los eventos 'load'. Se escribe una vez y no se pisa. */
const CLAVE_RESPALDO = 'rk_ventas_backup_v1';

// Claves del corte de caja. Prefijo propio: el corte jamas escribe sobre las de arriba.
const CLAVE_CORTES = 'refreskte:cortes:v1';
const CLAVE_BORRADORES = 'refreskte:cortes-borrador:v1';
const CLAVE_PRECIOS = 'refreskte:corte-precios:v1';

// Claves de la caja (sobres y movimientos). Tambien propias: no pisan nada de lo anterior.
const CLAVE_CAJA = 'refreskte:caja:v1';
const CLAVE_TASAS = 'refreskte:caja-tasas:v1';

export type Lectura<T> = { datos: T; aviso: string | null };

function leerCrudo(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

/** Copia el valor ilegible a otra clave antes de que un guardado futuro lo pise. */
function respaldar(clave: string, crudo: string): void {
  try {
    localStorage.setItem(`${clave}:corrupto:${Date.now()}`, crudo);
  } catch {
    // Si no cabe el respaldo, seguimos: el original tampoco se borra.
  }
}

function escribir(clave: string, valor: unknown): string | null {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return null;
  } catch (error) {
    const nombre = error instanceof Error ? error.name : '';
    return nombre === 'QuotaExceededError' || nombre === 'NS_ERROR_DOM_QUOTA_REACHED'
      ? 'Almacenamiento lleno: exporta e importa en otro dispositivo. El ultimo registro NO se guardo.'
      : 'No se pudo guardar en este dispositivo. El ultimo registro NO se guardo.';
  }
}

/**
 * Copia intacta de los eventos ya capturados antes de que esta version escriba encima.
 * Corre en cada arranque pero solo hace algo la primera vez; escribir el respaldo nunca
 * es condicion para operar: si falla, la app sigue y los datos originales siguen ahi.
 */
export function migrar(): void {
  const copia = planRespaldo(leerCrudo(CLAVE_EVENTOS), leerCrudo(CLAVE_RESPALDO));
  if (copia === null) return;
  try {
    localStorage.setItem(CLAVE_RESPALDO, copia);
  } catch {
    // Sin espacio para el respaldo no se bloquea la captura: el original no se toca.
  }
}

/** El respaldo crudo, para poder descargarlo y volver atras. null si nunca hubo que migrar. */
export function leerRespaldo(): string | null {
  return leerCrudo(CLAVE_RESPALDO);
}

export function leerEventos(): Lectura<AppEvent[]> {
  const crudo = leerCrudo(CLAVE_EVENTOS);
  if (crudo === null) return { datos: [], aviso: null };

  let valor: unknown;
  try {
    valor = JSON.parse(crudo);
  } catch {
    respaldar(CLAVE_EVENTOS, crudo);
    return { datos: [], aviso: 'Datos guardados ilegibles. Se respaldaron; no se borro nada.' };
  }
  if (!Array.isArray(valor)) {
    respaldar(CLAVE_EVENTOS, crudo);
    return { datos: [], aviso: 'Datos guardados con formato raro. Se respaldaron; no se borro nada.' };
  }

  const datos: AppEvent[] = [];
  let descartados = 0;
  for (const item of valor) {
    const evento = validarEvento(item);
    if (evento === null) descartados++;
    else datos.push(evento);
  }
  if (descartados > 0) respaldar(CLAVE_EVENTOS, crudo);
  return {
    datos,
    aviso: descartados > 0 ? `${descartados} evento(s) guardados no se pudieron leer.` : null,
  };
}

export function escribirEventos(eventos: readonly AppEvent[]): string | null {
  return escribir(CLAVE_EVENTOS, eventos);
}

export function leerAjustes(): Lectura<Settings> {
  const crudo = leerCrudo(CLAVE_AJUSTES);
  if (crudo === null) return { datos: validarAjustes(null, nuevoDeviceId()), aviso: null };
  try {
    return { datos: validarAjustes(JSON.parse(crudo), nuevoDeviceId()), aviso: null };
  } catch {
    respaldar(CLAVE_AJUSTES, crudo);
    return { datos: validarAjustes(null, nuevoDeviceId()), aviso: 'Ajustes ilegibles: se usaron los de fabrica.' };
  }
}

export function escribirAjustes(ajustes: Settings): string | null {
  return escribir(CLAVE_AJUSTES, ajustes);
}

// ---------- corte de caja ----------

/**
 * Lee un arreglo validando linea por linea, con el mismo trato defensivo que los eventos:
 * ante JSON ilegible arranca vacio, respalda el crudo y nunca borra nada.
 */
function leerLista<T>(clave: string, validar: (v: unknown) => T | null, que: string): Lectura<T[]> {
  const crudo = leerCrudo(clave);
  if (crudo === null) return { datos: [], aviso: null };

  let valor: unknown;
  try {
    valor = JSON.parse(crudo);
  } catch {
    respaldar(clave, crudo);
    return { datos: [], aviso: `${que} ilegibles. Se respaldaron; no se borro nada.` };
  }
  if (!Array.isArray(valor)) {
    respaldar(clave, crudo);
    return { datos: [], aviso: `${que} con formato raro. Se respaldaron; no se borro nada.` };
  }

  const datos: T[] = [];
  let descartados = 0;
  for (const item of valor) {
    const dato = validar(item);
    if (dato === null) descartados++;
    else datos.push(dato);
  }
  if (descartados > 0) respaldar(clave, crudo);
  return {
    datos,
    aviso: descartados > 0 ? `${descartados} ${que.toLocaleLowerCase()} no se pudieron leer.` : null,
  };
}

export function leerCortes(): Lectura<CorteCerrado[]> {
  return leerLista(CLAVE_CORTES, validarCorte, 'Cortes guardados');
}

export function escribirCortes(cortes: readonly CorteCerrado[]): string | null {
  return escribir(CLAVE_CORTES, cortes);
}

export function leerBorradores(): Lectura<Borrador[]> {
  return leerLista(CLAVE_BORRADORES, validarBorrador, 'Borradores de corte');
}

export function escribirBorradores(borradores: readonly Borrador[]): string | null {
  return escribir(CLAVE_BORRADORES, borradores);
}

export function leerPrecios(): Precios {
  const crudo = leerCrudo(CLAVE_PRECIOS);
  if (crudo === null) return { ...PRECIOS_INICIALES };
  try {
    return validarPrecios(JSON.parse(crudo));
  } catch {
    respaldar(CLAVE_PRECIOS, crudo);
    return { ...PRECIOS_INICIALES };
  }
}

export function escribirPrecios(precios: Precios): string | null {
  return escribir(CLAVE_PRECIOS, precios);
}

// ---------- caja ----------

export function leerMovimientos(): Lectura<MovimientoCaja[]> {
  return leerLista(CLAVE_CAJA, validarMovimiento, 'Movimientos de caja');
}

export function escribirMovimientos(movimientos: readonly MovimientoCaja[]): string | null {
  return escribir(CLAVE_CAJA, movimientos);
}

export function leerTasas(): Tasas {
  const crudo = leerCrudo(CLAVE_TASAS);
  if (crudo === null) return { ...TASAS_INICIALES };
  try {
    return validarTasas(JSON.parse(crudo));
  } catch {
    respaldar(CLAVE_TASAS, crudo);
    return { ...TASAS_INICIALES };
  }
}

export function escribirTasas(tasas: Tasas): string | null {
  return escribir(CLAVE_TASAS, tasas);
}
