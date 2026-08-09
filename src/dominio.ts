import type {
  AppEvent,
  Canal,
  LoadEvent,
  SaleEvent,
  Settings,
  ShiftEvent,
  TransferEvent,
  Vendedor,
  VoidEvent,
} from './tipos';

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

/**
 * Lo que escribe registrar de un jalon lo vendido en un rato: el turno de los dos a la hora que
 * se declara, y una venta por vendedor con lo que le toco.
 *
 * Nace de que tocar +1 por botella tiene friccion en la calle. Las piezas ya no se teclean: se
 * cuenta lo que queda en la hielera y `planConteo` saca la resta. Aqui llegan ya en piezas.
 *
 * Las piezas se capturan POR VENDEDOR y no juntas a proposito: la hielera, el cuadre del dia y
 * las stats por persona viven de saber quien vendio que. Partir un total a la mitad inventaria
 * un dato que nadie conto y haria que el cuadre marcara rojo sin que hubiera error.
 *
 * El turno solo se escribe si el vendedor no estaba ya en ese punto: registrar dos horas
 * seguidas del mismo lugar es un solo rato ahi, y un evento repetido lo partiria en dos.
 *
 * Todas las piezas de la hora llevan la MISMA marca de tiempo, la de llegada. Es lo que se
 * declaro —"de cinco a seis se fueron doce"— y cae entera en la franja de las cinco, que es la
 * unidad con la que se lee la cuadricula de lugar x hora.
 */
export function eventosDeHora(
  eventos: readonly AppEvent[],
  entrada: {
    ts: string;
    fecha: string;
    point: string;
    device: string;
    piezas: Readonly<Record<Vendedor, number>>;
  }
): AppEvent[] {
  const salida: AppEvent[] = [];

  for (const vendedor of VENDEDORES) {
    if (turnoActual(eventos, vendedor, entrada.fecha)?.point === entrada.point) continue;
    salida.push(
      crearTurno({
        ts: entrada.ts,
        point: entrada.point,
        vendor: vendedor,
        device: entrada.device,
      })
    );
  }

  for (const vendedor of VENDEDORES) {
    const qty = entrada.piezas[vendedor];
    if (!Number.isInteger(qty) || qty <= 0) continue;
    salida.push(
      crearVenta({
        ts: entrada.ts,
        point: entrada.point,
        channel: 'calle',
        vendor: vendedor,
        qty,
        device: entrada.device,
      })
    );
  }

  return salida;
}

/** Lo que un vendedor cuenta en su hielera al cerrar el rato, contra lo que el sistema creia. */
export type LineaConteo = {
  vendedor: Vendedor;
  /** Lo que deberia traer segun sus cargas, sus traspasos y lo ya registrado como vendido. */
  esperado: number;
  /** Lo que conto. null = no lo conto, y entonces a su hielera no se le toca nada. */
  contado: number | null;
  /** Las que se fueron en el rato: esperado - contado. Nunca negativo. */
  piezas: number;
  /** Las que cuenta de mas: contado - esperado. 0 en el caso normal. */
  sobran: number;
  /** Sin carga ni traspaso recibido, `esperado` no significa nada todavia. */
  sinCarga: boolean;
};

export type PlanConteo = {
  lineas: LineaConteo[];
  /**
   * Los que cuentan mas botellas de las que deberian traer. Fisicamente eso no sale de la nada:
   * es una carga que no se registro. No se resuelve solo porque nadie sabe cuantas ni a que hora
   * entraron, asi que el plan las senala y la captura se detiene ahi.
   */
  sobrantes: LineaConteo[];
  piezas: Record<Vendedor, number>;
  total: number;
};

/**
 * Traduce "quedan 8 en la hielera" a "se vendieron 12", que es lo que el historico guarda.
 *
 * Contar lo que queda es mas facil que ir tocando +1 por botella, y es la operacion inversa de
 * la hielera: si `restante` sale de restarle lo vendido a lo cargado, entonces lo vendido sale
 * de restarle lo contado a `restante`.
 *
 * Ojo con lo que esto implica y con +1 no pasaba: **todo lo que salio de la hielera cuenta como
 * venta**. Una botella rota o regalada baja el conteo igual que una vendida, se va a cobrar en el
 * ingreso esperado del corte y ahi va a aparecer como faltante de efectivo.
 *
 * El campo vacio (null) NO es cero: es "a este no lo conte". Tratarlo como cero registraria la
 * hielera entera como vendida de un tecleo.
 */
export function planConteo(
  eventos: readonly AppEvent[],
  clave: string,
  contado: Readonly<Record<Vendedor, number | null>>
): PlanConteo {
  const lineas = VENDEDORES.map((vendedor): LineaConteo => {
    const h = hieleraDe(eventos, vendedor, clave);
    const cuenta = contado[vendedor];
    const diferencia = cuenta === null ? 0 : h.restante - cuenta;
    return {
      vendedor,
      esperado: h.restante,
      contado: cuenta,
      piezas: Math.max(0, diferencia),
      sobran: Math.max(0, -diferencia),
      sinCarga: h.sinCarga,
    };
  });

  return {
    lineas,
    sobrantes: lineas.filter((l) => l.sobran > 0),
    piezas: Object.fromEntries(lineas.map((l) => [l.vendedor, l.piezas])) as Record<
      Vendedor,
      number
    >,
    total: lineas.reduce((s, l) => s + l.piezas, 0),
  };
}

/** Marcar lugar no registra ninguna pieza: solo dice donde esta parado el vendedor desde esa hora. */
export function crearTurno(entrada: {
  ts: string;
  point: string;
  vendor: Vendedor;
  device: string;
}): ShiftEvent {
  return {
    id: nuevoId(entrada.device),
    type: 'shift',
    ts: entrada.ts,
    point: entrada.point,
    vendor: entrada.vendor,
    device: entrada.device,
  };
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

/**
 * Pasar botellas de una hielera a la otra. null si los datos no describen un traspaso real:
 * a uno mismo no se le pasa nada, y menos de una pieza tampoco.
 */
export function crearTraspaso(entrada: {
  ts: string;
  from: Vendedor;
  to: Vendedor;
  qty: number;
  device: string;
}): TransferEvent | null {
  if (entrada.from === entrada.to) return null;
  if (!Number.isInteger(entrada.qty) || entrada.qty < 1) return null;
  return {
    id: nuevoId(entrada.device),
    type: 'transfer',
    ts: entrada.ts,
    from: entrada.from,
    to: entrada.to,
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
 * La venta que anularia el boton -1: la ultima de calle activa de ese vendedor en ese punto ese dia.
 * La UI la usa para deshabilitar el boton sin repetir el criterio.
 *
 * Filtra por vendedor porque los dos venden desde el mismo telefono y en el mismo lugar: sin el
 * filtro, corregir un toque de mas de uno le borraria una pieza al otro, y eso no lo avisa nadie
 * — los totales del dia y el dinero salen identicos, solo cambia a quien se le acredito.
 */
export function ultimaVentaActiva(
  eventos: readonly AppEvent[],
  punto: string,
  clave: string,
  vendedor: Vendedor
): SaleEvent | null {
  const candidatas = ordenarPorHora(
    ventasActivas(eventos).filter(
      (v) =>
        v.point === punto &&
        v.channel === 'calle' &&
        v.vendor === vendedor &&
        claveFecha(v.ts) === clave
    )
  );
  return candidatas[candidatas.length - 1] ?? null;
}

/**
 * -1 es correccion, no resta: anula entera la ultima venta de calle de ese vendedor en el punto.
 * Nunca edita ni borra; si esa venta traia 3 piezas, se van las 3 y se vuelve a capturar.
 * null cuando no hay nada que anular: ahi el boton va deshabilitado.
 */
export function anularUltimaVenta(
  eventos: readonly AppEvent[],
  punto: string,
  clave: string,
  vendedor: Vendedor,
  device: string,
  ts: string
): VoidEvent | null {
  const ultima = ultimaVentaActiva(eventos, punto, clave, vendedor);
  if (ultima === null) return null;
  return crearAnulacion(eventos, ultima.id, device, ts);
}

// ---------- correccion de lugar ----------

export type VentaMovida = { anulacion: VoidEvent; venta: SaleEvent };

/**
 * Corregir el lugar de una venta ya registrada: se vendio en la Plazuela pero el telefono
 * seguia marcando Parque Sinaloa.
 *
 * No la edita, como nada aqui: anula la que quedo mal y escribe la misma pieza en el lugar
 * correcto, conservando su hora original —la venta ocurrio cuando ocurrio— y dejando anotado
 * de donde venia. El dinero no se mueve ni cuando el corte del dia ya esta cerrado: el ingreso
 * sale de piezas por canal y nunca mira el punto.
 *
 * null si la venta no existe, ya estaba anulada, o ya estaba en ese lugar.
 */
export function moverVenta(
  eventos: readonly AppEvent[],
  idVenta: string,
  punto: string,
  device: string,
  ts: string
): VentaMovida | null {
  const venta = eventos.find((e): e is SaleEvent => e.type === 'sale' && e.id === idVenta);
  if (venta === undefined || venta.point === punto) return null;
  const anulacion = crearAnulacion(eventos, idVenta, device, ts);
  if (anulacion === null) return null;
  return {
    anulacion,
    venta: { ...venta, id: nuevoId(device), point: punto, movedFrom: venta.point },
  };
}

export type CorreccionLugar = {
  punto: string;
  desde: string;
  /** A quienes les cambia el lugar. Vacio nunca: sin nadie a quien corregir el plan es null. */
  vendedores: Vendedor[];
  piezas: number;
  ventasMovidas: number;
  /** Todo lo que hay que escribir, en orden: turnos, anulaciones y las ventas ya corregidas. */
  eventos: AppEvent[];
};

/**
 * "En realidad ya estabamos en el otro lugar desde las HH:MM": marca el lugar a esa hora y
 * reacredita ahi las ventas que se habian ido al lugar equivocado.
 *
 * Corrige los dos errores juntos porque siempre vienen juntos: el que se mueve y se le olvida
 * marcar sigue vendiendo, y cada toque se le acredita al lugar de antes. Mover solo las ventas
 * dejaria el turno mintiendo; mover solo el turno dejaria las piezas donde no fueron.
 *
 * El lugar se le marca a los dos por la misma razon que al marcarlo en vivo: salen juntos y el
 * registro es de un solo telefono. Las ventas, en cambio, se corrigen vendedor por vendedor y
 * solo las del punto que cada quien traia mal, dentro de la ventana que va de `desde` hasta el
 * siguiente lugar que ese vendedor marco: mas alla el registro ya decia la verdad.
 *
 * null cuando no hay nada que corregir: los dos ya estaban ahi.
 */
export function planCorreccionLugar(
  eventos: readonly AppEvent[],
  entrada: { desde: string; punto: string; device: string; ahora: string }
): CorreccionLugar | null {
  const inicio = Date.parse(entrada.desde);
  if (Number.isNaN(inicio) || entrada.punto === '') return null;
  const clave = claveFecha(entrada.desde);

  const turnos: ShiftEvent[] = [];
  const anulaciones: VoidEvent[] = [];
  const corregidas: SaleEvent[] = [];
  const vendedores: Vendedor[] = [];
  let piezas = 0;

  for (const vendedor of VENDEDORES) {
    const equivocado = turnoEn(eventos, vendedor, entrada.desde);
    if (equivocado !== null && equivocado.point === entrada.punto) continue;

    vendedores.push(vendedor);
    turnos.push(
      crearTurno({ ts: entrada.desde, point: entrada.punto, vendor: vendedor, device: entrada.device })
    );
    if (equivocado === null) continue;

    // Un turno que empezo justo a esa hora nunca fue cierto: se toco el lugar equivocado al
    // llegar. Se anula en vez de dejar en la lista un rato de cero minutos que nadie estuvo.
    if (Date.parse(equivocado.ts) === inicio) {
      const anulacion = crearAnulacion(eventos, equivocado.id, entrada.device, entrada.ahora);
      if (anulacion !== null) anulaciones.push(anulacion);
    }

    const siguiente = turnoSiguiente(eventos, vendedor, entrada.desde);
    const hasta = siguiente === null ? Infinity : Date.parse(siguiente.ts);
    const malas = ordenarPorHora(
      ventasActivas(eventos).filter(
        (v) =>
          v.vendor === vendedor &&
          v.point === equivocado.point &&
          claveFecha(v.ts) === clave &&
          Date.parse(v.ts) >= inicio &&
          Date.parse(v.ts) < hasta
      )
    );
    for (const mala of malas) {
      const movida = moverVenta(eventos, mala.id, entrada.punto, entrada.device, entrada.ahora);
      if (movida === null) continue;
      anulaciones.push(movida.anulacion);
      corregidas.push(movida.venta);
      piezas += mala.qty;
    }
  }

  if (vendedores.length === 0) return null;
  return {
    punto: entrada.punto,
    desde: entrada.desde,
    vendedores,
    piezas,
    ventasMovidas: corregidas.length,
    eventos: [...turnos, ...anulaciones, ...corregidas],
  };
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

export function traspasosActivos(eventos: readonly AppEvent[]): TransferEvent[] {
  const anulados = idsAnulados(eventos);
  return eventos.filter((e): e is TransferEvent => e.type === 'transfer' && !anulados.has(e.id));
}

/** Todos los traspasos de la fecha, anulados incluidos: la vista Hoy los muestra tachados. */
export function traspasosDeFecha(eventos: readonly AppEvent[], clave: string): TransferEvent[] {
  const traspasos = eventos.filter(
    (e): e is TransferEvent => e.type === 'transfer' && claveFecha(e.ts) === clave
  );
  return ordenarPorHora(traspasos);
}

export function turnosActivos(eventos: readonly AppEvent[]): ShiftEvent[] {
  const anulados = idsAnulados(eventos);
  return eventos.filter((e): e is ShiftEvent => e.type === 'shift' && !anulados.has(e.id));
}

/** Todos los turnos de la fecha, anulados incluidos: la vista Hoy los muestra tachados. */
export function turnosDeFecha(eventos: readonly AppEvent[], clave: string): ShiftEvent[] {
  const turnos = eventos.filter(
    (e): e is ShiftEvent => e.type === 'shift' && claveFecha(e.ts) === clave
  );
  return ordenarPorHora(turnos);
}

/** Donde esta parado el vendedor: su ultimo turno activo de esa fecha. null = no ha marcado lugar. */
export function turnoActual(
  eventos: readonly AppEvent[],
  vendedor: Vendedor,
  clave: string
): ShiftEvent | null {
  const suyos = ordenarPorHora(
    turnosActivos(eventos).filter((t) => t.vendor === vendedor && claveFecha(t.ts) === clave)
  );
  return suyos[suyos.length - 1] ?? null;
}

/** Los turnos activos de un vendedor en el dia de esa marca de tiempo, en orden. */
function turnosDelDiaDe(eventos: readonly AppEvent[], vendedor: Vendedor, ts: string): ShiftEvent[] {
  const clave = claveFecha(ts);
  return ordenarPorHora(
    turnosActivos(eventos).filter((t) => t.vendor === vendedor && claveFecha(t.ts) === clave)
  );
}

/**
 * Donde creia la app que estaba parado el vendedor a esa hora: su ultimo lugar marcado hasta
 * ese momento. Es turnoActual pero mirando a una hora cualquiera y no al reloj de ahora, que es
 * lo que hace falta para corregir un rato que ya paso. null = a esa hora no habia lugar marcado.
 */
export function turnoEn(
  eventos: readonly AppEvent[],
  vendedor: Vendedor,
  ts: string
): ShiftEvent | null {
  const marca = Date.parse(ts);
  const hasta = turnosDelDiaDe(eventos, vendedor, ts).filter((t) => Date.parse(t.ts) <= marca);
  return hasta[hasta.length - 1] ?? null;
}

/** El siguiente lugar que marco el vendedor despues de esa hora: donde deja de valer el anterior. */
function turnoSiguiente(
  eventos: readonly AppEvent[],
  vendedor: Vendedor,
  ts: string
): ShiftEvent | null {
  const marca = Date.parse(ts);
  return turnosDelDiaDe(eventos, vendedor, ts).find((t) => Date.parse(t.ts) > marca) ?? null;
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
  /** Solo lo que salio de casa en su hielera. Los traspasos NO lo mueven: es el dato del almacen. */
  cargado: number;
  /** Piezas que le pasó el otro vendedor ese dia. */
  recibido: number;
  /** Piezas que le pasó al otro vendedor ese dia. */
  entregado: number;
  vendido: number;
  /** cargado + recibido - entregado - vendido. Negativo = vendio mas de lo que tuvo en las manos. */
  restante: number;
  /** Sin carga ni traspaso recibido el restante no significa nada: la UI lo dice en vez de mostrar 0. */
  sinCarga: boolean;
  /**
   * No vendio mas piezas de las que tuvo en las manos. Es la unica verificacion real de la
   * hielera: `restante` se deriva de los demas campos, asi que compararlos entre si siempre
   * daria cierto y no comprobaria nada.
   */
  cuadra: boolean;
};

/**
 * Piezas que le quedan a un vendedor en la hielera ese dia.
 *
 * Descuenta calle y mayoreo: ambas sacan botellas fisicas de la misma hielera. Y suma los
 * traspasos, porque la venta es de quien la hace pero la botella es de quien la cargo: cuando
 * uno se queda sin nada y el otro le pasa de las suyas, esas piezas dejan de estar en una
 * hielera y pasan a la otra sin que el dia haya cargado ni una botella mas.
 */
export function hieleraDe(
  eventos: readonly AppEvent[],
  vendedor: Vendedor,
  clave: string
): Hielera {
  const delDia = <T extends { ts: string }>(lista: readonly T[]): T[] =>
    lista.filter((e) => claveFecha(e.ts) === clave);

  const cargas = delDia(cargasActivas(eventos)).filter((c) => c.vendor === vendedor);
  const ventas = delDia(ventasActivas(eventos)).filter((v) => v.vendor === vendedor);
  const traspasos = delDia(traspasosActivos(eventos));

  const suma = (lista: readonly { qty: number }[]): number =>
    lista.reduce((s, e) => s + e.qty, 0);

  const cargado = suma(cargas);
  const recibido = suma(traspasos.filter((t) => t.to === vendedor));
  const entregado = suma(traspasos.filter((t) => t.from === vendedor));
  const vendido = totalPiezas(ventas);
  const restante = cargado + recibido - entregado - vendido;

  return {
    vendedor,
    cargado,
    recibido,
    entregado,
    vendido,
    restante,
    sinCarga: cargas.length === 0 && recibido === 0,
    cuadra: restante >= 0,
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

/**
 * Cuantas piezas pasar para que los dos queden parejos y acaben juntos, que es para lo que se
 * cuentan las botellas. El impar se queda con quien las trae: mejor un traspaso de menos que
 * dejar corto al que las esta cargando.
 *
 * 0 cuando no hay nada que emparejar — el donante ya va igual o mas abajo — y nunca mas de lo
 * que el donante trae, que es todo lo que fisicamente puede pasar de mano.
 * Es una sugerencia: el numero se puede editar antes de confirmar.
 */
export function sugerenciaEquilibrio(donante: Hielera, receptor: Hielera): number {
  if (donante.restante <= 0) return 0;
  const mitad = Math.floor((donante.restante - receptor.restante) / 2);
  return Math.max(0, Math.min(donante.restante, mitad));
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

// ---------- turnos: una hora aprox por lugar ----------

export type Turno = {
  id: string;
  vendedor: Vendedor;
  punto: string;
  inicio: string;
  /** Inicio del siguiente turno del mismo vendedor ese dia. null = fue el ultimo, quedo abierto. */
  fin: string | null;
  /** Minutos entre el inicio y el cierre efectivo. */
  minutos: number;
  piezas: number;
  /** Piezas por hora del turno, con el mismo piso de una hora que el ritmo del dia. */
  porHora: number;
  /** '17:03–18:10', o '17:03–ahora' si es el turno abierto de hoy. */
  franja: string;
};

export type Jornada = {
  turnos: Turno[];
  /** Piezas del dia que no cayeron en ningun turno: se vendieron sin marcar lugar. */
  sinTurno: number;
};

/**
 * Cada turno con la hora en que lo relevo el siguiente del mismo vendedor.
 * El ultimo de cada vendedor queda con fin null: sigue abierto.
 */
function cerrarTurnos(
  eventos: readonly AppEvent[],
  clave: string
): { turno: ShiftEvent; fin: string | null }[] {
  const activos = ordenarPorHora(
    turnosActivos(eventos).filter((t) => claveFecha(t.ts) === clave)
  );
  return activos.map((turno, i) => {
    const siguiente = activos.slice(i + 1).find((o) => o.vendor === turno.vendor);
    return { turno, fin: siguiente === undefined ? null : siguiente.ts };
  });
}

/**
 * Las ventas que le tocan a un turno: mismo vendedor, mismo lugar y dentro de su ventana.
 * No hace falta guardar el turno en la venta; asi tambien entran las retroactivas y lo ya capturado.
 */
function ventasDeTurno(
  ventas: readonly SaleEvent[],
  turno: ShiftEvent,
  fin: string | null
): SaleEvent[] {
  const desde = Date.parse(turno.ts);
  const hasta = fin === null ? Infinity : Date.parse(fin);
  return ventas.filter((v) => {
    if (v.vendor !== turno.vendor || v.point !== turno.point) return false;
    const t = Date.parse(v.ts);
    return t >= desde && t < hasta;
  });
}

/**
 * Los turnos del dia con lo que se vendio en cada uno.
 * El turno abierto de hoy corre hasta `ahora`; el de un dia pasado se cierra en su ultima venta,
 * porque medirlo contra el reloj de hoy inventaria horas que nadie estuvo parado ahi.
 */
export function jornada(eventos: readonly AppEvent[], clave: string, ahora: Date): Jornada {
  const ventas = ventasActivas(eventos).filter((v) => claveFecha(v.ts) === clave);
  const esHoy = clave === claveFecha(ahora);
  const atribuidas = new Set<string>();

  const turnos = cerrarTurnos(eventos, clave).map(({ turno, fin }): Turno => {
    const suyas = ordenarPorHora(ventasDeTurno(ventas, turno, fin));
    for (const v of suyas) atribuidas.add(v.id);

    const ultima = suyas[suyas.length - 1];
    const cierre =
      fin ?? (esHoy ? isoLocal(ahora) : ultima === undefined ? turno.ts : ultima.ts);
    const minutos = Math.max(0, Math.round((Date.parse(cierre) - Date.parse(turno.ts)) / 60000));
    const piezas = totalPiezas(suyas);
    const tramo = Math.max(minutos, MINUTOS_MINIMOS_RITMO);
    const abierto = fin === null && esHoy;

    return {
      id: turno.id,
      vendedor: turno.vendor,
      punto: turno.point,
      inicio: turno.ts,
      fin,
      minutos,
      piezas,
      porHora: Math.round((piezas / tramo) * 60 * 10) / 10,
      franja: `${horaMinuto(turno.ts)}–${abierto ? 'ahora' : horaMinuto(cierre)}`,
    };
  });

  return { turnos, sinTurno: totalPiezas(ventas.filter((v) => !atribuidas.has(v.id))) };
}

// ---------- cruce lugar x hora ----------

export type Celda = { punto: string; hora: number; valor: number };

export type Matriz = {
  /** Rango continuo de horas con actividad: las horas muertas de en medio tambien se ven. */
  horas: number[];
  filas: { punto: string; celdas: Celda[]; total: number }[];
  maximo: number;
};

/**
 * Lo que el negocio pregunta de verdad: en que lugar y a que hora se vende.
 * Solo salen los lugares con ventas en el rango: una cuadricula de ceros no dice nada.
 */
export function porLugarYHora(ventas: readonly SaleEvent[]): Matriz {
  if (ventas.length === 0) return { horas: [], filas: [], maximo: 0 };

  const conteo = sumarPor(ventas, (v) => `${horaDe(v.ts)} ${v.point}`);
  const horasVistas = ventas.map((v) => horaDe(v.ts));
  const horas: number[] = [];
  for (let h = Math.min(...horasVistas); h <= Math.max(...horasVistas); h++) horas.push(h);

  const puntos = [...new Set(ventas.map((v) => v.point))];
  const filas = puntos
    .map((punto) => {
      const celdas = horas.map((hora) => ({
        punto,
        hora,
        valor: conteo.get(`${hora} ${punto}`) ?? 0,
      }));
      return { punto, celdas, total: celdas.reduce((s, c) => s + c.valor, 0) };
    })
    .sort((a, b) => b.total - a.total || a.punto.localeCompare(b.punto));

  const maximo = filas.reduce(
    (m, f) => f.celdas.reduce((mm, c) => Math.max(mm, c.valor), m),
    0
  );
  return { horas, filas, maximo };
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

  if (type === 'shift') {
    const { point, vendor } = valor as Record<string, unknown>;
    if (!textoValido(point)) return null;
    if (typeof vendor !== 'string' || !VENDEDORES.includes(vendor as Vendedor)) return null;
    return { id, type: 'shift', ts, point, vendor: vendor as Vendedor, device };
  }

  if (type === 'transfer') {
    const { from, to, qty } = valor as Record<string, unknown>;
    if (typeof from !== 'string' || !VENDEDORES.includes(from as Vendedor)) return null;
    if (typeof to !== 'string' || !VENDEDORES.includes(to as Vendedor)) return null;
    // De uno a si mismo no es un traspaso: entraria como recibido y entregado a la vez y no
    // moveria nada, pero ensuciaria el historico con una linea que no ocurrio.
    if (from === to) return null;
    if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1) return null;
    return { id, type: 'transfer', ts, from: from as Vendedor, to: to as Vendedor, qty, device };
  }

  if (type !== 'sale') return null;
  const { point, channel, vendor, qty, retro, movedFrom } = valor as Record<string, unknown>;
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
  const conRetro: SaleEvent = retro === true ? { ...venta, retro: true } : venta;
  // El origen se conserva si viene bien escrito y se descarta si no: es una anotacion de
  // historico, no un dato del que dependa ninguna cuenta, y no vale perder la venta por el.
  return textoValido(movedFrom) ? { ...conRetro, movedFrom } : conRetro;
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

export function resumenTexto(
  eventos: readonly AppEvent[],
  clave: string,
  puntos: readonly string[],
  ahora: Date = new Date()
): string {
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
  const { turnos } = jornada(eventos, clave, ahora);
  if (turnos.length > 0) {
    lineas.push('Turnos:');
    for (const t of turnos) {
      lineas.push(`  ${t.punto} ${t.franja} · ${t.vendedor}: ${t.piezas}`);
    }
  }
  for (const panel of panelesDelDia(eventos, clave, puntos)) {
    const { hielera, ritmo: r, mejorPunto } = panel;
    const sinMovimiento =
      hielera.cargado === 0 &&
      hielera.vendido === 0 &&
      hielera.recibido === 0 &&
      hielera.entregado === 0;
    if (sinMovimiento) continue;
    const partes = [`${panel.vendedor}: ${hielera.vendido}`];
    if (!hielera.sinCarga) partes.push(`quedan ${hielera.restante} de ${hielera.cargado}`);
    if (hielera.recibido > 0) partes.push(`recibió ${hielera.recibido}`);
    if (hielera.entregado > 0) partes.push(`pasó ${hielera.entregado}`);
    if (r.porHora > 0) partes.push(`${r.porHora}/h`);
    if (mejorPunto !== null) partes.push(`mejor ${mejorPunto.etiqueta}`);
    lineas.push(partes.join(' · '));
  }
  lineas.push(`Total: ${totalPiezas(delDia)}`);
  return lineas.join('\n');
}
