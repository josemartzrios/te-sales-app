import type { AppEvent, Settings } from './tipos';
import { nuevoDeviceId, planRespaldo, validarAjustes, validarEvento } from './dominio';

// Unico modulo que toca localStorage. Cambiar a sync remoto se hace aqui adentro.

const CLAVE_EVENTOS = 'refreskte:eventos:v1';
const CLAVE_AJUSTES = 'refreskte:ajustes:v1';
/** Respaldo previo a la llegada de los eventos 'load'. Se escribe una vez y no se pisa. */
const CLAVE_RESPALDO = 'rk_ventas_backup_v1';

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
