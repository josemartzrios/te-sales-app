import { describe, expect, it } from 'vitest';
import type { AppEvent, SaleEvent } from './tipos';
import {
  FONDO_CAJA,
  FONDO_CAMBIO,
  FONDO_GASTO,
  PRECIOS_INICIALES,
  agregarCorte,
  borradorDe,
  borradorVacio,
  calcularReparto,
  centavosDesde,
  cerrarCorte,
  conGasto,
  corteDeFecha,
  efectivoEsperado,
  guardarBorrador,
  importe,
  ingresoDeFecha,
  nuevaLinea,
  pesos,
  repartoDeBorrador,
  resumenCorte,
  sinGasto,
  validarBorrador,
  validarCorte,
  validarPrecios,
} from './corte';
import type { Borrador, LineaGasto } from './corte';

// ---------- fixtures ----------

const FECHA = '2026-08-04';

function venta(parcial: Partial<SaleEvent> & { id: string }): SaleEvent {
  return {
    type: 'sale',
    ts: `${FECHA}T17:30:00-07:00`,
    point: 'Plazuela',
    channel: 'calle',
    vendor: 'Fran',
    qty: 1,
    device: 'dev1',
    ...parcial,
  };
}

/** Un lote de 18 vendido completo en la calle: el dia tipico que describio Fran. */
function loteDe18(): AppEvent[] {
  return [venta({ id: 'v1', qty: 18 })];
}

function gasto(id: string, concepto: string, centavos: number): LineaGasto {
  return { id, concepto, centavos };
}

/** Los gastos reales de ese dia. El cambio de 120 NO va aqui: es fondo rotatorio, no gasto. */
const MAMA_JUANI = gasto('g1', 'Mamá Juani', 4000);
const GASOLINA = gasto('g2', 'Gasolina', 4500);

function borradorCon(gastos: LineaGasto[], reponerCaja = 0): Borrador {
  return { fecha: FECHA, gastos, reponerCaja };
}

// ---------- dinero: formato y captura ----------

describe('pesos e importe', () => {
  it('siempre pone dos decimales', () => {
    expect(pesos(0)).toBe('0.00');
    expect(pesos(5)).toBe('0.05');
    expect(pesos(50)).toBe('0.50');
    expect(pesos(2000)).toBe('20.00');
    expect(pesos(13750)).toBe('137.50');
  });

  it('separa miles y conserva el signo', () => {
    expect(pesos(100000)).toBe('1,000.00');
    expect(pesos(123456789)).toBe('1,234,567.89');
    expect(pesos(-8500)).toBe('-85.00');
    expect(importe(-8500)).toBe('$-85.00');
  });
});

describe('centavosDesde', () => {
  it('acepta enteros, punto y la coma del teclado en español', () => {
    expect(centavosDesde('45')).toBe(4500);
    expect(centavosDesde('45.5')).toBe(4550);
    expect(centavosDesde('45.50')).toBe(4550);
    expect(centavosDesde('45,50')).toBe(4550);
    expect(centavosDesde(' 120 ')).toBe(12000);
    expect(centavosDesde('0')).toBe(0);
  });

  it('no pierde el centavo por redondeo de float', () => {
    // Number('45.55') * 100 da 4554.999999999999.
    expect(centavosDesde('45.55')).toBe(4555);
    expect(centavosDesde('0.07')).toBe(7);
    expect(centavosDesde('1234.56')).toBe(123456);
  });

  it('rechaza lo que no es un monto capturable', () => {
    for (const texto of ['', 'abc', '-5', '45.555', '45.', '.5', '4 5', '1e3', '45.5.5']) {
      expect(centavosDesde(texto)).toBeNull();
    }
  });

  it('rechaza montos absurdos: es un dedazo, no un gasto', () => {
    expect(centavosDesde('100000')).toBe(10000000);
    expect(centavosDesde('100000.01')).toBeNull();
  });
});

// ---------- ingreso calculado ----------

describe('ingresoDeFecha', () => {
  it('cobra la calle a 20 y el mayoreo a 14', () => {
    const eventos: AppEvent[] = [
      venta({ id: 'v1', qty: 18 }),
      venta({ id: 'v2', qty: 10, channel: 'mayoreo' }),
    ];
    const ingreso = ingresoDeFecha(eventos, FECHA, PRECIOS_INICIALES);

    expect(ingreso.calle).toEqual({ piezas: 18, centavos: 36000 });
    expect(ingreso.mayoreo).toEqual({ piezas: 10, centavos: 14000 });
    expect(ingreso.total).toBe(50000);
    expect(importe(ingreso.total)).toBe('$500.00');
  });

  it('no cuenta las ventas anuladas', () => {
    const eventos: AppEvent[] = [
      venta({ id: 'v1', qty: 18 }),
      venta({ id: 'v2', qty: 5 }),
      { id: 'x1', type: 'void', ts: `${FECHA}T18:00:00-07:00`, refId: 'v2', device: 'dev1' },
    ];
    expect(ingresoDeFecha(eventos, FECHA, PRECIOS_INICIALES).total).toBe(36000);
  });

  it('solo suma la fecha pedida', () => {
    const eventos: AppEvent[] = [
      venta({ id: 'v1', qty: 18 }),
      venta({ id: 'v2', qty: 30, ts: '2026-08-03T17:30:00-07:00' }),
    ];
    expect(ingresoDeFecha(eventos, FECHA, PRECIOS_INICIALES).calle.piezas).toBe(18);
  });

  it('un dia sin ventas da cero, no un hueco', () => {
    const ingreso = ingresoDeFecha([], FECHA, PRECIOS_INICIALES);
    expect(ingreso.total).toBe(0);
    expect(ingreso.calle.piezas).toBe(0);
  });

  it('ignora cargas y turnos: solo el dinero de las ventas', () => {
    const eventos: AppEvent[] = [
      venta({ id: 'v1', qty: 18 }),
      { id: 'c1', type: 'load', ts: `${FECHA}T09:00:00-07:00`, vendor: 'Fran', qty: 18, device: 'dev1' },
      {
        id: 't1',
        type: 'shift',
        ts: `${FECHA}T17:00:00-07:00`,
        point: 'Plazuela',
        vendor: 'Fran',
        device: 'dev1',
      },
    ];
    expect(ingresoDeFecha(eventos, FECHA, PRECIOS_INICIALES).total).toBe(36000);
  });
});

// ---------- el dia real de Fran ----------

describe('el dia real: un lote de 18 a la calle', () => {
  const ingreso = ingresoDeFecha(loteDe18(), FECHA, PRECIOS_INICIALES);
  const reparto = repartoDeBorrador(borradorCon([MAMA_JUANI, GASOLINA]), ingreso);

  it('ingresa 360 por 18 piezas a 20', () => {
    expect(importe(reparto.ingreso)).toBe('$360.00');
  });

  it('resta 85 de gastos', () => {
    expect(importe(reparto.gastos)).toBe('$85.00');
  });

  it('deja 275 de utilidad y 137.50 para cada quien', () => {
    expect(importe(reparto.utilidad)).toBe('$275.00');
    expect(importe(reparto.fran)).toBe('$137.50');
    expect(importe(reparto.primo)).toBe('$137.50');
  });

  it('no descuenta los fondos: el reparto sale completo', () => {
    expect(reparto.reponerCaja).toBe(0);
    expect(reparto.utilidad).toBe(reparto.ingreso - reparto.gastos);
  });

  it('espera 595 en efectivo: los 320 de la caja mas la utilidad', () => {
    expect(importe(efectivoEsperado(reparto))).toBe('$595.00');
    // Y es lo mismo que contar el fondo que quedo, mas lo que entro, menos lo que salio.
    expect(efectivoEsperado(reparto)).toBe(FONDO_CAJA + 36000 - 8500);
  });

  it('lo repartido mas el fondo agota el efectivo: no sobra ni falta un centavo', () => {
    expect(reparto.fran + reparto.primo + FONDO_CAJA).toBe(efectivoEsperado(reparto));
  });
});

describe('dos lotes de 18 con algo de mayoreo', () => {
  it('suma los dos canales antes de repartir', () => {
    const eventos: AppEvent[] = [
      venta({ id: 'v1', qty: 30 }),
      venta({ id: 'v2', qty: 6, channel: 'mayoreo' }),
    ];
    const ingreso = ingresoDeFecha(eventos, FECHA, PRECIOS_INICIALES);
    const reparto = repartoDeBorrador(
      borradorCon([MAMA_JUANI, GASOLINA, gasto('g3', 'Insumos', 15000)]),
      ingreso
    );

    expect(importe(ingreso.total)).toBe('$684.00'); // 30×20 + 6×14
    expect(importe(reparto.gastos)).toBe('$235.00');
    expect(importe(reparto.utilidad)).toBe('$449.00');
    expect(importe(reparto.fran)).toBe('$224.50');
    expect(importe(reparto.primo)).toBe('$224.50');
  });
});

// ---------- reparto ----------

describe('calcularReparto', () => {
  it('parte mitad y mitad cuando la utilidad es par en centavos', () => {
    const reparto = calcularReparto(36000, [MAMA_JUANI, GASOLINA], 0);
    expect(reparto.fran).toBe(13750);
    expect(reparto.primo).toBe(13750);
  });

  it('el centavo impar se lo queda Fran, que trae la caja', () => {
    const reparto = calcularReparto(27501, [], 0);
    expect(reparto.fran).toBe(13751);
    expect(reparto.primo).toBe(13750);
    expect(reparto.fran + reparto.primo).toBe(27501);
  });

  it('en perdida Fran tambien absorbe el centavo impar: la regla no cambia de signo', () => {
    const reparto = calcularReparto(0, [gasto('g', 'Insumos', 4501)], 0);
    expect(reparto.utilidad).toBe(-4501);
    expect(reparto.fran).toBe(-2251);
    expect(reparto.primo).toBe(-2250);
    expect(reparto.fran + reparto.primo).toBe(-4501);
  });

  it('reparte la perdida: un dia malo se reparte igual que uno bueno', () => {
    const reparto = calcularReparto(4000, [MAMA_JUANI, GASOLINA], 0);
    expect(importe(reparto.utilidad)).toBe('$-45.00');
    expect(importe(reparto.fran)).toBe('$-22.50');
    expect(importe(reparto.primo)).toBe('$-22.50');
  });

  it('reponer la caja sale antes del reparto', () => {
    const reparto = calcularReparto(36000, [MAMA_JUANI, GASOLINA], 15000);
    expect(importe(reparto.utilidad)).toBe('$125.00');
    expect(importe(reparto.fran)).toBe('$62.50');
    expect(importe(reparto.primo)).toBe('$62.50');
  });

  it('reponiendo la caja el efectivo esperado sigue cuadrando', () => {
    const reparto = calcularReparto(36000, [MAMA_JUANI, GASOLINA], 15000);
    // La caja arranco 150 abajo: (320 - 150) + 360 - 85 = 445.
    expect(efectivoEsperado(reparto)).toBe(FONDO_CAJA - 15000 + 36000 - 8500);
    expect(importe(efectivoEsperado(reparto))).toBe('$445.00');
  });

  it('un dia sin nada capturado no truena ni inventa', () => {
    const reparto = calcularReparto(0, [], 0);
    expect(reparto).toEqual({
      ingreso: 0,
      gastos: 0,
      reponerCaja: 0,
      ajustes: 0,
      utilidad: 0,
      fran: 0,
      primo: 0,
    });
  });

  it('las lineas de ajuste de v2 entran con su signo sin tocar nada mas', () => {
    const reparto = calcularReparto(36000, [MAMA_JUANI, GASOLINA], 0, [
      { id: 'a1', concepto: 'Adeudo corte anterior', centavos: -5000 },
    ]);
    expect(reparto.ajustes).toBe(-5000);
    expect(importe(reparto.utilidad)).toBe('$225.00');
  });

  it('suma en centavos enteros: 0.1 + 0.2 no puede dar 0.30000000000000004', () => {
    const reparto = calcularReparto(0, [gasto('a', 'a', 10), gasto('b', 'b', 20)], 0);
    expect(reparto.gastos).toBe(30);
    expect(pesos(reparto.gastos)).toBe('0.30');
  });
});

// ---------- cierre e inmutabilidad ----------

describe('cerrarCorte', () => {
  const ingreso = ingresoDeFecha(loteDe18(), FECHA, PRECIOS_INICIALES);
  const corte = cerrarCorte({
    borrador: borradorCon([MAMA_JUANI, GASOLINA]),
    ingreso,
    precios: PRECIOS_INICIALES,
    device: 'dev1',
    cerradoEn: `${FECHA}T22:10:00-07:00`,
  });

  it('congela el snapshot del ingreso, no una referencia a las ventas', () => {
    expect(corte.ingreso.calle).toEqual({ piezas: 18, centavos: 36000 });
    expect(corte.ingreso.total).toBe(36000);
  });

  it('congela los precios con los que se calculo', () => {
    expect(corte.precios).toEqual({ calle: 2000, mayoreo: 1400 });
  });

  it('congela el reparto: no se recalcula al leerlo', () => {
    expect(corte.reparto.utilidad).toBe(27500);
    expect(corte.reparto.fran).toBe(13750);
  });

  it('guarda el fondo vigente para que el corte se explique solo dentro de un año', () => {
    expect(corte.fondo).toEqual({ gasto: FONDO_GASTO, cambio: FONDO_CAMBIO });
  });

  it('deja el arreglo de ajustes listo para v2, vacio', () => {
    expect(corte.ajustes).toEqual([]);
  });

  it('copia los gastos: mover el borrador despues no mueve el corte', () => {
    const gastos = [MAMA_JUANI, GASOLINA];
    const cerrado = cerrarCorte({
      borrador: borradorCon(gastos),
      ingreso,
      precios: PRECIOS_INICIALES,
      device: 'dev1',
      cerradoEn: `${FECHA}T22:10:00-07:00`,
    });
    gastos.push(gasto('g9', 'Colado', 99999));
    expect(cerrado.gastos).toHaveLength(2);
  });

  it('corregir una venta vieja no mueve el corte de ayer', () => {
    // Manana se anula la venta v1. El ingreso recalculado se cae a cero...
    const despues: AppEvent[] = [
      ...loteDe18(),
      { id: 'x1', type: 'void', ts: '2026-08-05T09:00:00-07:00', refId: 'v1', device: 'dev1' },
    ];
    expect(ingresoDeFecha(despues, FECHA, PRECIOS_INICIALES).total).toBe(0);
    // ...pero el corte cerrado sigue diciendo lo mismo que la noche que se cerro.
    expect(corte.ingreso.total).toBe(36000);
    expect(corte.reparto.fran).toBe(13750);
  });
});

describe('agregarCorte', () => {
  const ingreso = ingresoDeFecha(loteDe18(), FECHA, PRECIOS_INICIALES);
  const corte = cerrarCorte({
    borrador: borradorCon([MAMA_JUANI, GASOLINA]),
    ingreso,
    precios: PRECIOS_INICIALES,
    device: 'dev1',
    cerradoEn: `${FECHA}T22:10:00-07:00`,
  });

  it('guarda el primero de la fecha', () => {
    const cortes = agregarCorte([], corte);
    expect(cortes).not.toBeNull();
    expect(cortes).toHaveLength(1);
  });

  it('rechaza un segundo corte de la misma fecha', () => {
    const cortes = agregarCorte([], corte);
    expect(cortes).not.toBeNull();
    expect(agregarCorte(cortes ?? [], corte)).toBeNull();
  });

  it('no muta el arreglo que recibe', () => {
    const previos = [corte];
    const otro = { ...corte, fecha: '2026-08-05' };
    agregarCorte(previos, otro);
    expect(previos).toHaveLength(1);
  });

  it('ordena por fecha para que la lista se lea sola', () => {
    const viejo = { ...corte, fecha: '2026-08-01' };
    const cortes = agregarCorte([corte], viejo);
    expect(cortes?.map((c) => c.fecha)).toEqual(['2026-08-01', FECHA]);
  });

  it('corteDeFecha encuentra el de esa fecha y solo ese', () => {
    expect(corteDeFecha([corte], FECHA)?.fecha).toBe(FECHA);
    expect(corteDeFecha([corte], '2026-08-03')).toBeNull();
  });
});

// ---------- borradores ----------

describe('borradores', () => {
  it('una fecha sin borrador arranca vacia, no undefined', () => {
    expect(borradorDe([], FECHA)).toEqual({ fecha: FECHA, gastos: [], reponerCaja: 0 });
  });

  it('agregar y quitar gastos no muta el borrador anterior', () => {
    const inicial = borradorVacio(FECHA);
    const conUno = conGasto(inicial, MAMA_JUANI);
    expect(inicial.gastos).toHaveLength(0);
    expect(conUno.gastos).toHaveLength(1);
    expect(sinGasto(conUno, 'g1').gastos).toHaveLength(0);
  });

  it('quitar un id que no existe deja el borrador igual', () => {
    const conUno = conGasto(borradorVacio(FECHA), MAMA_JUANI);
    expect(sinGasto(conUno, 'no-existe').gastos).toHaveLength(1);
  });

  it('guarda un borrador por fecha y reemplaza el de esa fecha', () => {
    const uno = conGasto(borradorVacio(FECHA), MAMA_JUANI);
    const otro = borradorCon([GASOLINA], 0);
    const guardados = guardarBorrador(guardarBorrador([], uno), otro);
    expect(guardados).toHaveLength(1);
    expect(guardados[0]?.gastos[0]?.concepto).toBe('Gasolina');
  });

  it('no guarda basura: un borrador sin nada capturado se descarta', () => {
    const conUno = guardarBorrador([], conGasto(borradorVacio(FECHA), MAMA_JUANI));
    expect(guardarBorrador(conUno, borradorVacio(FECHA))).toHaveLength(0);
  });

  it('conserva el borrador de otra fecha', () => {
    const hoy = conGasto(borradorVacio(FECHA), MAMA_JUANI);
    const ayer = conGasto(borradorVacio('2026-08-03'), GASOLINA);
    const guardados = guardarBorrador(guardarBorrador([], ayer), hoy);
    expect(guardados).toHaveLength(2);
    expect(borradorDe(guardados, '2026-08-03').gastos[0]?.concepto).toBe('Gasolina');
  });

  it('nuevaLinea limpia el concepto', () => {
    expect(nuevaLinea('  Gasolina  ', 4500, 'id1')).toEqual({
      id: 'id1',
      concepto: 'Gasolina',
      centavos: 4500,
    });
  });
});

// ---------- lectura defensiva ----------

describe('validarCorte', () => {
  const ingreso = ingresoDeFecha(loteDe18(), FECHA, PRECIOS_INICIALES);
  const corte = cerrarCorte({
    borrador: borradorCon([MAMA_JUANI, GASOLINA]),
    ingreso,
    precios: PRECIOS_INICIALES,
    device: 'dev1',
    cerradoEn: `${FECHA}T22:10:00-07:00`,
  });

  it('un corte guardado por esta app se lee igualito', () => {
    expect(validarCorte(JSON.parse(JSON.stringify(corte)))).toEqual(corte);
  });

  it('rechaza lo que no es un corte', () => {
    for (const valor of [null, undefined, 0, 'corte', [], {}, { version: 2 }]) {
      expect(validarCorte(valor)).toBeNull();
    }
  });

  it('rechaza fechas que no son YYYY-MM-DD', () => {
    expect(validarCorte({ ...corte, fecha: '4/8/2026' })).toBeNull();
    expect(validarCorte({ ...corte, fecha: 20260804 })).toBeNull();
  });

  it('rechaza dinero que no es entero de centavos', () => {
    expect(validarCorte({ ...corte, reparto: { ...corte.reparto, fran: 137.5 } })).toBeNull();
    expect(validarCorte({ ...corte, reparto: { ...corte.reparto, fran: NaN } })).toBeNull();
    expect(validarCorte({ ...corte, reparto: { ...corte.reparto, fran: Infinity } })).toBeNull();
  });

  it('rechaza un corte sin reparto: no lo recalcula por su cuenta', () => {
    const { reparto: _, ...sinReparto } = corte;
    expect(validarCorte(sinReparto)).toBeNull();
  });

  it('descarta la linea de gasto podrida pero conserva el corte', () => {
    const leido = validarCorte({ ...corte, gastos: [MAMA_JUANI, { id: 'x' }, 'basura', null] });
    expect(leido?.gastos).toHaveLength(1);
    expect(leido?.reparto.utilidad).toBe(27500);
  });

  it('un corte viejo sin ajustes se lee con el arreglo vacio', () => {
    const { ajustes: _, ...sinAjustes } = corte;
    expect(validarCorte(sinAjustes)?.ajustes).toEqual([]);
  });

  it('un corte sin fondo guardado cae al fondo vigente', () => {
    const { fondo: _, ...sinFondo } = corte;
    expect(validarCorte(sinFondo)?.fondo).toEqual({ gasto: FONDO_GASTO, cambio: FONDO_CAMBIO });
  });
});

describe('validarBorrador y validarPrecios', () => {
  it('lee un borrador guardado', () => {
    const borrador = borradorCon([MAMA_JUANI], 15000);
    expect(validarBorrador(JSON.parse(JSON.stringify(borrador)))).toEqual(borrador);
  });

  it('sin fecha valida no hay borrador', () => {
    expect(validarBorrador({ gastos: [], reponerCaja: 0 })).toBeNull();
    expect(validarBorrador(null)).toBeNull();
  });

  it('un reponerCaja corrupto cae a cero en vez de tirar el borrador', () => {
    expect(validarBorrador({ fecha: FECHA, gastos: [], reponerCaja: 'mucho' })?.reponerCaja).toBe(0);
    expect(validarBorrador({ fecha: FECHA, gastos: [], reponerCaja: -5 })?.reponerCaja).toBe(0);
  });

  it('los precios corruptos caen a los de fabrica, nunca a cero', () => {
    expect(validarPrecios(null)).toEqual({ calle: 2000, mayoreo: 1400 });
    expect(validarPrecios({ calle: 0, mayoreo: 'gratis' })).toEqual({ calle: 2000, mayoreo: 1400 });
    expect(validarPrecios({ calle: 2500, mayoreo: 1600 })).toEqual({ calle: 2500, mayoreo: 1600 });
  });
});

// ---------- resumen copiable ----------

describe('resumenCorte', () => {
  it('arma el texto del dia real', () => {
    const ingreso = ingresoDeFecha(loteDe18(), FECHA, PRECIOS_INICIALES);
    const corte = cerrarCorte({
      borrador: borradorCon([MAMA_JUANI, GASOLINA]),
      ingreso,
      precios: PRECIOS_INICIALES,
      device: 'dev1',
      cerradoEn: `${FECHA}T22:10:00-07:00`,
    });

    expect(resumenCorte(corte)).toBe(
      [
        'Corte 04/08/2026',
        '',
        'Calle: 18 × $20.00 = $360.00',
        'Ingreso: $360.00',
        '',
        'Gastos: $85.00',
        '- Mamá Juani: $40.00',
        '- Gasolina: $45.00',
        '',
        'Utilidad: $275.00',
        'Fran: $137.50',
        'Primo: $137.50',
        '',
        'Caja: dejar $320.00 (200.00 gasto + 120.00 cambio)',
        'Efectivo esperado al cerrar: $595.00',
      ].join('\n')
    );
  });

  it('incluye el mayoreo solo cuando hubo', () => {
    const eventos: AppEvent[] = [venta({ id: 'v1', qty: 18 }), venta({ id: 'v2', qty: 10, channel: 'mayoreo' })];
    const corte = cerrarCorte({
      borrador: borradorCon([]),
      ingreso: ingresoDeFecha(eventos, FECHA, PRECIOS_INICIALES),
      precios: PRECIOS_INICIALES,
      device: 'dev1',
      cerradoEn: `${FECHA}T22:10:00-07:00`,
    });
    expect(resumenCorte(corte)).toContain('Mayoreo: 10 × $14.00 = $140.00');
  });

  it('muestra la linea de reponer caja solo cuando se uso', () => {
    const ingreso = ingresoDeFecha(loteDe18(), FECHA, PRECIOS_INICIALES);
    const base = {
      ingreso,
      precios: PRECIOS_INICIALES,
      device: 'dev1',
      cerradoEn: `${FECHA}T22:10:00-07:00`,
    };
    expect(resumenCorte(cerrarCorte({ ...base, borrador: borradorCon([]) }))).not.toContain(
      'Reponer caja'
    );
    expect(
      resumenCorte(cerrarCorte({ ...base, borrador: borradorCon([], 15000) }))
    ).toContain('Reponer caja: $150.00');
  });
});
