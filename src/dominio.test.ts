import { describe, expect, it } from 'vitest';
import type {
  AppEvent,
  LoadEvent,
  SaleEvent,
  ShiftEvent,
  TransferEvent,
  VoidEvent,
} from './tipos';
import {
  anularUltimaVenta,
  claveFecha,
  crearAnulacion,
  crearTraspaso,
  duracionLegible,
  enHielera,
  eventosDeArchivo,
  eventosDeHora,
  filtrarRango,
  hieleraDe,
  hieleras,
  isoDesdeFechaYHora,
  jornada,
  mezclar,
  moverVenta,
  panelVendedor,
  planCorreccionLugar,
  planRespaldo,
  porDia,
  porHora,
  porLugarYHora,
  porPunto,
  porVendedor,
  planConteo,
  puedeAgregarPunto,
  quitarPunto,
  resumenTexto,
  ritmo,
  sugerenciaEquilibrio,
  totalDelDia,
  totalPiezas,
  turnoActual,
  turnoEn,
  ultimaVentaActiva,
  validarEvento,
  ventasActivas,
  ventasDeFecha,
} from './dominio';

function venta(parcial: Partial<SaleEvent> & { id: string; ts: string }): SaleEvent {
  return {
    type: 'sale',
    point: 'Plazuela',
    channel: 'calle',
    vendor: 'Fran',
    qty: 1,
    device: 'dev1',
    ...parcial,
  };
}

function carga(parcial: Partial<LoadEvent> & { id: string; ts: string }): LoadEvent {
  return { type: 'load', vendor: 'Fran', qty: 60, device: 'dev1', ...parcial };
}

function anulacion(id: string, refId: string): VoidEvent {
  return { id, type: 'void', ts: '2026-07-30T12:00:00', refId, device: 'dev1' };
}

function turno(parcial: Partial<ShiftEvent> & { id: string; ts: string }): ShiftEvent {
  return { type: 'shift', point: 'Plazuela', vendor: 'Fran', device: 'dev1', ...parcial };
}

function traspaso(parcial: Partial<TransferEvent> & { id: string; ts: string }): TransferEvent {
  return { type: 'transfer', from: 'Primo', to: 'Fran', qty: 1, device: 'dev1', ...parcial };
}

describe('ventasActivas', () => {
  it('excluye las ventas con anulacion y conserva el resto', () => {
    const eventos: AppEvent[] = [
      venta({ id: 'a', ts: '2026-07-30T09:00:00' }),
      venta({ id: 'b', ts: '2026-07-30T10:00:00', qty: 3 }),
      anulacion('v1', 'a'),
    ];
    expect(ventasActivas(eventos).map((v) => v.id)).toEqual(['b']);
  });

  it('ignora anulaciones que apuntan a ventas inexistentes', () => {
    const eventos: AppEvent[] = [venta({ id: 'a', ts: '2026-07-30T09:00:00' }), anulacion('v1', 'zzz')];
    expect(ventasActivas(eventos).map((v) => v.id)).toEqual(['a']);
  });

  it('no muta ni reordena el arreglo original', () => {
    const eventos: AppEvent[] = [
      venta({ id: 'b', ts: '2026-07-30T10:00:00' }),
      venta({ id: 'a', ts: '2026-07-30T09:00:00' }),
    ];
    const copia = [...eventos];
    ventasActivas(eventos);
    ventasDeFecha(eventos, '2026-07-30');
    expect(eventos).toEqual(copia);
  });
});

describe('crearAnulacion', () => {
  it('devuelve null si la venta ya fue anulada: solo se anula una vez', () => {
    const eventos: AppEvent[] = [venta({ id: 'a', ts: '2026-07-30T09:00:00' }), anulacion('v1', 'a')];
    expect(crearAnulacion(eventos, 'a', 'dev1', '2026-07-30T13:00:00')).toBeNull();
  });

  it('devuelve null si la venta no existe', () => {
    expect(crearAnulacion([], 'a', 'dev1', '2026-07-30T13:00:00')).toBeNull();
  });

  it('una segunda anulacion forzada no cambia el conteo activo', () => {
    const base: AppEvent[] = [venta({ id: 'a', ts: '2026-07-30T09:00:00' })];
    const conUna = [...base, anulacion('v1', 'a')];
    const conDos = [...conUna, anulacion('v2', 'a')];
    expect(ventasActivas(conDos)).toEqual(ventasActivas(conUna));
  });
});

describe('anularUltimaVenta', () => {
  const HOY = '2026-07-30';

  it('anula la venta mas reciente del punto', () => {
    const eventos: AppEvent[] = [
      venta({ id: 'a', ts: '2026-07-30T09:00:00' }),
      venta({ id: 'b', ts: '2026-07-30T10:00:00' }),
    ];
    const nueva = anularUltimaVenta(eventos, 'Plazuela', HOY, 'Fran', 'dev1', '2026-07-30T11:00:00');
    expect(nueva).toMatchObject({ type: 'void', refId: 'b' });
    expect(totalDelDia([...eventos, nueva as VoidEvent], HOY, 'Plazuela', 'calle')).toBe(1);
  });

  it('anula la venta entera: -1 sobre un +3 se lleva las tres piezas', () => {
    const eventos: AppEvent[] = [venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 3 })];
    const nueva = anularUltimaVenta(eventos, 'Plazuela', HOY, 'Fran', 'dev1', '2026-07-30T11:00:00');
    expect(nueva).toMatchObject({ type: 'void', refId: 'a' });
    expect(totalDelDia([...eventos, nueva as VoidEvent], HOY, 'Plazuela', 'calle')).toBe(0);
  });

  it('vacia el punto venta por venta y despues devuelve null', () => {
    let eventos: AppEvent[] = [
      venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 2 }),
      venta({ id: 'b', ts: '2026-07-30T10:00:00', qty: 1 }),
    ];
    for (const restante of [2, 0]) {
      const nueva = anularUltimaVenta(eventos, 'Plazuela', HOY, 'Fran', 'dev1', '2026-07-30T11:00:00');
      expect(nueva).not.toBeNull();
      eventos = [...eventos, nueva as VoidEvent];
      expect(totalDelDia(eventos, HOY, 'Plazuela', 'calle')).toBe(restante);
    }
    expect(anularUltimaVenta(eventos, 'Plazuela', HOY, 'Fran', 'dev1', '2026-07-30T11:00:00')).toBeNull();
  });

  it('nunca borra ni edita: el historico solo crece', () => {
    const eventos: AppEvent[] = [venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 3 })];
    const nueva = anularUltimaVenta(eventos, 'Plazuela', HOY, 'Fran', 'dev1', '2026-07-30T11:00:00');
    const historico = [...eventos, nueva as VoidEvent];
    expect(historico).toHaveLength(2);
    expect(historico[0]).toEqual(eventos[0]);
    expect(ventasDeFecha(historico, HOY)).toHaveLength(1);
  });

  it('ignora otros puntos, otras fechas, mayoreo y lo ya anulado', () => {
    const base: AppEvent[] = [
      venta({ id: 'otroPunto', ts: '2026-07-30T09:00:00', point: 'Parque Sinaloa' }),
      venta({ id: 'ayer', ts: '2026-07-29T09:00:00' }),
      venta({ id: 'mayoreo', ts: '2026-07-30T09:00:00', channel: 'mayoreo', qty: 20 }),
      venta({ id: 'anulada', ts: '2026-07-30T09:00:00' }),
      anulacion('v1', 'anulada'),
    ];
    expect(
      anularUltimaVenta(base, 'Plazuela', HOY, 'Fran', 'dev1', '2026-07-30T11:00:00')
    ).toBeNull();
    expect(ultimaVentaActiva(base, 'Plazuela', HOY, 'Fran')).toBeNull();
  });

  /**
   * El descuadre que trae centralizar el registro en un solo telefono: los dos venden en el
   * mismo punto, asi que sin filtrar por vendedor el -1 de uno se lleva la pieza del otro.
   * No lo avisa nadie — el total del dia y el dinero salen identicos — solo cambia a quien
   * se le acredito.
   */
  it('anula la del vendedor activo, no la del otro que vende en el mismo punto', () => {
    const eventos: AppEvent[] = [
      venta({ id: 'fran1', ts: '2026-07-30T09:00:00' }),
      venta({ id: 'primo1', ts: '2026-07-30T09:01:00', vendor: 'Primo' }),
    ];
    const nueva = anularUltimaVenta(eventos, 'Plazuela', HOY, 'Fran', 'dev1', '2026-07-30T09:02:00');
    expect(nueva).toMatchObject({ refId: 'fran1' });

    const despues = [...eventos, nueva as VoidEvent];
    expect(hieleraDe(despues, 'Fran', HOY).vendido).toBe(0);
    expect(hieleraDe(despues, 'Primo', HOY).vendido).toBe(1);
  });

  it('sin ventas propias no anula la del otro: devuelve null y el boton queda apagado', () => {
    const eventos: AppEvent[] = [venta({ id: 'primo1', ts: '2026-07-30T09:00:00', vendor: 'Primo' })];
    expect(ultimaVentaActiva(eventos, 'Plazuela', HOY, 'Fran')).toBeNull();
    expect(
      anularUltimaVenta(eventos, 'Plazuela', HOY, 'Fran', 'dev1', '2026-07-30T11:00:00')
    ).toBeNull();
    expect(ultimaVentaActiva(eventos, 'Plazuela', HOY, 'Primo')?.id).toBe('primo1');
  });

  it('ultimaVentaActiva apunta a la misma venta que anularia el boton', () => {
    const eventos: AppEvent[] = [
      venta({ id: 'a', ts: '2026-07-30T09:00:00' }),
      venta({ id: 'b', ts: '2026-07-30T10:00:00' }),
    ];
    const nueva = anularUltimaVenta(eventos, 'Plazuela', HOY, 'Fran', 'dev1', '2026-07-30T11:00:00');
    expect(ultimaVentaActiva(eventos, 'Plazuela', HOY, 'Fran')?.id).toBe(nueva?.refId);
  });

  it('la pieza anulada regresa a la hielera', () => {
    const eventos: AppEvent[] = [
      carga({ id: 'c1', ts: '2026-07-30T07:00:00', qty: 18 }),
      venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 3 }),
    ];
    expect(enHielera(eventos, 'Fran', HOY)).toBe(15);
    const nueva = anularUltimaVenta(eventos, 'Plazuela', HOY, 'Fran', 'dev1', '2026-07-30T11:00:00');
    expect(enHielera([...eventos, nueva as VoidEvent], 'Fran', HOY)).toBe(18);
  });
});

describe('planRespaldo', () => {
  const previos: AppEvent[] = [
    venta({ id: 'a', ts: '2026-07-28T09:00:00', qty: 2 }),
    venta({ id: 'b', ts: '2026-07-29T10:00:00', qty: 3, channel: 'mayoreo', vendor: 'Primo' }),
    anulacion('v1', 'a'),
  ];
  const crudo = JSON.stringify(previos);

  it('respalda el crudo byte a byte, sin parsear ni normalizar', () => {
    const copia = planRespaldo(crudo, null);
    expect(copia).toBe(crudo);
    expect(copia).toStrictEqual(crudo);
  });

  it('el respaldo conserva los eventos previos identicos al original', () => {
    const copia = planRespaldo(crudo, null) as string;
    expect(JSON.parse(copia)).toEqual(previos);
    expect(JSON.parse(copia).map(validarEvento)).toEqual(previos);
  });

  it('conserva campos que esta version ya no escribe: el respaldo no filtra nada', () => {
    const viejo = '[{"id":"a","type":"sale","ts":"2026-07-28T09:00:00","point":"Plazuela","channel":"calle","vendor":"Fran","qty":1,"device":"d1","campoViejo":7}]';
    expect(planRespaldo(viejo, null)).toBe(viejo);
  });

  it('no pisa un respaldo que ya existe: el primero es el que vale', () => {
    expect(planRespaldo(crudo, '[]')).toBeNull();
    expect(planRespaldo(crudo, 'lo que sea')).toBeNull();
  });

  it('no respalda cuando no hay nada guardado', () => {
    expect(planRespaldo(null, null)).toBeNull();
    expect(planRespaldo('', null)).toBeNull();
  });

  it('es idempotente: correr la migracion dos veces no cambia el respaldo', () => {
    const primera = planRespaldo(crudo, null) as string;
    expect(planRespaldo(crudo, primera)).toBeNull();
  });

  it('el respaldo se puede reimportar sin duplicar ni perder eventos', () => {
    const copia = planRespaldo(crudo, null) as string;
    const r = mezclar([], JSON.parse(copia) as unknown[]);
    expect(r.eventos).toEqual(previos);
    expect(r.invalidos).toBe(0);
  });
});

describe('mezclar', () => {
  const entrantes: AppEvent[] = [
    venta({ id: 'a', ts: '2026-07-30T09:00:00' }),
    venta({ id: 'b', ts: '2026-07-30T09:30:00', qty: 2 }),
    anulacion('v1', 'a'),
  ];

  it('agrega los eventos nuevos preservando los actuales', () => {
    const r = mezclar([venta({ id: 'z', ts: '2026-07-29T09:00:00' })], entrantes);
    expect(r.nuevos).toBe(3);
    expect(r.repetidos).toBe(0);
    expect(r.eventos.map((e) => e.id)).toEqual(['z', 'a', 'b', 'v1']);
  });

  it('es idempotente: importar el mismo archivo dos veces deja el mismo estado', () => {
    const primera = mezclar([], entrantes);
    const segunda = mezclar(primera.eventos, entrantes);
    expect(segunda.nuevos).toBe(0);
    expect(segunda.repetidos).toBe(3);
    expect(segunda.eventos).toEqual(primera.eventos);
  });

  it('deduplica ids repetidos dentro del mismo archivo', () => {
    const r = mezclar([], [entrantes[0], entrantes[0]]);
    expect(r.nuevos).toBe(1);
    expect(r.repetidos).toBe(1);
  });

  it('descarta los malformados sin tirar el resto', () => {
    const r = mezclar([], [entrantes[0], { type: 'sale' }, null, 'texto', { ...entrantes[1], qty: 0 }]);
    expect(r.nuevos).toBe(1);
    expect(r.invalidos).toBe(4);
    expect(r.eventos).toHaveLength(1);
  });

  it('normaliza: no deja pasar campos extra al almacenamiento', () => {
    const r = mezclar([], [{ ...venta({ id: 'a', ts: '2026-07-30T09:00:00' }), malicioso: '<script>' }]);
    expect(r.eventos[0]).toEqual(venta({ id: 'a', ts: '2026-07-30T09:00:00' }));
  });
});

describe('validarEvento', () => {
  const base = venta({ id: 'a', ts: '2026-07-30T09:00:00' });

  it('acepta una venta bien formada y conserva retro', () => {
    expect(validarEvento({ ...base, retro: true })).toEqual({ ...base, retro: true });
  });

  it.each([
    ['sin id', { ...base, id: '' }],
    ['id no string', { ...base, id: 7 }],
    ['ts impastable', { ...base, ts: 'ayer por la tarde' }],
    ['type desconocido', { ...base, type: 'refund' }],
    ['channel fuera del enum', { ...base, channel: 'online' }],
    ['vendor fuera del enum', { ...base, vendor: 'Otro' }],
    ['qty cero', { ...base, qty: 0 }],
    ['qty fraccionaria', { ...base, qty: 1.5 }],
    ['qty texto', { ...base, qty: '3' }],
    ['qty infinita', { ...base, qty: Number.POSITIVE_INFINITY }],
    ['point vacio', { ...base, point: '' }],
    ['point larguisimo', { ...base, point: 'x'.repeat(101) }],
    ['device ausente', { ...base, device: undefined }],
    ['void sin refId', { id: 'v', type: 'void', ts: base.ts, device: 'dev1' }],
    ['arreglo', [base]],
    ['nulo', null],
  ])('rechaza %s', (_caso, valor) => {
    expect(validarEvento(valor)).toBeNull();
  });

  it('ignora un retro con valor raro en vez de aceptarlo', () => {
    expect(validarEvento({ ...base, retro: 'si' })).toEqual(base);
  });

  it('acepta una carga bien formada y le quita los campos de venta', () => {
    const c = carga({ id: 'c1', ts: '2026-07-30T07:00:00' });
    expect(validarEvento({ ...c, point: 'Plazuela', channel: 'calle' })).toEqual(c);
  });

  it.each([
    ['carga sin vendor', { id: 'c', type: 'load', ts: '2026-07-30T07:00:00', qty: 10, device: 'd' }],
    ['carga con vendor invalido', { ...carga({ id: 'c', ts: '2026-07-30T07:00:00' }), vendor: 'Otro' }],
    ['carga qty cero', { ...carga({ id: 'c', ts: '2026-07-30T07:00:00' }), qty: 0 }],
    ['carga qty fraccionaria', { ...carga({ id: 'c', ts: '2026-07-30T07:00:00' }), qty: 2.5 }],
  ])('rechaza %s', (_caso, valor) => {
    expect(validarEvento(valor)).toBeNull();
  });
});

describe('eventosDeArchivo', () => {
  it('extrae events de un sobre version 1', () => {
    expect(eventosDeArchivo({ app: 'x', version: 1, events: [] })).toEqual([]);
  });

  it.each([
    ['version distinta', { version: 2, events: [] }],
    ['sin events', { version: 1 }],
    ['events no arreglo', { version: 1, events: {} }],
    ['no objeto', 'hola'],
  ])('rechaza %s', (_caso, valor) => {
    expect(eventosDeArchivo(valor)).toBeNull();
  });
});

describe('agregaciones', () => {
  const eventos: AppEvent[] = [
    venta({ id: 'a', ts: '2026-07-30T09:10:00', qty: 3 }),
    venta({ id: 'b', ts: '2026-07-30T09:50:00', qty: 2 }),
    venta({ id: 'c', ts: '2026-07-30T11:00:00', qty: 4, point: 'Parque Sinaloa', vendor: 'Primo' }),
    venta({ id: 'd', ts: '2026-07-30T12:00:00', qty: 9, channel: 'mayoreo', vendor: 'Primo' }),
    venta({ id: 'e', ts: '2026-07-30T09:20:00', qty: 5 }),
    anulacion('v1', 'e'),
  ];
  const activas = ventasActivas(eventos);

  it('suma qty por hora y rellena las horas intermedias vacias', () => {
    expect(porHora(activas)).toEqual([
      { etiqueta: '09:00', valor: 5 },
      { etiqueta: '10:00', valor: 0 },
      { etiqueta: '11:00', valor: 4 },
      { etiqueta: '12:00', valor: 9 },
    ]);
  });

  it('suma por punto e incluye los puntos configurados sin ventas', () => {
    expect(porPunto(activas, ['Plazuela', 'Parque Sinaloa', 'Malecon'])).toEqual([
      { etiqueta: 'Plazuela', valor: 14 },
      { etiqueta: 'Parque Sinaloa', valor: 4 },
      { etiqueta: 'Malecon', valor: 0 },
    ]);
  });

  it('suma por vendedor siempre con los dos', () => {
    expect(porVendedor(activas)).toEqual([
      { etiqueta: 'Primo', valor: 13 },
      { etiqueta: 'Fran', valor: 5 },
    ]);
  });

  it('por dia devuelve la ventana pedida terminando hoy', () => {
    const barras = porDia(activas, new Date(2026, 6, 30), 3);
    expect(barras.map((b) => b.etiqueta)).toEqual(['28/07', '29/07', '30/07']);
    expect(barras.map((b) => b.valor)).toEqual([0, 0, 18]);
  });

  it('totalDelDia separa canal y punto', () => {
    expect(totalDelDia(eventos, '2026-07-30', 'Plazuela', 'calle')).toBe(5);
    expect(totalDelDia(eventos, '2026-07-30', 'Plazuela', 'mayoreo')).toBe(9);
  });
});

describe('hieleraDe', () => {
  const HOY = '2026-07-30';

  it('descuenta lo vendido de lo cargado ese dia, por vendedor', () => {
    const eventos: AppEvent[] = [
      carga({ id: 'c1', ts: '2026-07-30T07:00:00', qty: 60 }),
      carga({ id: 'c2', ts: '2026-07-30T07:05:00', qty: 40, vendor: 'Primo' }),
      venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 3 }),
      venta({ id: 'b', ts: '2026-07-30T10:00:00', qty: 2, vendor: 'Primo' }),
    ];
    expect(hieleraDe(eventos, 'Fran', HOY)).toEqual({
      vendedor: 'Fran',
      cargado: 60,
      recibido: 0,
      entregado: 0,
      vendido: 3,
      restante: 57,
      sinCarga: false,
      cuadra: true,
    });
    expect(hieleraDe(eventos, 'Primo', HOY).restante).toBe(38);
  });

  it('suma las recargas del dia', () => {
    const eventos: AppEvent[] = [
      carga({ id: 'c1', ts: '2026-07-30T07:00:00', qty: 60 }),
      carga({ id: 'c2', ts: '2026-07-30T13:00:00', qty: 24 }),
      venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 10 }),
    ];
    expect(hieleraDe(eventos, 'Fran', HOY)).toMatchObject({ cargado: 84, restante: 74 });
  });

  it('el mayoreo tambien sale de la hielera', () => {
    const eventos: AppEvent[] = [
      carga({ id: 'c1', ts: '2026-07-30T07:00:00', qty: 60 }),
      venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 20, channel: 'mayoreo' }),
    ];
    expect(hieleraDe(eventos, 'Fran', HOY).restante).toBe(40);
  });

  it('no arrastra saldo de otros dias: cada dia se carga de nuevo', () => {
    const eventos: AppEvent[] = [
      carga({ id: 'ayer', ts: '2026-07-29T07:00:00', qty: 99 }),
      venta({ id: 'a', ts: '2026-07-29T09:00:00', qty: 1 }),
      carga({ id: 'hoy', ts: '2026-07-30T07:00:00', qty: 10 }),
    ];
    expect(hieleraDe(eventos, 'Fran', HOY)).toMatchObject({ cargado: 10, vendido: 0, restante: 10 });
  });

  it('marca sinCarga cuando no hubo carga registrada', () => {
    const eventos: AppEvent[] = [venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 4 })];
    expect(hieleraDe(eventos, 'Fran', HOY)).toMatchObject({ sinCarga: true, restante: -4 });
  });

  it('una carga anulada deja de contar', () => {
    const eventos: AppEvent[] = [
      carga({ id: 'c1', ts: '2026-07-30T07:00:00', qty: 60 }),
      carga({ id: 'c2', ts: '2026-07-30T07:10:00', qty: 500 }),
      anulacion('v1', 'c2'),
    ];
    expect(hieleraDe(eventos, 'Fran', HOY)).toMatchObject({ cargado: 60, sinCarga: false });
  });

  it('una venta anulada regresa la pieza a la hielera', () => {
    const base: AppEvent[] = [
      carga({ id: 'c1', ts: '2026-07-30T07:00:00', qty: 60 }),
      venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 5 }),
    ];
    expect(hieleraDe(base, 'Fran', HOY).restante).toBe(55);
    expect(hieleraDe([...base, anulacion('v1', 'a')], 'Fran', HOY).restante).toBe(60);
  });
});

describe('enHielera', () => {
  const HOY = '2026-07-30';

  it('mezcla cargas y ventas del dia: cargas menos vendidas activas de ese vendedor', () => {
    const eventos: AppEvent[] = [
      carga({ id: 'c1', ts: '2026-07-30T07:00:00', qty: 18 }),
      venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 2 }),
      carga({ id: 'c2', ts: '2026-07-30T12:00:00', qty: 19 }),
      venta({ id: 'b', ts: '2026-07-30T13:00:00', qty: 5 }),
      venta({ id: 'c', ts: '2026-07-30T14:00:00', qty: 4 }),
      anulacion('v1', 'c'),
      // Ruido: otro vendedor y otro dia no deben tocar el numero de Fran hoy.
      carga({ id: 'c3', ts: '2026-07-30T07:00:00', qty: 99, vendor: 'Primo' }),
      venta({ id: 'd', ts: '2026-07-30T10:00:00', qty: 7, vendor: 'Primo' }),
      carga({ id: 'c4', ts: '2026-07-29T07:00:00', qty: 50 }),
    ];
    expect(enHielera(eventos, 'Fran', HOY)).toBe(30);
    expect(enHielera(eventos, 'Primo', HOY)).toBe(92);
  });

  it('permite negativo cuando vendio sin registrar carga: nunca se bloquea la venta', () => {
    const eventos: AppEvent[] = [
      venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 6 }),
      venta({ id: 'b', ts: '2026-07-30T10:00:00', qty: 3 }),
    ];
    expect(enHielera(eventos, 'Fran', HOY)).toBe(-9);
    expect(hieleraDe(eventos, 'Fran', HOY).sinCarga).toBe(true);
  });

  it('una carga retroactiva corrige el negativo sin tocar las ventas', () => {
    const ventas: AppEvent[] = [venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 9 })];
    expect(enHielera(ventas, 'Fran', HOY)).toBe(-9);
    const conCarga = [...ventas, carga({ id: 'c1', ts: '2026-07-30T07:00:00', qty: 18 })];
    expect(enHielera(conCarga, 'Fran', HOY)).toBe(9);
    expect(ventasActivas(conCarga)).toEqual(ventasActivas(ventas));
  });

  it('es el mismo numero que el restante de hieleraDe', () => {
    const eventos: AppEvent[] = [
      carga({ id: 'c1', ts: '2026-07-30T07:00:00', qty: 18 }),
      venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 4 }),
    ];
    expect(enHielera(eventos, 'Fran', HOY)).toBe(hieleraDe(eventos, 'Fran', HOY).restante);
  });
});

describe('cuadre del dia', () => {
  const HOY = '2026-07-30';
  const eventos: AppEvent[] = [
    carga({ id: 'c1', ts: '2026-07-30T07:00:00', qty: 18 }),
    carga({ id: 'c2', ts: '2026-07-30T12:00:00', qty: 19 }),
    venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 5 }),
    venta({ id: 'b', ts: '2026-07-30T13:00:00', qty: 6, channel: 'mayoreo' }),
    carga({ id: 'c3', ts: '2026-07-30T07:30:00', qty: 18, vendor: 'Primo' }),
    venta({ id: 'd', ts: '2026-07-30T11:00:00', qty: 20, vendor: 'Primo' }),
  ];

  it('cargadas + recibidas = vendidas + pasadas + restantes para cada vendedor', () => {
    for (const h of hieleras(eventos, HOY)) {
      expect(h.cargado + h.recibido).toBe(h.vendido + h.entregado + h.restante);
    }
  });

  /**
   * `cuadra` tiene que comprobar algo que pueda salir falso. Comparar `restante` contra los
   * campos de los que se deriva daria cierto siempre y no verificaria nada: la senal real es
   * que nadie haya vendido mas piezas de las que tuvo en las manos.
   */
  it('NO cuadra cuando el restante es negativo', () => {
    const primo = hieleraDe(eventos, 'Primo', HOY);
    expect(primo).toMatchObject({ cargado: 18, vendido: 20, restante: -2, cuadra: false });
  });

  it('cuadra sin ningun movimiento', () => {
    expect(hieleraDe([], 'Fran', HOY)).toMatchObject({
      cargado: 0,
      vendido: 0,
      restante: 0,
      cuadra: true,
      sinCarga: true,
    });
  });

  it('sigue cuadrando despues de anular una carga y una venta', () => {
    const conAnulaciones: AppEvent[] = [...eventos, anulacion('v1', 'c2'), anulacion('v2', 'a')];
    const fran = hieleraDe(conAnulaciones, 'Fran', HOY);
    expect(fran).toMatchObject({ cargado: 18, vendido: 6, restante: 12, cuadra: true });
  });

  it('hieleras devuelve siempre a los dos vendedores', () => {
    expect(hieleras([], HOY).map((h) => h.vendedor)).toEqual(['Fran', 'Primo']);
  });
});

describe('traspasos entre hieleras', () => {
  const HOY = '2026-07-30';

  /**
   * El escenario real: Fran se acaba su carga, Primo le pasa de las suyas para acabar juntos,
   * y Fran las vende como suyas. Antes del traspaso esto dejaba a Fran en -5 con el aviso
   * "falta registrar una carga" (que era mentira) y a Primo con 5 piezas fantasma que ya no
   * traia. Ahora los dos cuadran y el dia sigue habiendo cargado 36, no 41.
   */
  it('cuadra a los dos cuando uno vende de las botellas del otro', () => {
    const eventos: AppEvent[] = [
      carga({ id: 'c1', ts: '2026-07-30T07:00:00', qty: 18 }),
      carga({ id: 'c2', ts: '2026-07-30T07:00:00', qty: 18, vendor: 'Primo' }),
      venta({ id: 'f1', ts: '2026-07-30T10:00:00', qty: 18 }),
      traspaso({ id: 't1', ts: '2026-07-30T11:00:00', from: 'Primo', to: 'Fran', qty: 5 }),
      venta({ id: 'f2', ts: '2026-07-30T11:30:00', qty: 5 }),
      venta({ id: 'p1', ts: '2026-07-30T12:00:00', qty: 13, vendor: 'Primo' }),
    ];

    expect(hieleraDe(eventos, 'Fran', HOY)).toMatchObject({
      cargado: 18,
      recibido: 5,
      entregado: 0,
      vendido: 23,
      restante: 0,
      cuadra: true,
    });
    expect(hieleraDe(eventos, 'Primo', HOY)).toMatchObject({
      cargado: 18,
      recibido: 0,
      entregado: 5,
      vendido: 13,
      restante: 0,
      cuadra: true,
    });

    // Lo que se puede contar contra el almacen: el traspaso no infla lo que salio de casa.
    const salieron = hieleras(eventos, HOY).reduce((s, h) => s + h.cargado, 0);
    expect(salieron).toBe(36);
  });

  it('el traspaso no es una venta: el dinero del dia no se mueve', () => {
    const base: AppEvent[] = [
      carga({ id: 'c1', ts: '2026-07-30T07:00:00', qty: 18, vendor: 'Primo' }),
      venta({ id: 'f1', ts: '2026-07-30T10:00:00', qty: 4 }),
    ];
    const conTraspaso: AppEvent[] = [
      ...base,
      traspaso({ id: 't1', ts: '2026-07-30T11:00:00', from: 'Primo', to: 'Fran', qty: 9 }),
    ];
    expect(ventasActivas(conTraspaso)).toEqual(ventasActivas(base));
    expect(totalPiezas(ventasActivas(conTraspaso))).toBe(4);
  });

  it('va en los dos sentidos y varios el mismo dia', () => {
    const eventos: AppEvent[] = [
      carga({ id: 'c1', ts: '2026-07-30T07:00:00', qty: 20 }),
      carga({ id: 'c2', ts: '2026-07-30T07:00:00', qty: 20, vendor: 'Primo' }),
      traspaso({ id: 't1', ts: '2026-07-30T10:00:00', from: 'Primo', to: 'Fran', qty: 6 }),
      traspaso({ id: 't2', ts: '2026-07-30T15:00:00', from: 'Fran', to: 'Primo', qty: 2 }),
    ];
    expect(hieleraDe(eventos, 'Fran', HOY)).toMatchObject({
      recibido: 6,
      entregado: 2,
      restante: 24,
    });
    expect(hieleraDe(eventos, 'Primo', HOY)).toMatchObject({
      recibido: 2,
      entregado: 6,
      restante: 16,
    });
  });

  it('un traspaso anulado devuelve las piezas a su hielera', () => {
    const base: AppEvent[] = [
      carga({ id: 'c1', ts: '2026-07-30T07:00:00', qty: 18, vendor: 'Primo' }),
      traspaso({ id: 't1', ts: '2026-07-30T11:00:00', from: 'Primo', to: 'Fran', qty: 5 }),
    ];
    expect(hieleraDe(base, 'Primo', HOY).restante).toBe(13);
    const anulado = [...base, anulacion('v1', 't1')];
    expect(hieleraDe(anulado, 'Primo', HOY).restante).toBe(18);
    expect(hieleraDe(anulado, 'Fran', HOY).recibido).toBe(0);
  });

  it('no arrastra traspasos de otros dias', () => {
    const eventos: AppEvent[] = [
      traspaso({ id: 'ayer', ts: '2026-07-29T11:00:00', from: 'Primo', to: 'Fran', qty: 9 }),
      carga({ id: 'c1', ts: '2026-07-30T07:00:00', qty: 18 }),
    ];
    expect(hieleraDe(eventos, 'Fran', HOY)).toMatchObject({ recibido: 0, restante: 18 });
  });

  /** Recibir botellas es tener botellas: el restante ya significa algo aunque no haya cargado. */
  it('recibir quita el sinCarga aunque nunca haya cargado', () => {
    const eventos: AppEvent[] = [
      traspaso({ id: 't1', ts: '2026-07-30T11:00:00', from: 'Primo', to: 'Fran', qty: 5 }),
    ];
    expect(hieleraDe(eventos, 'Fran', HOY)).toMatchObject({ sinCarga: false, restante: 5 });
    expect(hieleraDe(eventos, 'Primo', HOY)).toMatchObject({ sinCarga: true, restante: -5 });
  });

  it('crearTraspaso rechaza a uno mismo y las cantidades que no son piezas', () => {
    const base = { ts: '2026-07-30T11:00:00', device: 'dev1' };
    expect(crearTraspaso({ ...base, from: 'Fran', to: 'Fran', qty: 5 })).toBeNull();
    expect(crearTraspaso({ ...base, from: 'Fran', to: 'Primo', qty: 0 })).toBeNull();
    expect(crearTraspaso({ ...base, from: 'Fran', to: 'Primo', qty: -3 })).toBeNull();
    expect(crearTraspaso({ ...base, from: 'Fran', to: 'Primo', qty: 2.5 })).toBeNull();
    expect(crearTraspaso({ ...base, from: 'Primo', to: 'Fran', qty: 5 })).toMatchObject({
      type: 'transfer',
      from: 'Primo',
      to: 'Fran',
      qty: 5,
    });
  });

  it('validarEvento acepta un traspaso bueno y tira los imposibles', () => {
    const bueno = traspaso({ id: 't1', ts: '2026-07-30T11:00:00', from: 'Primo', to: 'Fran', qty: 5 });
    expect(validarEvento(bueno)).toEqual(bueno);
    expect(validarEvento({ ...bueno, to: 'Primo' })).toBeNull();
    expect(validarEvento({ ...bueno, from: 'Alguien' })).toBeNull();
    expect(validarEvento({ ...bueno, qty: 0 })).toBeNull();
    expect(validarEvento({ ...bueno, qty: 1.5 })).toBeNull();
  });

  it('el merge no duplica un traspaso ya importado', () => {
    const t = traspaso({ id: 't1', ts: '2026-07-30T11:00:00', from: 'Primo', to: 'Fran', qty: 5 });
    const resultado = mezclar([t], [t]);
    expect(resultado).toMatchObject({ nuevos: 0, repetidos: 1 });
    expect(hieleraDe(resultado.eventos, 'Fran', HOY).recibido).toBe(5);
  });
});

describe('sugerenciaEquilibrio', () => {
  const HOY = '2026-07-30';
  const traen = (fran: number, primo: number): AppEvent[] => [
    carga({ id: 'c1', ts: '2026-07-30T07:00:00', qty: fran }),
    carga({ id: 'c2', ts: '2026-07-30T07:00:00', qty: primo, vendor: 'Primo' }),
  ];
  const entre = (donante: number, receptor: number): number =>
    sugerenciaEquilibrio(
      hieleraDe(traen(donante, receptor), 'Fran', HOY),
      hieleraDe(traen(donante, receptor), 'Primo', HOY)
    );

  it('parte la diferencia para que los dos queden parejos', () => {
    expect(entre(10, 0)).toBe(5);
    expect(entre(12, 4)).toBe(4);
  });

  it('el impar se queda con quien las trae', () => {
    expect(entre(11, 0)).toBe(5);
  });

  it('no sugiere nada si el donante no va arriba', () => {
    expect(entre(5, 5)).toBe(0);
    expect(entre(3, 9)).toBe(0);
  });

  it('nunca sugiere mas piezas de las que el donante trae', () => {
    const eventos: AppEvent[] = [
      carga({ id: 'c1', ts: '2026-07-30T07:00:00', qty: 2 }),
      venta({ id: 'p1', ts: '2026-07-30T09:00:00', qty: 10, vendor: 'Primo' }),
    ];
    const fran = hieleraDe(eventos, 'Fran', HOY);
    const primo = hieleraDe(eventos, 'Primo', HOY);
    expect(primo.restante).toBe(-10);
    expect(sugerenciaEquilibrio(fran, primo)).toBe(2);
  });
});

describe('las cargas no son ventas', () => {
  const eventos: AppEvent[] = [
    carga({ id: 'c1', ts: '2026-07-30T07:00:00', qty: 18 }),
    carga({ id: 'c2', ts: '2026-07-30T07:05:00', qty: 19, vendor: 'Primo' }),
    venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 3 }),
    venta({ id: 'b', ts: '2026-07-30T11:00:00', qty: 4, vendor: 'Primo' }),
  ];
  const activas = ventasActivas(eventos);

  it('ventasActivas deja fuera las cargas', () => {
    expect(activas.map((v) => v.id)).toEqual(['a', 'b']);
  });

  it('las agregaciones de stats ignoran las cargas', () => {
    const soloVentas: AppEvent[] = [
      venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 3 }),
      venta({ id: 'b', ts: '2026-07-30T11:00:00', qty: 4, vendor: 'Primo' }),
    ];
    const esperadas = ventasActivas(soloVentas);
    expect(porHora(activas)).toEqual(porHora(esperadas));
    expect(porPunto(activas, ['Plazuela'])).toEqual(porPunto(esperadas, ['Plazuela']));
    expect(porVendedor(activas)).toEqual(porVendedor(esperadas));
    expect(porDia(activas, new Date(2026, 6, 30), 2)).toEqual(
      porDia(esperadas, new Date(2026, 6, 30), 2)
    );
    expect(totalPiezas(activas)).toBe(7);
  });

  it('las 18 piezas cargadas no aparecen en el total del dia ni por punto', () => {
    expect(totalDelDia(eventos, '2026-07-30', 'Plazuela', 'calle')).toBe(7);
    expect(porPunto(activas, ['Plazuela'])).toEqual([{ etiqueta: 'Plazuela', valor: 7 }]);
  });

  it('el ritmo no cuenta la hora de la carga como hora de venta', () => {
    expect(ritmo(activas)).toMatchObject({ piezas: 7, minutos: 120 });
  });

  it('el resumen compartible no suma las cargas a las ventas', () => {
    const texto = resumenTexto(eventos, '2026-07-30', ['Plazuela']);
    expect(texto).toContain('Total: 7');
    expect(texto).toContain('Calle: 7');
  });
});

describe('crearAnulacion sobre cargas', () => {
  it('anula una carga y no la deja anular dos veces', () => {
    const eventos: AppEvent[] = [carga({ id: 'c1', ts: '2026-07-30T07:00:00' })];
    const primera = crearAnulacion(eventos, 'c1', 'dev1', '2026-07-30T08:00:00');
    expect(primera).toMatchObject({ type: 'void', refId: 'c1' });
    expect(crearAnulacion([...eventos, primera as VoidEvent], 'c1', 'dev1', '2026-07-30T09:00:00'))
      .toBeNull();
  });

  it('no anula un evento inexistente ni una anulacion', () => {
    const eventos: AppEvent[] = [carga({ id: 'c1', ts: '2026-07-30T07:00:00' }), anulacion('v1', 'c1')];
    expect(crearAnulacion(eventos, 'zzz', 'dev1', '2026-07-30T09:00:00')).toBeNull();
    expect(crearAnulacion(eventos, 'v1', 'dev1', '2026-07-30T09:00:00')).toBeNull();
  });
});

describe('ritmo', () => {
  it('divide las piezas entre el tramo real de venta', () => {
    const ventas = [
      venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 10 }),
      venta({ id: 'b', ts: '2026-07-30T13:00:00', qty: 10 }),
    ];
    expect(ritmo(ventas)).toEqual({ piezas: 20, minutos: 240, porHora: 5 });
  });

  it('no infla el ritmo con rafagas cortas: el tramo tiene piso de una hora', () => {
    const ventas = [
      venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 3 }),
      venta({ id: 'b', ts: '2026-07-30T09:10:00', qty: 3 }),
    ];
    expect(ritmo(ventas)).toEqual({ piezas: 6, minutos: 10, porHora: 6 });
  });

  it('una sola venta no divide entre cero', () => {
    expect(ritmo([venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 4 })])).toEqual({
      piezas: 4,
      minutos: 0,
      porHora: 4,
    });
  });

  it('sin ventas es cero, no NaN', () => {
    expect(ritmo([])).toEqual({ piezas: 0, minutos: 0, porHora: 0 });
  });

  it('duracionLegible arma horas y minutos', () => {
    expect(duracionLegible(190)).toBe('3h 10m');
    expect(duracionLegible(45)).toBe('45m');
    expect(duracionLegible(120)).toBe('2h');
    expect(duracionLegible(0)).toBe('—');
  });
});

describe('panelVendedor', () => {
  const HOY = '2026-07-30';
  const eventos: AppEvent[] = [
    carga({ id: 'c1', ts: '2026-07-30T07:00:00', qty: 60 }),
    venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 4 }),
    venta({ id: 'b', ts: '2026-07-30T13:00:00', qty: 8, point: 'Parque Sinaloa' }),
    venta({ id: 'c', ts: '2026-07-30T13:30:00', qty: 3, point: 'Parque Sinaloa' }),
    venta({ id: 'd', ts: '2026-07-30T14:00:00', qty: 5, channel: 'mayoreo' }),
    venta({ id: 'otro', ts: '2026-07-30T10:00:00', qty: 99, vendor: 'Primo' }),
  ];

  it('cruza hielera, ritmo y lugar de un solo vendedor', () => {
    const panel = panelVendedor(eventos, 'Fran', HOY, ['Plazuela', 'Parque Sinaloa']);
    expect(panel.hielera).toMatchObject({ cargado: 60, vendido: 20, restante: 40 });
    expect(panel.calle).toBe(15);
    expect(panel.mayoreo).toBe(5);
    expect(panel.ritmo).toMatchObject({ piezas: 20, minutos: 300, porHora: 4 });
    expect(panel.mejorPunto).toEqual({ etiqueta: 'Parque Sinaloa', valor: 11 });
    expect(panel.mejorHora).toEqual({ etiqueta: '13:00', valor: 11 });
  });

  it('no mezcla los datos del otro vendedor', () => {
    const panel = panelVendedor(eventos, 'Primo', HOY, ['Plazuela']);
    expect(panel.hielera).toMatchObject({ cargado: 0, vendido: 99, sinCarga: true });
    expect(panel.mejorPunto).toEqual({ etiqueta: 'Plazuela', valor: 99 });
  });

  it('sin ventas no inventa mejor lugar ni mejor hora', () => {
    const panel = panelVendedor([], 'Fran', HOY, ['Plazuela']);
    expect(panel.mejorPunto).toBeNull();
    expect(panel.mejorHora).toBeNull();
    expect(panel.ritmo.porHora).toBe(0);
  });
});

describe('filtrarRango', () => {
  const ahora = new Date(2026, 6, 30, 15, 0, 0);
  const ventas = [
    venta({ id: 'hoy', ts: '2026-07-30T08:00:00' }),
    venta({ id: 'hace3', ts: '2026-07-27T08:00:00' }),
    venta({ id: 'hace20', ts: '2026-07-10T08:00:00' }),
  ];

  it('hoy deja solo la fecha local actual', () => {
    expect(filtrarRango(ventas, 'hoy', ahora).map((v) => v.id)).toEqual(['hoy']);
  });

  it('7d incluye los ultimos siete dias calendario', () => {
    expect(filtrarRango(ventas, '7d', ahora).map((v) => v.id)).toEqual(['hoy', 'hace3']);
  });

  it('todo no filtra nada', () => {
    expect(filtrarRango(ventas, 'todo', ahora)).toHaveLength(3);
  });
});

describe('puntos', () => {
  it('rechaza duplicados sin importar mayusculas ni espacios', () => {
    expect(puedeAgregarPunto(['Plazuela'], ' plazuela ')).toBe(false);
    expect(puedeAgregarPunto(['Plazuela'], 'Malecon')).toBe(true);
    expect(puedeAgregarPunto(['Plazuela'], '   ')).toBe(false);
  });

  it('nunca deja la lista sin puntos', () => {
    expect(quitarPunto(['Plazuela'], 'Plazuela')).toEqual(['Plazuela']);
    expect(quitarPunto(['Plazuela', 'Malecon'], 'Plazuela')).toEqual(['Malecon']);
  });
});

describe('fechas', () => {
  it('isoDesdeFechaYHora arma una marca local parseable', () => {
    const ts = isoDesdeFechaYHora('2026-07-30', '14:35');
    expect(ts).not.toBeNull();
    expect(claveFecha(ts as string)).toBe('2026-07-30');
    expect(new Date(ts as string).getHours()).toBe(14);
  });

  it('rechaza fechas que no existen', () => {
    expect(isoDesdeFechaYHora('2026-02-30', '10:00')).toBeNull();
    expect(isoDesdeFechaYHora('', '10:00')).toBeNull();
  });
});

describe('resumenTexto', () => {
  it('reporta calle, mayoreo y vendedores del dia', () => {
    const eventos: AppEvent[] = [
      venta({ id: 'a', ts: '2026-07-30T09:00:00', qty: 2 }),
      venta({ id: 'b', ts: '2026-07-30T10:00:00', qty: 6, channel: 'mayoreo', vendor: 'Primo' }),
      venta({ id: 'c', ts: '2026-07-29T10:00:00', qty: 99 }),
    ];
    const texto = resumenTexto(eventos, '2026-07-30', ['Plazuela']);
    expect(texto).toContain('Calle: 2');
    expect(texto).toContain('Mayoreo: 6');
    expect(texto).toContain('Total: 8');
    expect(texto).not.toContain('99');
  });
});

describe('turnoActual', () => {
  const HOY = '2026-07-30';

  it('es el ultimo lugar marcado por ese vendedor ese dia', () => {
    const eventos: AppEvent[] = [
      turno({ id: 't1', ts: '2026-07-30T16:00:00', point: 'Plazuela' }),
      turno({ id: 't2', ts: '2026-07-30T17:00:00', point: 'Parque Sinaloa' }),
    ];
    expect(turnoActual(eventos, 'Fran', HOY)?.point).toBe('Parque Sinaloa');
  });

  it('no mezcla vendedores: cada quien esta parado en su lugar', () => {
    const eventos: AppEvent[] = [
      turno({ id: 't1', ts: '2026-07-30T16:00:00', point: 'Plazuela', vendor: 'Fran' }),
      turno({ id: 't2', ts: '2026-07-30T16:05:00', point: 'Parque Sinaloa', vendor: 'Primo' }),
    ];
    expect(turnoActual(eventos, 'Fran', HOY)?.point).toBe('Plazuela');
    expect(turnoActual(eventos, 'Primo', HOY)?.point).toBe('Parque Sinaloa');
  });

  it('anular el turno devuelve el vendedor al anterior', () => {
    const eventos: AppEvent[] = [
      turno({ id: 't1', ts: '2026-07-30T16:00:00', point: 'Plazuela' }),
      turno({ id: 't2', ts: '2026-07-30T17:00:00', point: 'Parque Sinaloa' }),
      anulacion('v1', 't2'),
    ];
    expect(turnoActual(eventos, 'Fran', HOY)?.point).toBe('Plazuela');
  });

  it('sin lugar marcado no hay turno', () => {
    expect(turnoActual([venta({ id: 'a', ts: '2026-07-30T16:00:00' })], 'Fran', HOY)).toBeNull();
  });

  it('el turno de ayer no se arrastra a hoy', () => {
    const eventos: AppEvent[] = [turno({ id: 't1', ts: '2026-07-29T16:00:00' })];
    expect(turnoActual(eventos, 'Fran', HOY)).toBeNull();
  });
});

describe('jornada', () => {
  const HOY = '2026-07-30';
  const AHORA = new Date('2026-07-30T19:00:00');

  it('el turno se cierra cuando empieza el siguiente del mismo vendedor', () => {
    const eventos: AppEvent[] = [
      turno({ id: 't1', ts: '2026-07-30T16:00:00', point: 'Plazuela' }),
      venta({ id: 'a', ts: '2026-07-30T16:30:00', point: 'Plazuela', qty: 4 }),
      turno({ id: 't2', ts: '2026-07-30T17:00:00', point: 'Parque Sinaloa' }),
      venta({ id: 'b', ts: '2026-07-30T17:30:00', point: 'Parque Sinaloa', qty: 3 }),
    ];
    const { turnos } = jornada(eventos, HOY, AHORA);
    expect(turnos.map((t) => [t.punto, t.piezas])).toEqual([
      ['Plazuela', 4],
      ['Parque Sinaloa', 3],
    ]);
    expect(turnos[0]?.minutos).toBe(60);
    expect(turnos[0]?.franja).toBe('16:00–17:00');
  });

  it('el turno abierto de hoy corre hasta ahora', () => {
    const eventos: AppEvent[] = [
      turno({ id: 't1', ts: '2026-07-30T18:00:00' }),
      venta({ id: 'a', ts: '2026-07-30T18:30:00', qty: 2 }),
    ];
    const { turnos } = jornada(eventos, HOY, AHORA);
    expect(turnos[0]?.minutos).toBe(60);
    expect(turnos[0]?.franja).toBe('18:00–ahora');
  });

  it('el turno abierto de un dia pasado se cierra en su ultima venta, no contra el reloj de hoy', () => {
    const eventos: AppEvent[] = [
      turno({ id: 't1', ts: '2026-07-29T16:00:00' }),
      venta({ id: 'a', ts: '2026-07-29T16:45:00', qty: 2 }),
    ];
    const { turnos } = jornada(eventos, '2026-07-29', AHORA);
    expect(turnos[0]?.minutos).toBe(45);
    expect(turnos[0]?.franja).toBe('16:00–16:45');
  });

  it('una venta en otro lugar no se le carga al turno abierto', () => {
    const eventos: AppEvent[] = [
      turno({ id: 't1', ts: '2026-07-30T16:00:00', point: 'Plazuela' }),
      venta({ id: 'a', ts: '2026-07-30T16:30:00', point: 'Parque Sinaloa', qty: 5 }),
    ];
    const { turnos, sinTurno } = jornada(eventos, HOY, AHORA);
    expect(turnos[0]?.piezas).toBe(0);
    expect(sinTurno).toBe(5);
  });

  it('las ventas anteriores al primer lugar marcado quedan fuera de turno', () => {
    const eventos: AppEvent[] = [
      venta({ id: 'a', ts: '2026-07-30T15:00:00', qty: 3 }),
      turno({ id: 't1', ts: '2026-07-30T16:00:00' }),
      venta({ id: 'b', ts: '2026-07-30T16:30:00', qty: 2 }),
    ];
    const { turnos, sinTurno } = jornada(eventos, HOY, AHORA);
    expect(turnos[0]?.piezas).toBe(2);
    expect(sinTurno).toBe(3);
  });

  it('una venta anulada no cuenta en su turno', () => {
    const eventos: AppEvent[] = [
      turno({ id: 't1', ts: '2026-07-30T16:00:00' }),
      venta({ id: 'a', ts: '2026-07-30T16:30:00', qty: 4 }),
      anulacion('v1', 'a'),
    ];
    const { turnos, sinTurno } = jornada(eventos, HOY, AHORA);
    expect(turnos[0]?.piezas).toBe(0);
    expect(sinTurno).toBe(0);
  });

  it('un turno anulado desaparece y sus ventas caen fuera de turno', () => {
    const eventos: AppEvent[] = [
      turno({ id: 't1', ts: '2026-07-30T16:00:00' }),
      venta({ id: 'a', ts: '2026-07-30T16:30:00', qty: 4 }),
      anulacion('v1', 't1'),
    ];
    const { turnos, sinTurno } = jornada(eventos, HOY, AHORA);
    expect(turnos).toEqual([]);
    expect(sinTurno).toBe(4);
  });

  it('el ritmo del turno usa el mismo piso de una hora que el del dia', () => {
    const eventos: AppEvent[] = [
      turno({ id: 't1', ts: '2026-07-30T16:00:00' }),
      venta({ id: 'a', ts: '2026-07-30T16:05:00', qty: 3 }),
      turno({ id: 't2', ts: '2026-07-30T16:10:00', point: 'Parque Sinaloa' }),
    ];
    const { turnos } = jornada(eventos, HOY, AHORA);
    expect(turnos[0]?.minutos).toBe(10);
    expect(turnos[0]?.porHora).toBe(3);
  });

  it('el mayoreo del lugar tambien entra al turno: sale de la misma hielera', () => {
    const eventos: AppEvent[] = [
      turno({ id: 't1', ts: '2026-07-30T16:00:00' }),
      venta({ id: 'a', ts: '2026-07-30T16:30:00', qty: 2 }),
      venta({ id: 'b', ts: '2026-07-30T16:40:00', qty: 12, channel: 'mayoreo' }),
    ];
    expect(jornada(eventos, HOY, AHORA).turnos[0]?.piezas).toBe(14);
  });

  it('no muta el arreglo de eventos', () => {
    const eventos: AppEvent[] = [
      turno({ id: 't2', ts: '2026-07-30T17:00:00' }),
      turno({ id: 't1', ts: '2026-07-30T16:00:00' }),
    ];
    const copia = [...eventos];
    jornada(eventos, HOY, AHORA);
    expect(eventos).toEqual(copia);
  });
});

describe('porLugarYHora', () => {
  it('cruza cada lugar contra cada hora y conserva las horas muertas de en medio', () => {
    const ventas: SaleEvent[] = [
      venta({ id: 'a', ts: '2026-07-30T16:10:00', point: 'Plazuela', qty: 3 }),
      venta({ id: 'b', ts: '2026-07-30T16:40:00', point: 'Plazuela', qty: 2 }),
      venta({ id: 'c', ts: '2026-07-30T18:10:00', point: 'Parque Sinaloa', qty: 4 }),
    ];
    const m = porLugarYHora(ventas);
    expect(m.horas).toEqual([16, 17, 18]);
    expect(m.maximo).toBe(5);
    expect(m.filas.map((f) => [f.punto, f.total])).toEqual([
      ['Plazuela', 5],
      ['Parque Sinaloa', 4],
    ]);
    expect(m.filas[0]?.celdas.map((c) => c.valor)).toEqual([5, 0, 0]);
    expect(m.filas[1]?.celdas.map((c) => c.valor)).toEqual([0, 0, 4]);
  });

  it('sin ventas devuelve una matriz vacia, no una cuadricula de ceros', () => {
    expect(porLugarYHora([])).toEqual({ horas: [], filas: [], maximo: 0 });
  });

  it('solo aparecen los lugares con ventas en el rango', () => {
    const ventas: SaleEvent[] = [venta({ id: 'a', ts: '2026-07-30T16:00:00', point: 'Plazuela' })];
    expect(porLugarYHora(ventas).filas.map((f) => f.punto)).toEqual(['Plazuela']);
  });
});

describe('validarEvento con turnos', () => {
  it('acepta un turno bien formado', () => {
    const crudo = {
      id: 't1',
      type: 'shift',
      ts: '2026-07-30T16:00:00',
      point: 'Plazuela',
      vendor: 'Fran',
      device: 'dev2',
    };
    expect(validarEvento(crudo)).toEqual(crudo);
  });

  it('rechaza un turno sin lugar o con vendedor desconocido', () => {
    const base = { id: 't1', type: 'shift', ts: '2026-07-30T16:00:00', device: 'dev2' };
    expect(validarEvento({ ...base, vendor: 'Fran' })).toBeNull();
    expect(validarEvento({ ...base, point: 'Plazuela', vendor: 'Otro' })).toBeNull();
  });

  it('un turno importado dos veces no se duplica', () => {
    const t = turno({ id: 't1', ts: '2026-07-30T16:00:00' });
    const primera = mezclar([], [t]);
    const segunda = mezclar(primera.eventos, [t]);
    expect(segunda.nuevos).toBe(0);
    expect(segunda.repetidos).toBe(1);
    expect(segunda.eventos).toHaveLength(1);
  });

  it('conserva el lugar de origen de una venta corregida', () => {
    const crudo = {
      id: 's9',
      type: 'sale',
      ts: '2026-07-30T17:30:00',
      point: 'Plazuela',
      channel: 'calle',
      vendor: 'Fran',
      qty: 1,
      device: 'dev2',
      movedFrom: 'Parque Sinaloa',
    };
    expect(validarEvento(crudo)).toEqual(crudo);
    // Un origen ilegible no tira la venta: es una anotacion, no un dato de ninguna cuenta.
    expect(validarEvento({ ...crudo, movedFrom: 7 })).toEqual({ ...crudo, movedFrom: undefined });
  });
});

describe('turnoEn', () => {
  const HOY = '2026-07-30';
  const eventos: AppEvent[] = [
    turno({ id: 't1', ts: `${HOY}T16:00:00`, point: 'Parque Sinaloa' }),
    turno({ id: 't2', ts: `${HOY}T18:00:00`, point: 'Plazuela' }),
  ];

  it('devuelve el lugar que estaba vigente a esa hora, no el ultimo del dia', () => {
    expect(turnoEn(eventos, 'Fran', `${HOY}T17:00:00`)?.point).toBe('Parque Sinaloa');
    expect(turnoEn(eventos, 'Fran', `${HOY}T19:00:00`)?.point).toBe('Plazuela');
  });

  it('el turno que empieza justo a esa hora ya cuenta', () => {
    expect(turnoEn(eventos, 'Fran', `${HOY}T18:00:00`)?.point).toBe('Plazuela');
  });

  it('antes del primer lugar marcado no hay turno, y el de otro dia no se arrastra', () => {
    expect(turnoEn(eventos, 'Fran', `${HOY}T15:00:00`)).toBeNull();
    expect(turnoEn(eventos, 'Fran', '2026-07-31T17:00:00')).toBeNull();
  });
});

describe('moverVenta', () => {
  const HOY = '2026-07-30';
  const AHORA = `${HOY}T19:00:00`;

  it('anula la venta mal acreditada y reescribe la misma pieza en el lugar correcto', () => {
    const eventos: AppEvent[] = [
      venta({ id: 'a', ts: `${HOY}T17:30:00`, point: 'Parque Sinaloa', qty: 2 }),
    ];
    const movida = moverVenta(eventos, 'a', 'Plazuela', 'dev1', AHORA);
    expect(movida).not.toBeNull();
    if (movida === null) return;

    expect(movida.anulacion.refId).toBe('a');
    expect(movida.venta.id).not.toBe('a');
    expect(movida.venta.point).toBe('Plazuela');
    expect(movida.venta.movedFrom).toBe('Parque Sinaloa');
    // La hora, la cantidad y el vendedor son los de la venta: lo unico malo era el lugar.
    expect(movida.venta.ts).toBe(`${HOY}T17:30:00`);
    expect(movida.venta.qty).toBe(2);
    expect(movida.venta.vendor).toBe('Fran');

    const despues = [...eventos, movida.anulacion, movida.venta];
    expect(ventasActivas(despues).map((v) => v.point)).toEqual(['Plazuela']);
    // El dia no gana ni pierde piezas: corregir el lugar nunca mueve dinero.
    expect(totalPiezas(ventasActivas(despues))).toBe(2);
  });

  it('conserva la marca de retroactiva', () => {
    const eventos: AppEvent[] = [venta({ id: 'a', ts: `${HOY}T17:30:00`, retro: true })];
    expect(moverVenta(eventos, 'a', 'Parque Sinaloa', 'dev1', AHORA)?.venta.retro).toBe(true);
  });

  it('no mueve al mismo lugar, ni una venta anulada, ni un id que no existe', () => {
    const eventos: AppEvent[] = [
      venta({ id: 'a', ts: `${HOY}T17:30:00`, point: 'Plazuela' }),
      venta({ id: 'b', ts: `${HOY}T17:40:00`, point: 'Plazuela' }),
      anulacion('v1', 'b'),
    ];
    expect(moverVenta(eventos, 'a', 'Plazuela', 'dev1', AHORA)).toBeNull();
    expect(moverVenta(eventos, 'b', 'Parque Sinaloa', 'dev1', AHORA)).toBeNull();
    expect(moverVenta(eventos, 'zz', 'Parque Sinaloa', 'dev1', AHORA)).toBeNull();
  });
});

describe('planCorreccionLugar', () => {
  const HOY = '2026-07-30';
  const AHORA = new Date(`${HOY}T20:00:00`);

  /** Los dos salieron juntos a Parque Sinaloa a las 16:00, como siempre. */
  function enParqueSinaloa(): AppEvent[] {
    return [
      turno({ id: 't1', ts: `${HOY}T16:00:00`, point: 'Parque Sinaloa', vendor: 'Fran' }),
      turno({ id: 't2', ts: `${HOY}T16:00:00`, point: 'Parque Sinaloa', vendor: 'Primo' }),
    ];
  }

  function corregir(eventos: readonly AppEvent[], hora: string, punto: string) {
    return planCorreccionLugar(eventos, {
      desde: `${HOY}T${hora}:00`,
      punto,
      device: 'dev1',
      ahora: `${HOY}T20:00:00`,
    });
  }

  it('se movieron a la Plazuela y siguieron vendiendo: marca el lugar y reacredita las piezas', () => {
    const eventos: AppEvent[] = [
      ...enParqueSinaloa(),
      venta({ id: 'a', ts: `${HOY}T16:30:00`, point: 'Parque Sinaloa' }),
      venta({ id: 'b', ts: `${HOY}T17:30:00`, point: 'Parque Sinaloa' }),
    ];
    const plan = corregir(eventos, '17:20', 'Plazuela');
    expect(plan).not.toBeNull();
    if (plan === null) return;

    expect(plan.vendedores).toEqual(['Fran', 'Primo']);
    expect(plan.ventasMovidas).toBe(1);
    expect(plan.piezas).toBe(1);

    const despues = [...eventos, ...plan.eventos];
    expect(turnoActual(despues, 'Fran', HOY)?.point).toBe('Plazuela');
    expect(turnoActual(despues, 'Primo', HOY)?.point).toBe('Plazuela');
    // La de las 16:30 se queda donde de verdad ocurrio; solo se muda la de despues.
    expect(porPunto(ventasActivas(despues), []).map((b) => [b.etiqueta, b.valor])).toEqual([
      ['Parque Sinaloa', 1],
      ['Plazuela', 1],
    ]);
    expect(totalPiezas(ventasActivas(despues))).toBe(2);
  });

  it('la venta corregida cae dentro del turno nuevo y deja de estar fuera de turno', () => {
    const eventos: AppEvent[] = [
      ...enParqueSinaloa(),
      venta({ id: 'b', ts: `${HOY}T17:30:00`, point: 'Parque Sinaloa' }),
    ];
    const plan = corregir(eventos, '17:20', 'Plazuela');
    const despues = [...eventos, ...(plan?.eventos ?? [])];
    const { turnos, sinTurno } = jornada(despues, HOY, AHORA);
    expect(sinTurno).toBe(0);
    expect(turnos.filter((t) => t.vendedor === 'Fran').map((t) => [t.punto, t.piezas])).toEqual([
      ['Parque Sinaloa', 0],
      ['Plazuela', 1],
    ]);
  });

  it('corrige las ventas de los dos vendedores, cada quien las suyas', () => {
    const eventos: AppEvent[] = [
      ...enParqueSinaloa(),
      venta({ id: 'a', ts: `${HOY}T17:30:00`, point: 'Parque Sinaloa', vendor: 'Fran', qty: 2 }),
      venta({ id: 'b', ts: `${HOY}T17:40:00`, point: 'Parque Sinaloa', vendor: 'Primo', qty: 3 }),
    ];
    const plan = corregir(eventos, '17:20', 'Plazuela');
    expect(plan?.ventasMovidas).toBe(2);
    expect(plan?.piezas).toBe(5);
  });

  it('no toca lo que quedo despues del siguiente lugar marcado: ahi el registro ya era cierto', () => {
    const eventos: AppEvent[] = [
      ...enParqueSinaloa(),
      turno({ id: 't3', ts: `${HOY}T18:00:00`, point: 'Parque Sinaloa', vendor: 'Fran' }),
      turno({ id: 't4', ts: `${HOY}T18:00:00`, point: 'Parque Sinaloa', vendor: 'Primo' }),
      venta({ id: 'a', ts: `${HOY}T17:30:00`, point: 'Parque Sinaloa' }),
      venta({ id: 'b', ts: `${HOY}T18:30:00`, point: 'Parque Sinaloa' }),
    ];
    const plan = corregir(eventos, '17:20', 'Plazuela');
    expect(plan?.ventasMovidas).toBe(1);
    const despues = [...eventos, ...(plan?.eventos ?? [])];
    expect(
      ventasActivas(despues)
        .filter((v) => v.point === 'Parque Sinaloa')
        .map((v) => v.id)
    ).toEqual(['b']);
  });

  it('si el lugar se toco mal desde que llegaron, el turno equivocado se anula entero', () => {
    const eventos: AppEvent[] = [
      ...enParqueSinaloa(),
      venta({ id: 'a', ts: `${HOY}T16:30:00`, point: 'Parque Sinaloa' }),
    ];
    const plan = corregir(eventos, '16:00', 'Plazuela');
    const despues = [...eventos, ...(plan?.eventos ?? [])];
    // Ni un rato de cero minutos en Parque Sinaloa: nadie estuvo parado ahi.
    expect(jornada(despues, HOY, AHORA).turnos.map((t) => t.punto)).toEqual([
      'Plazuela',
      'Plazuela',
    ]);
    expect(plan?.piezas).toBe(1);
  });

  it('al que ya estaba en el lugar correcto no se le escribe nada', () => {
    const eventos: AppEvent[] = [
      turno({ id: 't1', ts: `${HOY}T16:00:00`, point: 'Parque Sinaloa', vendor: 'Fran' }),
      turno({ id: 't2', ts: `${HOY}T16:00:00`, point: 'Plazuela', vendor: 'Primo' }),
      venta({ id: 'b', ts: `${HOY}T17:30:00`, point: 'Plazuela', vendor: 'Primo' }),
    ];
    const plan = corregir(eventos, '17:20', 'Plazuela');
    expect(plan?.vendedores).toEqual(['Fran']);
    expect(plan?.ventasMovidas).toBe(0);
  });

  it('null cuando los dos ya estaban ahi: no hay nada que corregir', () => {
    const eventos: AppEvent[] = [
      turno({ id: 't1', ts: `${HOY}T16:00:00`, point: 'Plazuela', vendor: 'Fran' }),
      turno({ id: 't2', ts: `${HOY}T16:00:00`, point: 'Plazuela', vendor: 'Primo' }),
    ];
    expect(corregir(eventos, '17:20', 'Plazuela')).toBeNull();
  });

  it('sin lugar marcado marca el lugar y no inventa ventas que mover', () => {
    const plan = corregir([], '17:20', 'Plazuela');
    expect(plan?.vendedores).toEqual(['Fran', 'Primo']);
    expect(plan?.ventasMovidas).toBe(0);
    expect(plan?.eventos).toHaveLength(2);
  });
});

// ---------- contar lo que queda en la hielera ----------

describe('planConteo', () => {
  const HOY = '2026-08-08';
  const cargados = (fran: number, primo: number): AppEvent[] => [
    carga({ id: 'c1', ts: `${HOY}T10:00:00`, vendor: 'Fran', qty: fran }),
    carga({ id: 'c2', ts: `${HOY}T10:00:00`, vendor: 'Primo', qty: primo }),
  ];

  it('lo vendido es lo que falta contra lo que deberia traer', () => {
    const plan = planConteo(cargados(20, 15), HOY, { Fran: 8, Primo: 5 });
    expect(plan.piezas).toEqual({ Fran: 12, Primo: 10 });
    expect(plan.total).toBe(22);
    expect(plan.sobrantes).toEqual([]);
  });

  it('descuenta lo que ya se habia registrado antes en el dia', () => {
    const eventos = [
      ...cargados(20, 15),
      venta({ id: 'v1', ts: `${HOY}T17:00:00`, vendor: 'Fran', qty: 7 }),
    ];
    // Fran trae 13; si cuenta 8 es que se fueron 5 mas, no 12.
    const plan = planConteo(eventos, HOY, { Fran: 8, Primo: 15 });
    expect(plan.piezas.Fran).toBe(5);
    expect(plan.piezas.Primo).toBe(0);
  });

  it('el campo vacio no es cero: al que no se conto no se le registra nada', () => {
    const plan = planConteo(cargados(20, 15), HOY, { Fran: null, Primo: 5 });
    expect(plan.piezas).toEqual({ Fran: 0, Primo: 10 });
    expect(plan.lineas[0]?.contado).toBeNull();
    expect(plan.sobrantes).toEqual([]);
  });

  it('contar cero es vender la hielera entera, y eso si se registra', () => {
    const plan = planConteo(cargados(20, 15), HOY, { Fran: 0, Primo: 15 });
    expect(plan.piezas.Fran).toBe(20);
  });

  it('contar de mas no escribe venta negativa: lo marca como sobrante', () => {
    const plan = planConteo(cargados(20, 15), HOY, { Fran: 24, Primo: 5 });
    expect(plan.sobrantes.map((l) => [l.vendedor, l.sobran])).toEqual([['Fran', 4]]);
    expect(plan.piezas.Fran).toBe(0);
  });

  it('sin carga registrada cualquier conteo sobra: falta el load', () => {
    const plan = planConteo([], HOY, { Fran: 8, Primo: null });
    expect(plan.sobrantes).toHaveLength(1);
    expect(plan.lineas[0]?.sinCarga).toBe(true);
  });

  it('cuadrar exacto no registra piezas pero si deja constancia de que se conto', () => {
    const plan = planConteo(cargados(20, 15), HOY, { Fran: 20, Primo: 15 });
    expect(plan.total).toBe(0);
    expect(plan.lineas.every((l) => l.contado !== null)).toBe(true);
  });

  it('las botellas que le pasaron cuentan como suyas al contar', () => {
    const eventos = [
      ...cargados(20, 15),
      traspaso({ id: 't1', ts: `${HOY}T18:00:00`, from: 'Primo', to: 'Fran', qty: 5 }),
    ];
    // Fran trae 25 en la mano aunque solo cargo 20: contar 20 es haber vendido 5.
    const plan = planConteo(eventos, HOY, { Fran: 20, Primo: 10 });
    expect(plan.piezas).toEqual({ Fran: 5, Primo: 0 });
  });

  it('el mayoreo ya salio de la hielera: no se cobra dos veces', () => {
    const eventos = [
      ...cargados(20, 15),
      venta({ id: 'm1', ts: `${HOY}T12:00:00`, vendor: 'Fran', channel: 'mayoreo', qty: 6 }),
    ];
    const plan = planConteo(eventos, HOY, { Fran: 10, Primo: null });
    expect(plan.piezas.Fran).toBe(4);
  });

  it('solo mira el dia que se le pide', () => {
    const eventos = [
      ...cargados(20, 15),
      carga({ id: 'c3', ts: '2026-08-07T10:00:00', vendor: 'Fran', qty: 30 }),
    ];
    const plan = planConteo(eventos, HOY, { Fran: 8, Primo: null });
    expect(plan.piezas.Fran).toBe(12);
  });
});

// ---------- registrar de un jalon lo vendido en un rato ----------

describe('eventosDeHora', () => {
  const HOY = '2026-08-08';
  const TS = `${HOY}T17:00:00-07:00`;
  const base = { ts: TS, fecha: HOY, point: 'Plazuela', device: 'd' };

  it('marca el turno de los dos y acredita a cada quien lo suyo', () => {
    const nuevos = eventosDeHora([], { ...base, piezas: { Fran: 7, Primo: 5 } });

    const turnos = nuevos.filter((e) => e.type === 'shift');
    expect(turnos).toHaveLength(2);
    expect(turnos.every((t) => t.ts === TS)).toBe(true);

    const ventas = nuevos.filter((e) => e.type === 'sale');
    expect(ventas).toHaveLength(2);
    expect(ventas.map((v) => [v.vendor, v.qty])).toEqual([
      ['Fran', 7],
      ['Primo', 5],
    ]);
  });

  it('todas las piezas caen en la hora declarada, no en la de ahora', () => {
    const nuevos = eventosDeHora([], { ...base, piezas: { Fran: 7, Primo: 5 } });
    expect(nuevos.every((e) => e.ts === TS)).toBe(true);
  });

  it('son ventas normales, no retroactivas: asi se trabaja ahora', () => {
    const ventas = eventosDeHora([], { ...base, piezas: { Fran: 3, Primo: 0 } }).filter(
      (e) => e.type === 'sale'
    );
    expect(ventas[0]).not.toHaveProperty('retro');
    expect(ventas[0]?.channel).toBe('calle');
  });

  it('el que no vendio no genera venta de cero', () => {
    const nuevos = eventosDeHora([], { ...base, piezas: { Fran: 7, Primo: 0 } });
    const ventas = nuevos.filter((e) => e.type === 'sale');
    expect(ventas).toHaveLength(1);
    expect(ventas[0]?.vendor).toBe('Fran');
  });

  it('registrar dos horas del mismo lugar no parte el turno en dos', () => {
    const primera = eventosDeHora([], { ...base, piezas: { Fran: 7, Primo: 5 } });
    const segunda = eventosDeHora(primera, {
      ...base,
      ts: `${HOY}T18:00:00-07:00`,
      piezas: { Fran: 4, Primo: 3 },
    });
    expect(segunda.filter((e) => e.type === 'shift')).toHaveLength(0);
    expect(segunda.filter((e) => e.type === 'sale')).toHaveLength(2);
  });

  it('cambiar de lugar si abre turno nuevo', () => {
    const primera = eventosDeHora([], { ...base, piezas: { Fran: 7, Primo: 5 } });
    const segunda = eventosDeHora(primera, {
      ...base,
      point: 'Parque Sinaloa',
      ts: `${HOY}T18:00:00-07:00`,
      piezas: { Fran: 4, Primo: 3 },
    });
    expect(segunda.filter((e) => e.type === 'shift')).toHaveLength(2);
  });

  it('declarar la llegada sin vender nada solo marca el lugar', () => {
    const nuevos = eventosDeHora([], { ...base, piezas: { Fran: 0, Primo: 0 } });
    expect(nuevos).toHaveLength(2);
    expect(nuevos.every((e) => e.type === 'shift')).toBe(true);
  });

  it('no escribe nada cuando ya estaban ahi y nadie vendio', () => {
    const primera = eventosDeHora([], { ...base, piezas: { Fran: 0, Primo: 0 } });
    expect(eventosDeHora(primera, { ...base, piezas: { Fran: 0, Primo: 0 } })).toEqual([]);
  });
});
