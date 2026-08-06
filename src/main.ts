import './estilos.css';
import type { AppEvent, ArchivoExport, Canal, Settings, Vendedor } from './tipos';
import type { Rango } from './dominio';
import {
  LARGO_MAXIMO_TEXTO,
  NOMBRE_APP,
  anularUltimaVenta,
  claveFecha,
  crearAnulacion,
  crearCarga,
  crearTurno,
  crearVenta,
  eventosDeArchivo,
  fechaLegible,
  hieleraDe,
  isoDesdeFechaYHora,
  isoLocal,
  mezclar,
  nuevoId,
  puedeAgregarPunto,
  quitarPunto,
  resumenTexto,
  turnoActual,
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
import {
  escribirAjustes,
  escribirBorradores,
  escribirCortes,
  escribirEventos,
  escribirPrecios,
  leerAjustes,
  leerBorradores,
  leerCortes,
  leerEventos,
  leerPrecios,
  leerRespaldo,
  migrar,
} from './almacenamiento';
import type { DatosCargaRetro, DatosRetro, Vista } from './ui';
import {
  abrirCarga,
  abrirCargaRetro,
  abrirMayoreo,
  abrirRetro,
  destacarHielera,
  enfocarGasto,
  limpiar,
  pintarNav,
  toast,
  vistaAjustes,
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

let ajustes: Settings = lecturaAjustes.datos;
let eventos: AppEvent[] = lecturaEventos.datos;
let cortes: CorteCerrado[] = lecturaCortes.datos;
let borradores: Borrador[] = lecturaBorradores.datos;
let precios: Precios = leerPrecios();

escribirAjustes(ajustes);

const estado: {
  vista: Vista;
  vendedor: Vendedor;
  fecha: string;
  fechaCorte: string;
  rango: Rango;
  canal: Canal | 'todo';
  vendedorStats: Vendedor | 'todos';
} = {
  vista: 'vender',
  vendedor: ajustes.defaultVendor,
  fecha: claveFecha(new Date()),
  fechaCorte: claveFecha(new Date()),
  rango: 'hoy',
  canal: 'calle',
  vendedorStats: 'todos',
};

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
    ajustes.deviceId,
    isoLocal(new Date())
  );
  if (anulacion === null) {
    toast(`No hay ventas de hoy en ${punto}`);
    return;
  }
  if (!aplicarEventos([...eventos, anulacion])) return;
  toast(`Última venta de ${punto} anulada`);
  render();
  destacarHielera();
}

/**
 * Marcar lugar abre un turno. Volver a marcar el mismo no registra nada: el turno ya esta abierto
 * y un evento repetido solo partiria en dos un rato que fue uno solo.
 */
function marcarLugar(punto: string): void {
  const hoy = claveFecha(new Date());
  const actual = turnoActual(eventos, estado.vendedor, hoy);
  if (actual !== null && actual.point === punto) {
    toast(`${estado.vendedor} ya está en ${punto}`);
    return;
  }
  const turno = crearTurno({
    ts: isoLocal(new Date()),
    point: punto,
    vendor: estado.vendedor,
    device: ajustes.deviceId,
  });
  if (!aplicarEventos([...eventos, turno])) return;
  toast(`${estado.vendedor} en ${punto}`);
  render();
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
  if (!guardarYPintar(conGasto(borradorActual(), linea))) return;
  enfocarGasto();
}

/** El borrador es editable hasta que se cierra: borrar una linea mal capturada no pregunta nada. */
function quitarGasto(id: string): void {
  guardarYPintar(sinGasto(borradorActual(), id));
}

function montoOpcional(texto: string): number | null {
  const limpio = texto.trim();
  return limpio === '' ? 0 : centavosDesde(limpio);
}

function cambiarReponer(monto: string): void {
  const centavos = montoOpcional(monto);
  if (centavos === null) {
    toast('Monto a reponer invalido');
    return;
  }
  const borrador = borradorActual();
  // El evento 'change' tambien salta al salir del campo sin haber tocado nada.
  if (borrador.reponerCaja === centavos) return;
  guardarYPintar({ ...borrador, reponerCaja: centavos });
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
 */
function cerrarCorteDelDia(reponerTexto: string): void {
  const fecha = estado.fechaCorte;
  if (corteDeFecha(cortes, fecha) !== null) {
    toast('Ya hay un corte cerrado de esa fecha');
    render();
    return;
  }
  const reponer = montoOpcional(reponerTexto);
  if (reponer === null) {
    toast('Monto a reponer invalido');
    return;
  }

  const borrador: Borrador = { ...borradorActual(), reponerCaja: reponer };
  const ingreso = ingresoDeFecha(eventos, fecha, precios);
  const reparto = repartoDeBorrador(borrador, ingreso);

  const confirmado = window.confirm(
    `Cerrar el corte del ${fechaLegible(fecha)}?\n\n` +
      `Utilidad ${importe(reparto.utilidad)}\n` +
      `Fran ${importe(reparto.fran)}\n` +
      `Primo ${importe(reparto.primo)}\n\n` +
      'Un corte cerrado no se edita ni se borra.'
  );
  if (!confirmado) return;

  const corte = cerrarCorte({
    borrador,
    ingreso,
    precios,
    device: ajustes.deviceId,
    cerradoEn: isoLocal(new Date()),
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
  toast('Corte cerrado', 2500);
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
        alAbrirMayoreo: () =>
          abrirMayoreo(ajustes.points, (punto, qty) =>
            registrarVenta({ punto, canal: 'mayoreo', qty, aviso: `Mayoreo ${punto} ×${qty}` })
          ),
        alAbrirCarga: (v) =>
          abrirCarga(v, (quien) => hieleraDe(eventos, quien, hoy), cargarHielera),
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
        alAbrirRetro: () => abrirRetro(ajustes, estado.fecha, capturarRetro),
        alAbrirCargaRetro: () => abrirCargaRetro(ajustes, estado.fecha, capturarCargaRetro),
      });
    case 'corte':
      return vistaCorte({
        fecha: estado.fechaCorte,
        ingreso: ingresoDeFecha(eventos, estado.fechaCorte, precios),
        precios,
        borrador: borradorDe(borradores, estado.fechaCorte),
        cerrado: corteDeFecha(cortes, estado.fechaCorte),
        alCambiarFecha: (f) => {
          estado.fechaCorte = f;
          render();
        },
        alAgregarGasto: agregarGasto,
        alQuitarGasto: quitarGasto,
        alCambiarReponer: cambiarReponer,
        alCambiarPrecios: cambiarPrecios,
        alCerrar: cerrarCorteDelDia,
        alCopiar: () => void copiarCorte(),
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
      });
  }
}

function render(): void {
  limpiar(app);
  app.appendChild(vistaActual());
  pintarNav(nav, estado.vista, (v) => {
    estado.vista = v;
    if (v === 'hoy') estado.fecha = claveFecha(new Date());
    if (v === 'corte') estado.fechaCorte = claveFecha(new Date());
    render();
    window.scrollTo(0, 0);
  });
}

render();

for (const aviso of [
  lecturaAjustes.aviso,
  lecturaEventos.aviso,
  lecturaCortes.aviso,
  lecturaBorradores.aviso,
]) {
  if (aviso !== null) toast(aviso, 6000);
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
