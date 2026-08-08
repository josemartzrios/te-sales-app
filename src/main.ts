import './estilos.css';
import type { AppEvent, ArchivoExport, Canal, Settings, Vendedor } from './tipos';
import type { CorreccionLugar, Rango } from './dominio';
import {
  LARGO_MAXIMO_TEXTO,
  NOMBRE_APP,
  VENDEDORES,
  anularUltimaVenta,
  claveFecha,
  crearAnulacion,
  crearCarga,
  crearTraspaso,
  crearTurno,
  crearVenta,
  eventosDeArchivo,
  eventosDeHora,
  fechaLegible,
  hieleraDe,
  horaMinuto,
  isoDesdeFechaYHora,
  isoLocal,
  mezclar,
  moverVenta,
  nuevoId,
  planCorreccionLugar,
  puedeAgregarPunto,
  quitarPunto,
  resumenTexto,
  turnoActual,
  ultimaVentaActiva,
} from './dominio';
import type { Borrador, CorteCerrado, Precios } from './corte';
import {
  agregarCorte,
  borradorDe,
  borradorVacio,
  centavosDesde,
  cerrarCorte,
  conGasto,
  corteDeFecha,
  guardarBorrador,
  importe,
  ingresoDeFecha,
  nuevaLinea,
  repartoDeBorrador,
  resumenCorte,
  sinGasto,
} from './corte';
import type { MovimientoCaja, Sobre, Tasas } from './caja';
import {
  NOMBRE_SOBRE,
  agregarMovimientos,
  arquear,
  borrarMovimiento,
  cajaParaEsperado,
  editarMovimiento,
  estadoCaja,
  movimientoDeArqueo,
  movimientoDeCobro,
  movimientosDeCierre,
  movimientosDeGasto,
  movimientosDeSemana,
  origenDelGasto,
  planCaja,
  planSemana,
  resumenCaja,
  sellarMovimientos,
  sinMovimientosDeGasto,
  tipoDeMovimiento,
  validarTasas,
} from './caja';
import {
  escribirAjustes,
  escribirBorradores,
  escribirCortes,
  escribirEventos,
  escribirMovimientos,
  escribirPrecios,
  escribirTasas,
  leerAjustes,
  leerBorradores,
  leerCortes,
  leerEventos,
  leerMovimientos,
  leerPrecios,
  leerRespaldo,
  leerTasas,
  migrar,
} from './almacenamiento';
import type { CapturaCaja, DatosCargaRetro, DatosRetro, Vista } from './ui';
import {
  abrirCarga,
  abrirCargaRetro,
  abrirCorreccionLugar,
  abrirMayoreo,
  abrirMoverVenta,
  abrirRetro,
  abrirTraspaso,
  destacarHielera,
  enfocarGasto,
  limpiar,
  pintarNav,
  toast,
  vistaAjustes,
  vistaCaja,
  vistaCorte,
  vistaHoy,
  vistaStats,
  vistaVender,
} from './ui';

const TAMANO_MAXIMO_IMPORT = 5 * 1024 * 1024;

const raiz = document.getElementById('app');
const barraNav = document.getElementById('nav');
if (raiz === null || barraNav === null) throw new Error('Falta el contenedor de la app');
const app: HTMLElement = raiz;
const nav: HTMLElement = barraNav;

// Antes de leer o escribir nada: los eventos ya capturados se copian intactos al respaldo.
migrar();

const lecturaAjustes = leerAjustes();
const lecturaEventos = leerEventos();
const lecturaCortes = leerCortes();
const lecturaBorradores = leerBorradores();
const lecturaMovimientos = leerMovimientos();

let ajustes: Settings = lecturaAjustes.datos;
let eventos: AppEvent[] = lecturaEventos.datos;
let cortes: CorteCerrado[] = lecturaCortes.datos;
let borradores: Borrador[] = lecturaBorradores.datos;
let movimientos: MovimientoCaja[] = lecturaMovimientos.datos;
let precios: Precios = leerPrecios();
let tasas: Tasas = leerTasas();

escribirAjustes(ajustes);

const estado: {
  vista: Vista;
  /**
   * De donde se entro a Stats o Ajustes. Esas dos no estan en la barra de abajo, asi que su
   * "Volver" tiene que devolver al sitio del que se vino, no a uno fijo.
   */
  vistaPrevia: Vista;
  vendedor: Vendedor;
  fecha: string;
  fechaCorte: string;
  rango: Rango;
  canal: Canal | 'todo';
  vendedorStats: Vendedor | 'todos';
} = {
  vista: 'vender',
  vistaPrevia: 'vender',
  vendedor: ajustes.defaultVendor,
  fecha: claveFecha(new Date()),
  fechaCorte: claveFecha(new Date()),
  rango: 'hoy',
  canal: 'calle',
  vendedorStats: 'todos',
};

const SECUNDARIAS: readonly Vista[] = ['stats', 'ajustes'];

/**
 * El unico camino para cambiar de pantalla: la barra de abajo, el menu "⋯", el "Volver" y los
 * atajos entre pantallas pasan todos por aqui, asi que las fechas se refrescan y el scroll vuelve
 * arriba sin que cada sitio tenga que acordarse.
 */
function irAVista(v: Vista): void {
  if (SECUNDARIAS.includes(v) && !SECUNDARIAS.includes(estado.vista)) {
    estado.vistaPrevia = estado.vista;
  }
  // Entrar a Hoy o a Corte es "ver el dia de hoy": si se quedo en una fecha vieja, se descarta.
  if (v === 'hoy') estado.fecha = claveFecha(new Date());
  if (v === 'corte') estado.fechaCorte = claveFecha(new Date());
  estado.vista = v;
  render();
  window.scrollTo(0, 0);
}

// ---------- escritura ----------

/** Solo actualiza memoria si el guardado tuvo exito: la pantalla nunca miente sobre lo persistido. */
function aplicarEventos(nuevos: AppEvent[]): boolean {
  const error = escribirEventos(nuevos);
  if (error !== null) {
    toast(error, 5000);
    return false;
  }
  eventos = nuevos;
  return true;
}

function aplicarAjustes(nuevos: Settings): boolean {
  const error = escribirAjustes(nuevos);
  if (error !== null) {
    toast(error, 5000);
    return false;
  }
  ajustes = nuevos;
  return true;
}

function registrarVenta(entrada: {
  punto: string;
  canal: Canal;
  qty: number;
  ts?: string;
  retro?: boolean;
  aviso: string;
}): void {
  const venta = crearVenta({
    ts: entrada.ts ?? isoLocal(new Date()),
    point: entrada.punto,
    channel: entrada.canal,
    vendor: estado.vendedor,
    qty: entrada.qty,
    device: ajustes.deviceId,
    ...(entrada.retro === true ? { retro: true } : {}),
  });
  if (!aplicarEventos([...eventos, venta])) return;
  toast(entrada.aviso);
  render();
  destacarHielera();
}

/** Corregir un toque de mas no pide confirmacion: el propio -1 es la correccion de un error rapido,
 *  y si tambien se toca por error basta un +1. Todo queda en el historico. */
function restarUna(punto: string): void {
  const anulacion = anularUltimaVenta(
    eventos,
    punto,
    claveFecha(new Date()),
    estado.vendedor,
    ajustes.deviceId,
    isoLocal(new Date())
  );
  if (anulacion === null) {
    toast(`No hay ventas de ${estado.vendedor} hoy en ${punto}`);
    return;
  }
  if (!aplicarEventos([...eventos, anulacion])) return;
  toast(`Última venta de ${estado.vendedor} anulada`);
  render();
  destacarHielera();
}

/**
 * Marcar lugar abre el turno de los dos: salen juntos al mismo punto y el registro es de un solo
 * telefono, asi que pedir el lugar dos veces solo serviria para que se olvide la segunda y las
 * ventas del otro queden fuera de turno.
 *
 * Los dos turnos comparten la marca de tiempo porque llegaron juntos; ordenarPorHora desempata
 * por id. Al que ya estaba en ese punto no se le escribe nada: un evento repetido partiria en
 * dos un rato que fue uno solo.
 */
function marcarLugar(punto: string): void {
  const hoy = claveFecha(new Date());
  const ts = isoLocal(new Date());
  const llegan = VENDEDORES.filter((v) => turnoActual(eventos, v, hoy)?.point !== punto);

  if (llegan.length === 0) {
    toast(`Ya están en ${punto}`);
    return;
  }
  const turnos = llegan.map((v) =>
    crearTurno({ ts, point: punto, vendor: v, device: ajustes.deviceId })
  );
  if (!aplicarEventos([...eventos, ...turnos])) return;
  toast(`${llegan.join(' y ')} en ${punto}`);
  render();
}

/**
 * La captura principal: "llegamos a la Plazuela a las cinco y se fueron doce". Escribe el turno
 * de los dos a esa hora y una venta por vendedor con lo suyo.
 */
function registrarHora(datos: {
  punto: string;
  hora: string;
  piezas: Record<Vendedor, number>;
}): void {
  const hoy = claveFecha(new Date());
  const ts = isoDesdeFechaYHora(hoy, datos.hora);
  if (ts === null) {
    toast('Hora invalida');
    return;
  }
  for (const vendedor of VENDEDORES) {
    const qty = datos.piezas[vendedor];
    if (!Number.isInteger(qty) || qty < 0) {
      toast('Cantidad invalida');
      return;
    }
  }

  const nuevos = eventosDeHora(eventos, {
    ts,
    fecha: hoy,
    point: datos.punto,
    device: ajustes.deviceId,
    piezas: datos.piezas,
  });
  if (nuevos.length === 0) {
    toast('Nada que registrar');
    return;
  }
  if (!aplicarEventos([...eventos, ...nuevos])) return;

  const total = VENDEDORES.reduce((suma, v) => suma + (datos.piezas[v] ?? 0), 0);
  toast(
    total === 0
      ? `${datos.punto} · ${datos.hora}`
      : `${datos.punto} ${datos.hora} · ${total} pieza${total === 1 ? '' : 's'}`
  );
  render();
  destacarHielera();
}

// ---------- correccion de lugar ----------

/**
 * La venta ocurrio, el lugar no: se anula y se vuelve a escribir en el punto correcto con su
 * misma hora. No mueve dinero —el corte suma piezas por canal— asi que tampoco se pregunta nada:
 * el historico guarda la vieja tachada y la nueva marcada MOVIDA.
 */
function moverVentaDeLugar(id: string, punto: string): void {
  const movida = moverVenta(eventos, id, punto, ajustes.deviceId, isoLocal(new Date()));
  if (movida === null) {
    toast('Esa venta ya no se puede mover');
    render();
    return;
  }
  if (!aplicarEventos([...eventos, movida.anulacion, movida.venta])) return;
  toast(`Venta movida a ${punto}`);
  render();
}

function pedirLugarDeVenta(id: string): void {
  const venta = eventos.find((e) => e.id === id);
  if (venta === undefined || venta.type !== 'sale') return;
  abrirMoverVenta(ajustes.points, venta.point, (punto) => moverVentaDeLugar(id, punto));
}

/** Lo que haria la correccion, sin escribir nada: el dialogo lo usa para el resumen en vivo. */
function planDeCorreccion(fecha: string, punto: string, hora: string): CorreccionLugar | null {
  const desde = isoDesdeFechaYHora(fecha, hora);
  if (desde === null) return null;
  return planCorreccionLugar(eventos, {
    desde,
    punto,
    device: ajustes.deviceId,
    ahora: isoLocal(new Date()),
  });
}

function corregirLugar(fecha: string, punto: string, hora: string): void {
  const plan = planDeCorreccion(fecha, punto, hora);
  if (plan === null) {
    toast('Con esos datos no hay nada que corregir');
    return;
  }
  if (!aplicarEventos([...eventos, ...plan.eventos])) return;
  toast(
    plan.piezas === 0
      ? `${plan.vendedores.join(' y ')} en ${punto} desde ${hora}`
      : `${plan.piezas} piezas pasan a ${punto}`,
    2500
  );
  // Sin pulso en la hielera: la pieza sigue siendo del mismo vendedor, solo cambio de lugar.
  render();
}

type Atajo = { etiqueta: string; pie: string; hora: string };

/**
 * Los dos extremos de la correccion salen de atajo, y se nombran por lo que hacen y no por la
 * hora que ponen: "solo la ultima venta" es el toque suelto en el lugar de al lado, y "todo el
 * turno" es haber tocado mal el lugar desde que llegaron. Lo de en medio —me movi a las 17:20 y
 * vendi tres— se teclea, que es justo cuando el resumen de piezas hace falta.
 */
function pedirCorreccionLugar(fecha: string): void {
  const turno = turnoActual(eventos, estado.vendedor, fecha);
  const ultima =
    turno === null ? null : ultimaVentaActiva(eventos, turno.point, fecha, estado.vendedor);

  const atajos = [
    ultima === null
      ? null
      : { etiqueta: 'Solo la última venta', pie: horaMinuto(ultima.ts), hora: horaMinuto(ultima.ts) },
    turno === null
      ? null
      : { etiqueta: 'Todo el turno', pie: `desde ${horaMinuto(turno.ts)}`, hora: horaMinuto(turno.ts) },
  ].filter((a): a is Atajo => a !== null);

  abrirCorreccionLugar({
    puntos: ajustes.points,
    actual: turno?.point ?? null,
    hora: atajos[0]?.hora ?? horaMinuto(isoLocal(new Date())),
    atajos,
    alPrevisualizar: (punto, hora) => planDeCorreccion(fecha, punto, hora),
    alConfirmar: (punto, hora) => corregirLugar(fecha, punto, hora),
  });
}

/**
 * Pasar botellas de una hielera a la otra para emparejarlas. No es una venta ni una carga:
 * el dia no gana ni pierde piezas, solo cambian de mano, y el ingreso del corte no se mueve.
 */
function registrarTraspaso(from: Vendedor, to: Vendedor, qty: number): void {
  const traspaso = crearTraspaso({
    ts: isoLocal(new Date()),
    from,
    to,
    qty,
    device: ajustes.deviceId,
  });
  if (traspaso === null) {
    toast('Traspaso invalido');
    return;
  }
  if (!aplicarEventos([...eventos, traspaso])) return;
  const hoy = claveFecha(new Date());
  const destino = hieleraDe(eventos, to, hoy);
  toast(`${from} → ${to} ×${qty} · ${to} lleva ${destino.restante}`, 2500);
  render();
  destacarHielera();
}

function cargarHielera(vendedor: Vendedor, qty: number): void {
  const carga = crearCarga({
    ts: isoLocal(new Date()),
    vendor: vendedor,
    qty,
    device: ajustes.deviceId,
  });
  if (!aplicarEventos([...eventos, carga])) return;
  const total = hieleraDe(eventos, vendedor, claveFecha(new Date()));
  toast(`${vendedor} carga ${qty} · lleva ${total.restante} en la hielera`, 2500);
  render();
  destacarHielera();
}

function capturarCargaRetro(datos: DatosCargaRetro): void {
  const ts = isoDesdeFechaYHora(datos.fecha, datos.hora);
  if (ts === null) {
    toast('Fecha u hora invalida');
    return;
  }
  if (!Number.isInteger(datos.qty) || datos.qty < 1) {
    toast('Cantidad invalida');
    return;
  }
  const carga = crearCarga({ ts, vendor: datos.vendedor, qty: datos.qty, device: ajustes.deviceId });
  if (!aplicarEventos([...eventos, carga])) return;
  toast(`Carga retroactiva: ${datos.vendedor} ×${datos.qty}`);
  estado.fecha = datos.fecha;
  render();
}

const QUE: Record<string, { pregunta: string; aviso: string }> = {
  load: { pregunta: 'esta carga', aviso: 'Carga anulada' },
  shift: { pregunta: 'este lugar', aviso: 'Lugar anulado' },
  sale: { pregunta: 'esta venta', aviso: 'Venta anulada' },
  transfer: { pregunta: 'este traspaso', aviso: 'Traspaso anulado' },
};

function anular(id: string): void {
  const evento = eventos.find((e) => e.id === id);
  const texto = QUE[evento?.type ?? 'sale'] ?? QUE['sale'];
  if (texto === undefined) return;
  if (!window.confirm(`Anular ${texto.pregunta}? Queda registrada como anulacion, no se borra.`))
    return;
  const anulacion = crearAnulacion(eventos, id, ajustes.deviceId, isoLocal(new Date()));
  if (anulacion === null) {
    toast('Eso ya estaba anulado');
    render();
    return;
  }
  if (!aplicarEventos([...eventos, anulacion])) return;
  toast(texto.aviso);
  render();
}

function capturarRetro(datos: DatosRetro): void {
  const ts = isoDesdeFechaYHora(datos.fecha, datos.hora);
  if (ts === null) {
    toast('Fecha u hora invalida');
    return;
  }
  if (!Number.isInteger(datos.qty) || datos.qty < 1) {
    toast('Cantidad invalida');
    return;
  }
  const venta = crearVenta({
    ts,
    point: datos.punto,
    channel: datos.canal,
    vendor: datos.vendedor,
    qty: datos.qty,
    device: ajustes.deviceId,
    retro: true,
  });
  if (!aplicarEventos([...eventos, venta])) return;
  toast(`Retroactiva: ${datos.punto} ×${datos.qty}`);
  estado.fecha = datos.fecha;
  render();
}

// ---------- puntos ----------

function agregarPunto(nombre: string): void {
  const limpio = nombre.trim();
  if (!puedeAgregarPunto(ajustes.points, limpio)) {
    toast('Nombre vacio, muy largo o repetido');
    return;
  }
  if (aplicarAjustes({ ...ajustes, points: [...ajustes.points, limpio] })) render();
}

function eliminarPunto(nombre: string): void {
  if (ajustes.points.length <= 1) {
    toast('Debe quedar al menos un punto');
    return;
  }
  if (!window.confirm(`Quitar "${nombre}" de la lista? Su historico se conserva.`)) return;
  if (aplicarAjustes({ ...ajustes, points: quitarPunto(ajustes.points, nombre) })) render();
}

// ---------- respaldo ----------

function descargar(contenido: string, nombre: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'application/json' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportar(): void {
  const archivo: ArchivoExport = {
    app: NOMBRE_APP,
    version: 1,
    exportedAt: isoLocal(new Date()),
    device: ajustes.deviceId,
    events: eventos,
  };
  descargar(JSON.stringify(archivo), `refreskte-${claveFecha(new Date())}-${ajustes.deviceId}.json`);
  toast(`Exportados ${eventos.length} eventos`);
}

/** El respaldo sale envuelto como export para que se pueda reimportar tal cual si hace falta. */
function descargarRespaldo(): void {
  const crudo = leerRespaldo();
  if (crudo === null) {
    toast('No hay respaldo previo en este dispositivo');
    return;
  }
  const archivo: ArchivoExport = {
    app: NOMBRE_APP,
    version: 1,
    exportedAt: isoLocal(new Date()),
    device: ajustes.deviceId,
    events: JSON.parse(crudo) as AppEvent[],
  };
  descargar(JSON.stringify(archivo), `refreskte-respaldo-${ajustes.deviceId}.json`);
  toast('Respaldo previo descargado');
}

/** Cuantos eventos guardo la migracion. null si nunca hubo datos previos o quedaron ilegibles. */
function eventosRespaldados(): number | null {
  const crudo = leerRespaldo();
  if (crudo === null) return null;
  try {
    const valor: unknown = JSON.parse(crudo);
    return Array.isArray(valor) ? valor.length : null;
  } catch {
    return null;
  }
}

/** Compartir nativo si lo hay, si no portapapeles, y si no un prompt del que se pueda copiar a mano. */
async function compartirTexto(texto: string, aviso: string): Promise<void> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: texto });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(texto);
    toast(aviso);
  } catch {
    window.prompt('Copia el texto:', texto);
  }
}

async function compartirResumen(): Promise<void> {
  await compartirTexto(resumenTexto(eventos, estado.fecha, ajustes.points), 'Resumen copiado');
}

async function importar(archivo: File): Promise<void> {
  if (archivo.size > TAMANO_MAXIMO_IMPORT) {
    toast('Archivo demasiado grande');
    return;
  }
  let valor: unknown;
  try {
    valor = JSON.parse(await archivo.text());
  } catch {
    toast('El archivo no es JSON valido');
    return;
  }
  const entrantes = eventosDeArchivo(valor);
  if (entrantes === null) {
    toast('Archivo no reconocido: falta "events" o no es version 1');
    return;
  }

  const resultado = mezclar(eventos, entrantes);
  if (resultado.nuevos > 0 && !aplicarEventos(resultado.eventos)) return;
  toast(
    `Nuevos ${resultado.nuevos} · repetidos ${resultado.repetidos} · invalidos ${resultado.invalidos}`,
    5000
  );
  render();
}

// ---------- corte de caja ----------

// El corte solo LEE los eventos de venta. Todo lo que escribe va a sus propias claves.

function aplicarBorradores(nuevos: Borrador[]): boolean {
  const error = escribirBorradores(nuevos);
  if (error !== null) {
    toast(error, 5000);
    return false;
  }
  borradores = nuevos;
  return true;
}

function borradorActual(): Borrador {
  return borradorDe(borradores, estado.fechaCorte);
}

function guardarYPintar(borrador: Borrador): boolean {
  if (!aplicarBorradores(guardarBorrador(borradores, borrador))) return false;
  render();
  return true;
}

function agregarGasto(concepto: string, monto: string): void {
  const limpio = concepto.trim();
  if (limpio === '' || limpio.length > LARGO_MAXIMO_TEXTO) {
    toast('Escribe el concepto del gasto');
    return;
  }
  const centavos = centavosDesde(monto);
  if (centavos === null || centavos < 1) {
    toast('Monto invalido');
    return;
  }
  const linea = nuevaLinea(limpio, centavos, nuevoId(ajustes.deviceId));

  // El efectivo sale del fondo y, si no alcanza, de lo apartado para gasolina. Se escribe en la
  // caja antes que el gasto: si la caja no se pudo guardar, el gasto tampoco se captura y las
  // dos libretas no se separan.
  const ahora = new Date();
  const delGasto = movimientosDeGasto({
    gastoId: linea.id,
    concepto: limpio,
    ts: isoLocal(ahora),
    fecha: claveFecha(ahora),
    device: ajustes.deviceId,
    origen: origenDelGasto(estadoCaja(movimientos), centavos),
  });
  if (delGasto.length > 0 && !aplicarMovimientos(agregarMovimientos(movimientos, delGasto))) {
    return;
  }

  if (!guardarYPintar(conGasto(borradorActual(), linea))) return;

  const deLaCaja = delGasto.reduce((total, m) => total - m.centavos, 0);
  if (deLaCaja < centavos) {
    // La caja no tenia con que cubrirlo entero: el resto salio de la venta del dia o de una
    // bolsa. El gasto cuenta completo igual; solo no se inventa efectivo que la caja no tuvo.
    toast(`Gasto capturado · de la caja salieron ${importe(deLaCaja)}`, 3500);
  }
  enfocarGasto();
}

/**
 * El borrador es editable hasta que se cierra: borrar una linea mal capturada no pregunta nada.
 * Se lleva con ella el efectivo que habia sacado de la caja, o el fondo quedaria corto por un
 * gasto que ya no existe.
 */
function quitarGasto(id: string): void {
  const sinSuEfectivo = sinMovimientosDeGasto(movimientos, id);
  if (sinSuEfectivo.length !== movimientos.length && !aplicarMovimientos(sinSuEfectivo)) return;
  guardarYPintar(sinGasto(borradorActual(), id));
}

function montoOpcional(texto: string): number | null {
  const limpio = texto.trim();
  return limpio === '' ? 0 : centavosDesde(limpio);
}

// ---------- caja: sobres y movimientos ----------

// La caja tampoco toca las ventas ni el corte: escribe solo en refreskte:caja:v1.

function aplicarMovimientos(nuevos: MovimientoCaja[]): boolean {
  const error = escribirMovimientos(nuevos);
  if (error !== null) {
    toast(error, 5000);
    return false;
  }
  movimientos = nuevos;
  return true;
}

/**
 * Lee los campos crudos de la pantalla. Devuelve null y avisa cuando algo no cuadra, para que
 * captura y correccion validen igual sin repetir los mensajes.
 */
function leerCaptura(
  captura: CapturaCaja
): { centavos: number; concepto: string } | null {
  const monto = centavosDesde(captura.monto);
  if (monto === null || monto < 1) {
    toast('Monto invalido');
    return null;
  }
  const concepto = captura.concepto.trim();
  if (concepto.length > LARGO_MAXIMO_TEXTO) {
    toast('Concepto demasiado largo');
    return null;
  }
  return {
    centavos: captura.signo * monto,
    // Sin concepto no se rechaza la captura: el sobre ya dice casi todo.
    concepto: concepto === '' ? NOMBRE_SOBRE[captura.sobre] : concepto,
  };
}

/**
 * Un movimiento capturado a mano. Nace abierto: se puede corregir hasta que un cierre lo selle.
 * El signo lo pone el boton y el tipo lo deduce el dominio; Fran solo teclea cuanto y de que.
 */
function moverCaja(captura: CapturaCaja): void {
  const datos = leerCaptura(captura);
  if (datos === null) return;

  const ahora = new Date();
  const movimiento: MovimientoCaja = {
    id: nuevoId(ajustes.deviceId),
    ts: isoLocal(ahora),
    fecha: claveFecha(ahora),
    device: ajustes.deviceId,
    tipo: tipoDeMovimiento(captura.signo),
    sobre: captura.sobre,
    centavos: datos.centavos,
    concepto: datos.concepto,
    abierto: true,
  };

  if (!aplicarMovimientos(agregarMovimientos(movimientos, [movimiento]))) return;
  toast(`${importe(movimiento.centavos)} · ${NOMBRE_SOBRE[captura.sobre]}`);
  render();
}

/** Corregir un movimiento todavia abierto. El dominio rechaza los sellados; aqui solo se avisa. */
function corregirCaja(id: string, captura: CapturaCaja): void {
  const datos = leerCaptura(captura);
  if (datos === null) return;

  const nuevos = editarMovimiento(movimientos, id, {
    sobre: captura.sobre,
    centavos: datos.centavos,
    concepto: datos.concepto,
  });
  if (nuevos === null) {
    toast('Ese movimiento ya quedó sellado por un corte');
    render();
    return;
  }
  if (!aplicarMovimientos(nuevos)) return;
  toast('Movimiento corregido');
  render();
}

function borrarDeCaja(id: string): void {
  const movimiento = movimientos.find((m) => m.id === id);
  if (movimiento === undefined) return;
  const confirmado = window.confirm(
    `Borrar ${importe(movimiento.centavos)} de ${NOMBRE_SOBRE[movimiento.sobre]}?\n` +
      `${movimiento.concepto}`
  );
  if (!confirmado) return;

  const nuevos = borrarMovimiento(movimientos, id);
  if (nuevos === null) {
    toast('Ese movimiento ya quedó sellado por un corte');
    render();
    return;
  }
  if (!aplicarMovimientos(nuevos)) return;
  toast('Movimiento borrado');
  render();
}

/**
 * Contar el bulto contra el libro. El ajuste no se aplica solo: se ensena la diferencia y Fran
 * decide, porque un faltante puede ser un movimiento que falto capturar y no dinero perdido.
 */
function arquearCaja(contado: string): void {
  const centavos = centavosDesde(contado);
  if (centavos === null || centavos < 0) {
    toast('Monto invalido');
    return;
  }

  const resultado = arquear(estadoCaja(movimientos), centavos);
  if (resultado.diferencia === 0) {
    toast('La caja cuadra');
    return;
  }

  const falta = resultado.diferencia < 0;
  const confirmado = window.confirm(
    `La caja dice ${importe(resultado.calculado)} y contaste ${importe(resultado.contado)}.\n\n` +
      `${falta ? 'Faltan' : 'Sobran'} ${importe(Math.abs(resultado.diferencia))}.\n\n` +
      `Cuadrar con un ajuste al fondo? ${
        falta ? 'Queda como deuda a la caja.' : 'Cuenta como dinero devuelto.'
      }`
  );
  if (!confirmado) return;

  const ahora = new Date();
  const movimiento = movimientoDeArqueo({
    id: nuevoId(ajustes.deviceId),
    ts: isoLocal(ahora),
    fecha: claveFecha(ahora),
    device: ajustes.deviceId,
    // El fondo es el sobre de trabajo: de ahi salen los gastos, y ahi es donde un descuadre
    // aparece casi siempre.
    sobre: 'fondo',
    diferencia: resultado.diferencia,
  });
  if (movimiento === null) return;
  if (!aplicarMovimientos(agregarMovimientos(movimientos, [movimiento]))) return;
  toast(`Caja cuadrada · ${importe(resultado.diferencia)}`);
  render();
}

/**
 * El domingo: se paga lo apartado y los sobres quedan en cero. No toca la utilidad ni el corte,
 * solo saca de la caja el efectivo que ya tenia dueno.
 */
function cerrarSemana(): void {
  const plan = planSemana(estadoCaja(movimientos));
  if (plan.total === 0) {
    toast('No hay nada apartado que pagar');
    return;
  }

  const ahora = new Date();
  const fecha = claveFecha(ahora);
  const detalle = plan.pagos
    .map((pago) => `${NOMBRE_SOBRE[pago.sobre]} ${importe(pago.centavos)}`)
    .join('\n');
  const confirmado = window.confirm(
    `Cerrar la semana del ${fechaLegible(fecha)}?\n\n${detalle}\n\n` +
      `Total ${importe(plan.total)}\n\n` +
      'Los sobres quedan en cero. No se puede deshacer.'
  );
  if (!confirmado) return;

  const delCierre = movimientosDeSemana({
    fecha,
    ts: isoLocal(ahora),
    device: ajustes.deviceId,
    plan,
  });
  if (!aplicarMovimientos(agregarMovimientos(movimientos, delCierre))) return;
  toast(`Semana cerrada · ${importe(plan.total)}`, 3500);
  render();
}

function cambiarTasas(gasolina: string, gas: string): void {
  const porGasolina = montoOpcional(gasolina);
  const porGas = montoOpcional(gas);
  if (porGasolina === null || porGas === null) {
    toast('Monto de apartado invalido');
    return;
  }
  const nuevas = validarTasas({ gasolina: porGasolina, gas: porGas });
  const error = escribirTasas(nuevas);
  if (error !== null) {
    toast(error, 5000);
    return;
  }
  tasas = nuevas;
  toast('Apartado guardado · los cortes ya cerrados no cambian');
  render();
}

function cambiarPrecios(calle: string, mayoreo: string): void {
  const porCalle = centavosDesde(calle);
  const porMayoreo = centavosDesde(mayoreo);
  if (porCalle === null || porCalle < 1 || porMayoreo === null || porMayoreo < 1) {
    toast('Precio invalido');
    return;
  }
  const nuevos: Precios = { calle: porCalle, mayoreo: porMayoreo };
  const error = escribirPrecios(nuevos);
  if (error !== null) {
    toast(error, 5000);
    return;
  }
  precios = nuevos;
  toast('Precios guardados · los cortes ya cerrados no cambian');
  render();
}

/**
 * Cierre irreversible. Guarda el snapshot del ingreso calculado en este momento, no una
 * referencia a las ventas: corregir manana una venta de hoy no puede mover este corte.
 *
 * Tambien mueve la caja: aparta lo del dia, le abona su mitad a Primo y devuelve lo prestado
 * hasta donde alcance. Los movimientos van primero y el corte despues, porque el corte guarda
 * como quedo la caja: al reves guardaria un snapshot de algo que todavia no pasaba.
 */
function cerrarCorteDelDia(): void {
  const fecha = estado.fechaCorte;
  if (corteDeFecha(cortes, fecha) !== null) {
    toast('Ya hay un corte cerrado de esa fecha');
    render();
    return;
  }

  const borrador = borradorActual();
  const ingreso = ingresoDeFecha(eventos, fecha, precios);
  const reparto = repartoDeBorrador(borrador, ingreso);
  const plan = planCaja({
    utilidad: reparto.utilidad,
    deuda: estadoCaja(movimientos).deuda,
    tasas,
    huboVentas: ingreso.total > 0,
  });

  const confirmado = window.confirm(
    `Cerrar el corte del ${fechaLegible(fecha)}?\n\n` +
      `Utilidad ${importe(reparto.utilidad)}\n` +
      `Se aparta ${importe(plan.totalApartado)}\n` +
      `Se reparte ${importe(plan.repartible)}\n\n` +
      `Tuyo ${importe(plan.fran)}\n` +
      `Primo ${importe(plan.primo)}\n\n` +
      'Cada mitad se va a su sobre. Un corte cerrado no se edita ni se borra.'
  );
  if (!confirmado) return;

  const cerradoEn = isoLocal(new Date());
  const delCierre = movimientosDeCierre({
    fecha,
    ts: cerradoEn,
    device: ajustes.deviceId,
    plan,
  });

  // Sellar va en el mismo guardado que el apartado: el corte guarda como quedo la caja, y un
  // movimiento que siguiera editable despues desmentiria ese registro inmutable.
  const conMovimientos = sellarMovimientos(agregarMovimientos(movimientos, delCierre));
  if (!aplicarMovimientos(conMovimientos)) return;

  const caja = estadoCaja(conMovimientos);
  const corte = cerrarCorte({
    borrador,
    ingreso,
    precios,
    device: ajustes.deviceId,
    cerradoEn,
    apartado: plan.totalApartado,
    caja: { hay: caja.hay, deuda: caja.deuda },
  });
  const nuevos = agregarCorte(cortes, corte);
  if (nuevos === null) {
    toast('Ya hay un corte cerrado de esa fecha');
    render();
    return;
  }
  const error = escribirCortes(nuevos);
  if (error !== null) {
    toast(error, 5000);
    return;
  }
  cortes = nuevos;
  // El borrador ya cumplio: el registro bueno es el corte cerrado. Si esto falla no importa,
  // la vista ya lee del cerrado.
  aplicarBorradores(guardarBorrador(borradores, borradorVacio(fecha)));
  toast(`Corte cerrado · te tocan ${importe(plan.fran)}`, 3500);
  render();
}

/**
 * Sacar de tu sobre lo que ya tienes ganado. Es un pago, no un prestamo: ese dinero ya era tuyo
 * y cobrarlo no deja deuda con la caja.
 */
function cobrarSobre(sobre: Sobre): void {
  const saldo = estadoCaja(movimientos).sobres.find((s) => s.sobre === sobre);
  if (saldo === undefined || saldo.hay <= 0) {
    toast('No hay nada acumulado que cobrar');
    return;
  }

  const confirmado = window.confirm(
    `Cobrar ${importe(saldo.hay)} de ${NOMBRE_SOBRE[sobre]}?\n\nEse dinero sale de la caja.`
  );
  if (!confirmado) return;

  const ahora = new Date();
  const cobro = movimientoDeCobro({
    id: nuevoId(ajustes.deviceId),
    ts: isoLocal(ahora),
    fecha: claveFecha(ahora),
    device: ajustes.deviceId,
    sobre,
    centavos: saldo.hay,
  });
  if (cobro === null) return;
  if (!aplicarMovimientos(agregarMovimientos(movimientos, [cobro]))) return;
  toast(`Cobrado ${importe(saldo.hay)}`);
  render();
}

async function copiarCorte(): Promise<void> {
  const corte = corteDeFecha(cortes, estado.fechaCorte);
  if (corte === null) return;
  await compartirTexto(resumenCorte(corte), 'Corte copiado');
}

// ---------- render ----------

function vistaActual(): HTMLElement {
  const ahora = new Date();
  const hoy = claveFecha(ahora);
  switch (estado.vista) {
    case 'vender':
      return vistaVender({
        eventos,
        ajustes,
        vendedor: estado.vendedor,
        hoy,
        ahora,
        alMarcarLugar: marcarLugar,
        alCambiarVendedor: (v) => {
          estado.vendedor = v;
          render();
        },
        alVender: (punto, qty) =>
          registrarVenta({ punto, canal: 'calle', qty, aviso: `+${qty} · ${punto}` }),
        alRestar: restarUna,
        alCorregirLugar: () => pedirCorreccionLugar(hoy),
        alAbrirMayoreo: () =>
          abrirMayoreo(ajustes.points, (punto, qty) =>
            registrarVenta({ punto, canal: 'mayoreo', qty, aviso: `Mayoreo ${punto} ×${qty}` })
          ),
        alAbrirCarga: (v) =>
          abrirCarga(v, (quien) => hieleraDe(eventos, quien, hoy), cargarHielera),
        alAbrirTraspaso: () =>
          abrirTraspaso(
            estado.vendedor,
            (quien) => hieleraDe(eventos, quien, hoy),
            registrarTraspaso
          ),
        alRegistrarHora: registrarHora,
        alIrA: irAVista,
      });
    case 'hoy':
      return vistaHoy({
        eventos,
        ajustes,
        fecha: estado.fecha,
        ahora,
        alCambiarFecha: (f) => {
          estado.fecha = f;
          render();
        },
        alAnular: anular,
        alMoverVenta: pedirLugarDeVenta,
        alCorregirLugar: () => pedirCorreccionLugar(estado.fecha),
        alAbrirRetro: () => abrirRetro(ajustes, estado.fecha, capturarRetro),
        alAbrirCargaRetro: () => abrirCargaRetro(ajustes, estado.fecha, capturarCargaRetro),
        alIrA: irAVista,
      });
    case 'caja':
      return vistaCaja({
        caja: estadoCaja(movimientos),
        movimientos,
        tasas,
        semana: planSemana(estadoCaja(movimientos)),
        alMover: moverCaja,
        alEditar: corregirCaja,
        alBorrar: borrarDeCaja,
        alArquear: arquearCaja,
        alCerrarSemana: cerrarSemana,
        alCobrar: cobrarSobre,
        alCambiarTasas: cambiarTasas,
        alCopiar: () =>
          void compartirTexto(resumenCaja(estadoCaja(movimientos)), 'Caja copiada'),
        alIrA: irAVista,
      });
    case 'corte':
      return vistaCorte({
        fecha: estado.fechaCorte,
        ingreso: ingresoDeFecha(eventos, estado.fechaCorte, precios),
        precios,
        borrador: borradorDe(borradores, estado.fechaCorte),
        cerrado: corteDeFecha(cortes, estado.fechaCorte),
        caja: estadoCaja(movimientos),
        cajaAlAbrir: cajaParaEsperado(movimientos, estado.fechaCorte),
        tasas,
        alCambiarFecha: (f) => {
          estado.fechaCorte = f;
          render();
        },
        alAgregarGasto: agregarGasto,
        alQuitarGasto: quitarGasto,
        alCambiarPrecios: cambiarPrecios,
        alCerrar: cerrarCorteDelDia,
        alCopiar: () => void copiarCorte(),
        alVerCaja: () => irAVista('caja'),
        alIrA: irAVista,
      });
    case 'stats':
      return vistaStats({
        eventos,
        ajustes,
        rango: estado.rango,
        canal: estado.canal,
        vendedor: estado.vendedorStats,
        ahora,
        alCambiarRango: (r) => {
          estado.rango = r;
          render();
        },
        alCambiarCanal: (c) => {
          estado.canal = c;
          render();
        },
        alCambiarVendedor: (v) => {
          estado.vendedorStats = v;
          render();
        },
        alVolver: () => irAVista(estado.vistaPrevia),
      });
    case 'ajustes':
      return vistaAjustes({
        ajustes,
        totalEventos: eventos.length,
        eventosRespaldados: eventosRespaldados(),
        alDescargarRespaldo: descargarRespaldo,
        alAgregarPunto: agregarPunto,
        alQuitarPunto: eliminarPunto,
        alCambiarVendedorDefecto: (v) => {
          if (aplicarAjustes({ ...ajustes, defaultVendor: v })) {
            estado.vendedor = v;
            render();
          }
        },
        alExportar: exportar,
        alCompartir: () => void compartirResumen(),
        alImportar: (archivo) => void importar(archivo),
        alVolver: () => irAVista(estado.vistaPrevia),
      });
  }
}

function render(): void {
  limpiar(app);
  app.appendChild(vistaActual());
  pintarNav(nav, estado.vista, irAVista);
}

render();

for (const aviso of [
  lecturaAjustes.aviso,
  lecturaEventos.aviso,
  lecturaCortes.aviso,
  lecturaBorradores.aviso,
  lecturaMovimientos.aviso,
]) {
  if (aviso !== null) toast(aviso, 6000);
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
