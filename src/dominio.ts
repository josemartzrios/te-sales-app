import type { AppEvent, Canal, LoadEvent, SaleEvent, Settings, Vendedor, VoidEvent } from './tipos';

export const VENDEDORES: readonly Vendedor[] = ['Fran', 'Primo'];
export const CANALES: readonly Canal[] = ['calle', 'mayoreo'];
export const PUNTOS_INICIALES: readonly string[] = ['Plazuela', 'Parque Sinaloa'];
export const LARGO_MAXIMO_TEXTO = 100;
export const NOMBRE_APP = 'refreskte-ventas';

export type Barra = { etiqueta: string; valor: number };
export type Rango = 'hoy' | '7d' | 'todo';

/** Debajo de esto el tablero de Hoy marca la hielera: conviene ir pensando en recargar. */
export const HIELERA_BAJA = 10;
/** Debajo de esto la barra de Vender pinta el numero en rojo: se acaba o falta registrar carga. */
export const HIELERA_CRITICA = 3;
/** Piso del tramo para el ritmo: 3 ventas en 10 minutos no son "18 por hora". */
const MINUTOS_MINIMOS_RITMO = 60;

// ---------- identidad ----------

function aleatorio(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function nuevoDeviceId(): string {
  return `d${Date.now().toString(36)}${aleatorio()}`;
}

export function nuevoId(device: string): string {
  return `${Date.now().toString(36)}-${device}-${aleatorio()}`;
}

// ---------- fechas (siempre hora local del dispositivo) ----------

function dos(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function claveFecha(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export function horaDe(ts: string): number {
  return new Date(ts).getHours();
}

export function horaMinuto(ts: string): string {
  const d = new Date(ts);
  return `${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export function fechaLegible(clave: string): string {
  const partes = clave.split('-');
  const anio = partes[0] ?? '';
  const mes = partes[1] ?? '';
  const dia = partes[2] ?? '';
  return `${dia}/${mes}/${anio}`;
}

export function claveFechaDesplazada(base: Date, dias: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);
  return claveFecha(d);
}

/** Combina 'YYYY-MM-DD' + 'HH:MM' en un ISO local valido; null si la fecha no existe. */
export function isoDesdeFechaYHora(fecha: string, hora: string): string | null {
  const f = fecha.split('-').map(Number);
  const h = hora.split(':').map(Number);
  if (f.length !== 3 || h.length < 2) return null;
  const [anio, mes, dia] = f as [number, number, number];
  const [hh, mm] = h as [number, number];
  if ([anio, mes, dia, hh, mm].some((n) => !Number.isFinite(n))) return null;
  const d = new Date(anio, mes - 1, dia, hh, mm, 0, 0);
  if (Number.isNaN(d.getTime()) || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return isoLocal(d);
}

/** ISO 8601 con el offset local, no UTC: la hora del dia es el dato del negocio. */
export function isoLocal(d: Date): string {
  const offset = -d.getTimezoneOffset();
  const signo = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return (
    `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}` +
    `T${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}` +
    `${signo}${dos(Math.floor(abs / 60))}:${dos(abs % 60)}`
  );
}

// ---------- creacion de eventos ----------

export function crearVenta(entrada: {
  ts: string;
  point: string;
  channel: Canal;
  vendor: Vendedor;
  qty: number;
  device: string;
  retro?: boolean;
}): SaleEvent {
  const venta: SaleEvent = {
    id: nuevoId(entrada.device),
    type: 'sale',
    ts: entrada.ts,
    point: entrada.point,
    channel: entrada.channel,
    vendor: entrada.vendor,
    qty: entrada.qty,
    device: entrada.device,
  };
  return entrada.retro === true ? { ...venta, retro: true } : venta;
}

export function crearCarga(entrada: {
  ts: string;
  vendor: Vendedor;
  qty: number;
  device: string;
}): LoadEvent {
  return {
    id: nuevoId(entrada.device),
    type: 'load',
    ts: entrada.ts,
    vendor: entrada.vendor,
    qty: entrada.qty,
    device: entrada.device,
  };
}

/** null si el evento no existe o ya fue anulado: se anula una sola vez. Sirve para ventas y cargas. */
export function crearAnulacion(
  eventos: readonly AppEvent[],
  refId: string,
  device: string,
  ts: string
): VoidEvent | null {
  const existe = eventos.some((e) => e.type !== 'void' && e.id === refId);
  if (!existe || estaAnulada(eventos, refId)) return null;
  return { id: nuevoId(device), type: 'void', ts, refId, device };
}

/**
 * La venta que anularia el boton -1: la ultima de calle activa de ese punto ese dia.
 * La UI la usa para deshabilitar el boton sin repetir el criterio.
 */
export function ultimaVentaActiva(
  eventos: readonly AppEvent[],
  punto: string,
  clave: string
): SaleEvent | null {
  const candidatas = ordenarPorHora(
    ventasActivas(eventos).filter(
      (v) => v.point === punto && v.channel === 'calle' && claveFecha(v.ts) === clave
    )
  );
  return candidatas[candidatas.length - 1] ?? null;
}

/**
 * -1 es correccion, no resta: anula entera la ultima venta de calle del punto ese dia.
 * Nunca edita ni borra; si esa venta traia 3 piezas, se van las 3 y se vuelve a capturar.
 * null cuando no hay nada que anular: ahi el boton va deshabilitado.
 */
export function anularUltimaVenta(
  eventos: readonly AppEvent[],
  punto: string,
  clave: string,
  device: string,
  ts: string
): VoidEvent | null {
  const ultima = ultimaVentaActiva(eventos, punto, clave);
  if (ultima === null) return null;
  return crearAnulacion(eventos, ultima.id, device, ts);
}

// ---------- consultas ----------

export function idsAnulados(eventos: readonly AppEvent[]): Set<string> {
  const anulados = new Set<string>();
  for (const e of eventos) if (e.type === 'void') anulados.add(e.refId);
  return anulados;
}

export function estaAnulada(eventos: readonly AppEvent[], idVenta: string): boolean {
  return eventos.some((e) => e.type === 'void' && e.refId === idVenta);
}

export function ventasActivas(eventos: readonly AppEvent[]): SaleEvent[] {
  const anulados = idsAnulados(eventos);
  return eventos.filter((e): e is SaleEvent => e.type === 'sale' && !anulados.has(e.id));
}

export function cargasActivas(eventos: readonly AppEvent[]): LoadEvent[] {
  const anulados = idsAnulados(eventos);
  return eventos.filter((e): e is LoadEvent => e.type === 'load' && !anulados.has(e.id));
}

/** Todas las cargas de la fecha, anuladas incluidas: la vista Hoy las muestra tachadas. */
export function cargasDeFecha(eventos: readonly AppEvent[], clave: string): LoadEvent[] {
  const cargas = eventos.filter((e): e is LoadEvent => e.type === 'load' && claveFecha(e.ts) === clave);
  return ordenarPorHora(cargas);
}

export function ordenarPorHora<T extends { ts: string; id: string }>(eventos: readonly T[]): T[] {
  return [...eventos].sort((a, b) => {
    const d = Date.parse(a.ts) - Date.parse(b.ts);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });
}

/** Todas las ventas de la fecha, anuladas incluidas: la vista Hoy las muestra tachadas. */
export function ventasDeFecha(eventos: readonly AppEvent[], clave: string): SaleEvent[] {
  const ventas = eventos.filter((e): e is SaleEvent => e.type === 'sale' && claveFecha(e.ts) === clave);
  return ordenarPorHora(ventas);
}

export function filtrarRango(ventas: readonly SaleEvent[], rango: Rango, ahora: Date): SaleEvent[] {
  if (rango === 'todo') return [...ventas];
  const desde = rango === 'hoy' ? claveFecha(ahora) : claveFechaDesplazada(ahora, -6);
  return ventas.filter((v) => claveFecha(v.ts) >= desde);
}

export function filtrarCanal(ventas: readonly SaleEvent[], canal: Canal | 'todo'): SaleEvent[] {
  return canal === 'todo' ? [...ventas] : ventas.filter((v) => v.channel === canal);
}

export function totalPiezas(ventas: readonly SaleEvent[]): number {
  return ventas.reduce((suma, v) => suma + v.qty, 0);
}

export function totalDelDia(
  eventos: readonly AppEvent[],
  clave: string,
  punto: string,
  canal: Canal
): number {
  return totalPiezas(
    ventasActivas(eventos).filter(
      (v) => v.point === punto && v.channel === canal && claveFecha(v.ts) === clave
    )
  );
}

// ---------- agregaciones ----------

export function sumarPor(
  ventas: readonly SaleEvent[],
  clave: (v: SaleEvent) => string
): Map<string, number> {
  const conteo = new Map<string, number>();
  for (const v of ventas) {
    const k = clave(v);
    conteo.set(k, (conteo.get(k) ?? 0) + v.qty);
  }
  return conteo;
}

function descendente(a: Barra, b: Barra): number {
  return b.valor - a.valor || a.etiqueta.localeCompare(b.etiqueta);
}

/** Rango continuo entre la primera y la ultima hora con venta: las horas vacias intermedias importan. */
export function porHora(ventas: readonly SaleEvent[]): Barra[] {
  if (ventas.length === 0) return [];
  const conteo = sumarPor(ventas, (v) => String(horaDe(v.ts)));
  const horas = [...conteo.keys()].map(Number);
  const min = Math.min(...horas);
  const max = Math.max(...horas);
  const barras: Barra[] = [];
  for (let h = min; h <= max; h++) {
    barras.push({ etiqueta: `${dos(h)}:00`, valor: conteo.get(String(h)) ?? 0 });
  }
  return barras;
}

export function porPunto(ventas: readonly SaleEvent[], puntos: readonly string[]): Barra[] {
  const conteo = sumarPor(ventas, (v) => v.point);
  for (const p of puntos) if (!conteo.has(p)) conteo.set(p, 0);
  return [...conteo].map(([etiqueta, valor]) => ({ etiqueta, valor })).sort(descendente);
}

export function porVendedor(ventas: readonly SaleEvent[]): Barra[] {
  const conteo = sumarPor(ventas, (v) => v.vendor);
  for (const v of VENDEDORES) if (!conteo.has(v)) conteo.set(v, 0);
  return [...conteo].map(([etiqueta, valor]) => ({ etiqueta, valor })).sort(descendente);
}

export function porDia(ventas: readonly SaleEvent[], hoy: Date, dias = 14): Barra[] {
  const conteo = sumarPor(ventas, (v) => claveFecha(v.ts));
  const barras: Barra[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const clave = claveFechaDesplazada(hoy, -i);
    const legible = fechaLegible(clave);
    barras.push({ etiqueta: legible.slice(0, 5), valor: conteo.get(clave) ?? 0 });
  }
  return barras;
}

// ---------- hielera ----------

export type Hielera = {
  vendedor: Vendedor;
  cargado: number;
  vendido: number;
  /** cargado - vendido. Negativo = vendio mas de lo que registro cargar: falta una carga. */
  restante: number;
  /** Sin ninguna carga registrada el restante no significa nada: la UI lo dice en vez de mostrar 0. */
  sinCarga: boolean;
  /** cargadas = vendidas + restantes. La linea de verificacion de Hoy cuelga de aqui. */
  cuadra: boolean;
};

/**
 * Piezas que le quedan a un vendedor en la hielera ese dia.
 * Descuenta calle y mayoreo: ambas sacan botellas fisicas de la misma hielera.
 */
export function hieleraDe(
  eventos: readonly AppEvent[],
  vendedor: Vendedor,
  clave: string
): Hielera {
  const cargas = cargasActivas(eventos).filter(
    (c) => c.vendor === vendedor && claveFecha(c.ts) === clave
  );
  const ventas = ventasActivas(eventos).filter(
    (v) => v.vendor === vendedor && claveFecha(v.ts) === clave
  );
  const cargado = cargas.reduce((s, c) => s + c.qty, 0);
  const vendido = totalPiezas(ventas);
  const restante = cargado - vendido;
  return {
    vendedor,
    cargado,
    vendido,
    restante,
    sinCarga: cargas.length === 0,
    cuadra: cargado === vendido + restante,
  };
}

/**
 * Lo que le queda en la hielera, a secas. Puede ser negativo: vendio sin registrar la carga.
 * Nunca bloquea una venta; el negativo es la senal de que falta un load retroactivo.
 */
export function enHielera(
  eventos: readonly AppEvent[],
  vendedor: Vendedor,
  clave: string
): number {
  return hieleraDe(eventos, vendedor, clave).restante;
}

export function hieleras(eventos: readonly AppEvent[], clave: string): Hielera[] {
  return VENDEDORES.map((v) => hieleraDe(eventos, v, clave));
}

// ---------- ritmo ----------

export type Ritmo = {
  piezas: number;
  /** Tramo real entre la primera y la ultima venta, en minutos. */
  minutos: number;
  /** Piezas por hora sobre un tramo con piso de una hora. 0 si no hubo ventas. */
  porHora: number;
};

export function ritmo(ventas: readonly SaleEvent[]): Ritmo {
  const piezas = totalPiezas(ventas);
  if (ventas.length === 0) return { piezas: 0, minutos: 0, porHora: 0 };

  const marcas = ventas.map((v) => Date.parse(v.ts));
  const minutos = Math.round((Math.max(...marcas) - Math.min(...marcas)) / 60000);
  const tramo = Math.max(minutos, MINUTOS_MINIMOS_RITMO);
  return { piezas, minutos, porHora: Math.round((piezas / tramo) * 60 * 10) / 10 };
}

/** '3h 10m' / '45m' / '—' para el tramo del ritmo. */
export function duracionLegible(minutos: number): string {
  if (minutos <= 0) return '—';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ---------- cruce por vendedor: cuanto, a que ritmo y donde ----------

export type PanelVendedor = {
  vendedor: Vendedor;
  hielera: Hielera;
  calle: number;
  mayoreo: number;
  ritmo: Ritmo;
  porPunto: Barra[];
  porHora: Barra[];
  /** Donde y cuando rinde mas. null si no vendio nada. */
  mejorPunto: Barra | null;
  mejorHora: Barra | null;
};

export function panelVendedor(
  eventos: readonly AppEvent[],
  vendedor: Vendedor,
  clave: string,
  puntos: readonly string[]
): PanelVendedor {
  const ventas = ventasActivas(eventos).filter(
    (v) => v.vendor === vendedor && claveFecha(v.ts) === clave
  );
  const barrasPunto = porPunto(ventas, puntos);
  const barrasHora = porHora(ventas);
  const pico = [...barrasHora].sort(descendente)[0];

  return {
    vendedor,
    hielera: hieleraDe(eventos, vendedor, clave),
    calle: totalPiezas(ventas.filter((v) => v.channel === 'calle')),
    mayoreo: totalPiezas(ventas.filter((v) => v.channel === 'mayoreo')),
    ritmo: ritmo(ventas),
    porPunto: barrasPunto,
    porHora: barrasHora,
    mejorPunto: barrasPunto[0] !== undefined && barrasPunto[0].valor > 0 ? barrasPunto[0] : null,
    mejorHora: pico !== undefined && pico.valor > 0 ? pico : null,
  };
}

export function panelesDelDia(
  eventos: readonly AppEvent[],
  clave: string,
  puntos: readonly string[]
): PanelVendedor[] {
  return VENDEDORES.map((v) => panelVendedor(eventos, v, clave, puntos));
}

// ---------- validacion de datos externos (import) ----------

function textoValido(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length > 0 && valor.length <= LARGO_MAXIMO_TEXTO;
}

function marcaTiempoValida(valor: unknown): valor is string {
  return (
    typeof valor === 'string' &&
    valor.length > 0 &&
    valor.length <= LARGO_MAXIMO_TEXTO &&
    !Number.isNaN(Date.parse(valor))
  );
}

/** Unico punto de entrada de datos ajenos: devuelve una copia normalizada o null. */
export function validarEvento(valor: unknown): AppEvent | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return null;
  const { id, type, ts, device } = valor as Record<string, unknown>;
  if (!textoValido(id) || !marcaTiempoValida(ts) || !textoValido(device)) return null;

  if (type === 'void') {
    const { refId } = valor as Record<string, unknown>;
    if (!textoValido(refId)) return null;
    return { id, type: 'void', ts, refId, device };
  }

  if (type === 'load') {
    const { vendor, qty } = valor as Record<string, unknown>;
    if (typeof vendor !== 'string' || !VENDEDORES.includes(vendor as Vendedor)) return null;
    if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1) return null;
    return { id, type: 'load', ts, vendor: vendor as Vendedor, qty, device };
  }

  if (type !== 'sale') return null;
  const { point, channel, vendor, qty, retro } = valor as Record<string, unknown>;
  if (!textoValido(point)) return null;
  if (typeof channel !== 'string' || !CANALES.includes(channel as Canal)) return null;
  if (typeof vendor !== 'string' || !VENDEDORES.includes(vendor as Vendedor)) return null;
  if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1) return null;

  const venta: SaleEvent = {
    id,
    type: 'sale',
    ts,
    point,
    channel: channel as Canal,
    vendor: vendor as Vendedor,
    qty,
    device,
  };
  return retro === true ? { ...venta, retro: true } : venta;
}

export function validarAjustes(valor: unknown, deviceId: string): Settings {
  const base: Settings = {
    points: [...PUNTOS_INICIALES],
    defaultVendor: 'Fran',
    deviceId,
  };
  if (typeof valor !== 'object' || valor === null) return base;
  const { points, defaultVendor, deviceId: guardado } = valor as Record<string, unknown>;

  const puntos = Array.isArray(points)
    ? points.filter((p): p is string => textoValido(p)).filter(sinRepetir())
    : [];

  return {
    points: puntos.length > 0 ? puntos : [...PUNTOS_INICIALES],
    defaultVendor: VENDEDORES.includes(defaultVendor as Vendedor)
      ? (defaultVendor as Vendedor)
      : 'Fran',
    deviceId: textoValido(guardado) ? guardado : deviceId,
  };
}

function sinRepetir(): (p: string) => boolean {
  const vistos = new Set<string>();
  return (p: string) => {
    const k = p.trim().toLocaleLowerCase();
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  };
}

/** Extrae el arreglo de eventos de un archivo exportado; null si el sobre no cuadra. */
export function eventosDeArchivo(valor: unknown): unknown[] | null {
  if (typeof valor !== 'object' || valor === null) return null;
  const { events, version } = valor as Record<string, unknown>;
  if (version !== 1) return null;
  return Array.isArray(events) ? events : null;
}

// ---------- migracion ----------

/**
 * Que copiar al respaldo antes de que la app escriba por primera vez sobre los datos viejos.
 * Devuelve el crudo tal cual, sin parsear ni normalizar: el respaldo es byte a byte, reversible.
 * null = no hay que tocar nada, y en particular nunca pisa un respaldo que ya existe:
 * el primer respaldo es el que vale, los guardados posteriores ya son datos migrados.
 */
export function planRespaldo(crudo: string | null, respaldoPrevio: string | null): string | null {
  if (crudo === null || crudo === '') return null;
  if (respaldoPrevio !== null) return null;
  return crudo;
}

// ---------- merge idempotente ----------

export type ResultadoMezcla = {
  eventos: AppEvent[];
  nuevos: number;
  repetidos: number;
  invalidos: number;
};

export function mezclar(
  actuales: readonly AppEvent[],
  entrantes: readonly unknown[]
): ResultadoMezcla {
  const vistos = new Set(actuales.map((e) => e.id));
  const nuevos: AppEvent[] = [];
  let repetidos = 0;
  let invalidos = 0;

  for (const bruto of entrantes) {
    const evento = validarEvento(bruto);
    if (evento === null) {
      invalidos++;
      continue;
    }
    if (vistos.has(evento.id)) {
      repetidos++;
      continue;
    }
    vistos.add(evento.id);
    nuevos.push(evento);
  }

  return { eventos: [...actuales, ...nuevos], nuevos: nuevos.length, repetidos, invalidos };
}

// ---------- puntos ----------

export function puedeAgregarPunto(puntos: readonly string[], nombre: string): boolean {
  const limpio = nombre.trim();
  if (limpio.length === 0 || limpio.length > LARGO_MAXIMO_TEXTO) return false;
  const k = limpio.toLocaleLowerCase();
  return !puntos.some((p) => p.trim().toLocaleLowerCase() === k);
}

/** Quitar un punto solo lo saca de la lista activa: los eventos historicos lo conservan. */
export function quitarPunto(puntos: readonly string[], nombre: string): string[] {
  if (puntos.length <= 1) return [...puntos];
  const restantes = puntos.filter((p) => p !== nombre);
  return restantes.length > 0 ? restantes : [...puntos];
}

// ---------- resumen compartible ----------

export function resumenTexto(eventos: readonly AppEvent[], clave: string, puntos: readonly string[]): string {
  const delDia = ventasActivas(eventos).filter((v) => claveFecha(v.ts) === clave);
  const calle = delDia.filter((v) => v.channel === 'calle');
  const mayoreo = delDia.filter((v) => v.channel === 'mayoreo');
  const lineas: string[] = [`Refreskte ${fechaLegible(clave)}`];

  lineas.push(`Calle: ${totalPiezas(calle)}`);
  for (const { etiqueta, valor } of porPunto(calle, puntos)) {
    lineas.push(`  ${etiqueta}: ${valor}`);
  }
  if (mayoreo.length > 0) {
    lineas.push(`Mayoreo: ${totalPiezas(mayoreo)}`);
    for (const { etiqueta, valor } of porPunto(mayoreo, [])) {
      lineas.push(`  ${etiqueta}: ${valor}`);
    }
  }
  for (const panel of panelesDelDia(eventos, clave, puntos)) {
    const { hielera, ritmo: r, mejorPunto } = panel;
    if (hielera.cargado === 0 && hielera.vendido === 0) continue;
    const partes = [`${panel.vendedor}: ${hielera.vendido}`];
    if (!hielera.sinCarga) partes.push(`quedan ${hielera.restante} de ${hielera.cargado}`);
    if (r.porHora > 0) partes.push(`${r.porHora}/h`);
    if (mejorPunto !== null) partes.push(`mejor ${mejorPunto.etiqueta}`);
    lineas.push(partes.join(' · '));
  }
  lineas.push(`Total: ${totalPiezas(delDia)}`);
  return lineas.join('\n');
}
