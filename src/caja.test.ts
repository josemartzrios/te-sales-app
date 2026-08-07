import { describe, expect, it } from 'vitest';
import type { MovimientoCaja, Sobre, TipoMovimiento } from './caja';
import {
  BASE_SOBRE,
  TASAS_INICIALES,
  agregarMovimientos,
  estadoCaja,
  movimientosDeCierre,
  movimientosRecientes,
  planCaja,
  resumenCaja,
  saldoDe,
  sobresEnDeuda,
  validarMovimiento,
  validarTasas,
} from './caja';
import { calcularReparto, importe } from './corte';

// ---------- fixtures ----------

const FECHA = '2026-08-07';

let contador = 0;

function mov(
  tipo: TipoMovimiento,
  sobre: Sobre,
  centavos: number,
  concepto = 'x'
): MovimientoCaja {
  contador += 1;
  return {
    id: `m${contador}`,
    ts: `${FECHA}T20:00:00-07:00`,
    fecha: FECHA,
    device: 'dev1',
    tipo,
    sobre,
    centavos,
    concepto,
  };
}

// ---------- saldos ----------

describe('saldos de los sobres', () => {
  it('sin movimientos la caja trae los fondos rotatorios y nada mas', () => {
    const estado = estadoCaja([]);
    expect(estado.hay).toBe(32000);
    expect(estado.objetivo).toBe(32000);
    expect(estado.deuda).toBe(0);
    expect(saldoDe([], 'gasolina')).toEqual({
      sobre: 'gasolina',
      objetivo: 0,
      hay: 0,
      deuda: 0,
    });
  });

  it('apartar sube las dos columnas: el sobre debe mas y tambien tiene mas', () => {
    const s = saldoDe([mov('apartado', 'gasolina', 4500)], 'gasolina');
    expect(s.objetivo).toBe(4500);
    expect(s.hay).toBe(4500);
    expect(s.deuda).toBe(0);
  });

  it('pagar vacia el sobre sin dejar deuda: para eso se habia apartado', () => {
    const s = saldoDe(
      [mov('apartado', 'gasolina', 4500), mov('apartado', 'gasolina', 4500), mov('pago', 'gasolina', -9000)],
      'gasolina'
    );
    expect(s.objetivo).toBe(0);
    expect(s.hay).toBe(0);
    expect(s.deuda).toBe(0);
  });

  it('tomar prestado baja el efectivo pero no lo que el sobre deberia tener: eso es la deuda', () => {
    const s = saldoDe([mov('prestamo', 'fondo', -20000, 'Insumos')], 'fondo');
    expect(s.objetivo).toBe(20000);
    expect(s.hay).toBe(0);
    expect(s.deuda).toBe(20000);
  });

  it('devolver salda la deuda sin inflar el objetivo', () => {
    const s = saldoDe(
      [mov('prestamo', 'fondo', -20000), mov('reposicion', 'fondo', 20000)],
      'fondo'
    );
    expect(s.objetivo).toBe(20000);
    expect(s.hay).toBe(20000);
    expect(s.deuda).toBe(0);
  });

  it('cada tipo se deshace con su inverso: no hace falta editar un movimiento', () => {
    const mal = [mov('apartado', 'gas', 4000)];
    const corregido = [...mal, mov('pago', 'gas', -4000)];
    expect(saldoDe(corregido, 'gas')).toEqual(saldoDe([], 'gas'));
  });

  it('el efectivo de la caja siempre es lo que deberia haber menos lo que se debe', () => {
    const estado = estadoCaja([
      mov('apartado', 'gasolina', 4500),
      mov('prestamo', 'gasolina', -2500),
      mov('apartado', 'primo', 13750),
      mov('prestamo', 'fondo', -5000),
    ]);
    expect(estado.hay).toBe(estado.objetivo - estado.deuda);
  });
});

// ---------- el caso real ----------

/**
 * El dia que Fran describio: tomo prestado el fondo y lo que llevaba apartado de gasolina para
 * comprar insumos, alcanzo a devolver casi todo y quedo debiendo 25 de gasolina.
 */
describe('el dia real: tomé prestado para comprar insumos', () => {
  const movimientos: MovimientoCaja[] = [
    mov('apartado', 'gasolina', 4500, 'Apartado del lunes'),
    mov('prestamo', 'fondo', -20000, 'Insumos'),
    mov('prestamo', 'gasolina', -4500, 'Insumos'),
    mov('reposicion', 'fondo', 20000, 'Devuelto el martes'),
    mov('reposicion', 'gasolina', 2000, 'Devuelto el martes'),
  ];
  const estado = estadoCaja(movimientos);

  it('debe exactamente 25 y sabe de que sobre', () => {
    expect(importe(estado.deuda)).toBe('$25.00');
    const faltantes = sobresEnDeuda(estado);
    expect(faltantes).toHaveLength(1);
    expect(faltantes[0]?.sobre).toBe('gasolina');
    expect(importe(faltantes[0]?.deuda ?? 0)).toBe('$25.00');
  });

  it('el fondo ya quedo completo y no aparece como faltante', () => {
    expect(saldoDe(movimientos, 'fondo').deuda).toBe(0);
    expect(saldoDe(movimientos, 'fondo').hay).toBe(BASE_SOBRE.fondo);
  });

  it('en la caja hay 25 menos de lo que deberia haber', () => {
    expect(estado.objetivo - estado.hay).toBe(2500);
    expect(importe(estado.objetivo)).toBe('$365.00'); // 200 fondo + 120 cambio + 45 de gasolina
    expect(importe(estado.hay)).toBe('$340.00'); // los mismos 365 menos los 25 que faltan
  });

  /**
   * El punto de todo el modulo: los 245 prestados compraron insumos que ya bajaron la utilidad
   * el dia que se compraron. Devolverlos a la caja no vuelve a tocar el reparto.
   */
  it('devolver el prestamo no aparece en ninguna utilidad', () => {
    const dia1 = calcularReparto(0, [{ id: 'g', concepto: 'Insumos', centavos: 24500 }]);
    const dia2 = calcularReparto(60000, []);
    expect(dia1.utilidad + dia2.utilidad).toBe(60000 - 24500);
  });
});

// ---------- el plan del dia ----------

describe('planCaja', () => {
  const base = { tasas: TASAS_INICIALES, huboVentas: true };

  it('un dia normal: aparta 85, le abona su mitad a Primo y el resto es de Fran', () => {
    const reparto = calcularReparto(70000, []);
    const plan = planCaja({ ...base, utilidad: reparto.utilidad, primo: reparto.primo, deuda: 0 });

    expect(plan.totalApartado).toBe(8500);
    expect(plan.primo).toBe(35000);
    expect(importe(plan.seQuedaEnCaja)).toBe('$435.00');
    expect(importe(plan.paraFran)).toBe('$265.00');
  });

  it('lo que se queda mas lo que se lleva Fran es la utilidad completa: no se pierde un peso', () => {
    const plan = planCaja({ ...base, utilidad: 70000, primo: 35000, deuda: 2500 });
    expect(plan.seQuedaEnCaja + plan.paraFran).toBe(70000);
  });

  it('con deuda pendiente la devuelve antes de que Fran se lleve nada', () => {
    const plan = planCaja({ ...base, utilidad: 70000, primo: 35000, deuda: 2500 });
    expect(plan.reponer).toBe(2500);
    expect(plan.restante).toBe(0);
    expect(importe(plan.paraFran)).toBe('$240.00');
  });

  /**
   * 120 de utilidad: 60 son de Primo y solo quedan 60 para los 85 del apartado. Se llena la
   * gasolina completa y el gas a medias, en vez de dejar a Fran poniendo 25 de su bolsa.
   */
  it('en un dia flojo aparta hasta donde alcanza y arrastra la deuda', () => {
    const plan = planCaja({ ...base, utilidad: 12000, primo: 6000, deuda: 10000 });
    expect(plan.apartados).toEqual([
      { sobre: 'gasolina', centavos: 4500 },
      { sobre: 'gas', centavos: 1500 },
    ]);
    expect(plan.reponer).toBe(0);
    expect(plan.restante).toBe(10000);
    expect(plan.paraFran).toBe(0);
  });

  it('sin efectivo despues de la mitad de Primo no aparta nada', () => {
    const plan = planCaja({ ...base, utilidad: 6000, primo: 3000, deuda: 0 });
    expect(plan.totalApartado).toBe(3000);
    expect(plan.paraFran).toBe(0);
  });

  it('sin ventas no aparta nada: el apartado es por dia vendido, no por dia del calendario', () => {
    const plan = planCaja({ ...base, huboVentas: false, utilidad: 0, primo: 0, deuda: 2500 });
    expect(plan.apartados).toEqual([]);
    expect(plan.totalApartado).toBe(0);
    expect(plan.reponer).toBe(0);
    expect(plan.restante).toBe(2500);
  });

  it('un dia en perdida se reparte igual: los dos absorben su mitad y no se aparta nada', () => {
    const plan = planCaja({ ...base, utilidad: -5000, primo: -2500, deuda: 0 });
    expect(plan.apartados).toEqual([]);
    expect(plan.reponer).toBe(0);
    // La perdida sale de lo acumulado de Primo y del lado de Fran, mitad y mitad.
    expect(plan.seQuedaEnCaja).toBe(-2500);
    expect(plan.paraFran).toBe(-2500);
    expect(plan.seQuedaEnCaja + plan.paraFran).toBe(-5000);
  });

  it('una tasa en cero no genera linea de apartado', () => {
    const plan = planCaja({
      utilidad: 70000,
      primo: 35000,
      deuda: 0,
      tasas: { gasolina: 4500, gas: 0 },
      huboVentas: true,
    });
    expect(plan.apartados).toHaveLength(1);
    expect(plan.totalApartado).toBe(4500);
  });
});

// ---------- cierre ----------

describe('movimientosDeCierre', () => {
  const plan = planCaja({
    utilidad: 70000,
    primo: 35000,
    deuda: 0,
    tasas: TASAS_INICIALES,
    huboVentas: true,
  });

  it('aparta gasolina, gas y la mitad de Primo', () => {
    const movs = movimientosDeCierre({
      fecha: FECHA,
      ts: `${FECHA}T22:00:00-07:00`,
      device: 'dev1',
      primo: 35000,
      plan,
    });
    expect(movs.map((m) => m.sobre)).toEqual(['gasolina', 'gas', 'primo']);
    expect(movs.every((m) => m.tipo === 'apartado')).toBe(true);
    expect(estadoCaja(movs).hay).toBe(32000 + 4500 + 4000 + 35000);
  });

  it('los ids salen de la fecha, asi que cerrar dos veces no aparta el doble', () => {
    const entrada = {
      fecha: FECHA,
      ts: `${FECHA}T22:00:00-07:00`,
      device: 'dev1',
      primo: 35000,
      plan,
    };
    const unaVez = agregarMovimientos([], movimientosDeCierre(entrada));
    const dosVeces = agregarMovimientos(unaVez, movimientosDeCierre(entrada));
    expect(dosVeces).toHaveLength(unaVez.length);
    expect(estadoCaja(dosVeces)).toEqual(estadoCaja(unaVez));
  });

  it('una utilidad negativa le resta al acumulado de Primo: el mal dia tambien es suyo', () => {
    const malo = planCaja({
      utilidad: -5000,
      primo: -2500,
      deuda: 0,
      tasas: TASAS_INICIALES,
      huboVentas: true,
    });
    const movs = movimientosDeCierre({
      fecha: FECHA,
      ts: `${FECHA}T22:00:00-07:00`,
      device: 'dev1',
      primo: -2500,
      plan: malo,
    });
    expect(saldoDe(movs, 'primo').hay).toBe(-2500);
  });

  it('sin mitad para Primo no escribe una linea de cero', () => {
    const movs = movimientosDeCierre({
      fecha: FECHA,
      ts: `${FECHA}T22:00:00-07:00`,
      device: 'dev1',
      primo: 0,
      plan,
    });
    expect(movs.some((m) => m.sobre === 'primo')).toBe(false);
  });
});

// ---------- historial ----------

describe('movimientosRecientes', () => {
  it('devuelve los ultimos primero y respeta el limite', () => {
    const viejo = { ...mov('apartado', 'gasolina', 4500), ts: '2026-08-01T20:00:00-07:00' };
    const nuevo = { ...mov('apartado', 'gasolina', 4500), ts: '2026-08-07T20:00:00-07:00' };
    expect(movimientosRecientes([viejo, nuevo], 5).map((m) => m.ts)).toEqual([nuevo.ts, viejo.ts]);
    expect(movimientosRecientes([viejo, nuevo], 1)).toHaveLength(1);
  });
});

// ---------- validacion defensiva ----------

describe('validarMovimiento', () => {
  const bueno = mov('prestamo', 'fondo', -20000, 'Insumos');

  it('lee un movimiento guardado tal cual se escribio', () => {
    expect(validarMovimiento(JSON.parse(JSON.stringify(bueno)))).toEqual(bueno);
  });

  it('rechaza lo que descuadraria la caja en silencio', () => {
    expect(validarMovimiento({ ...bueno, centavos: 0 })).toBeNull();
    expect(validarMovimiento({ ...bueno, centavos: 12.5 })).toBeNull();
    expect(validarMovimiento({ ...bueno, centavos: Number.NaN })).toBeNull();
    expect(validarMovimiento({ ...bueno, sobre: 'tanda' })).toBeNull();
    expect(validarMovimiento({ ...bueno, tipo: 'ajuste' })).toBeNull();
    expect(validarMovimiento({ ...bueno, fecha: '7/8/2026' })).toBeNull();
    expect(validarMovimiento({ ...bueno, concepto: '' })).toBeNull();
    expect(validarMovimiento(null)).toBeNull();
    expect(validarMovimiento([bueno])).toBeNull();
  });
});

describe('validarTasas', () => {
  it('lo ilegible cae al apartado de fabrica, no a cero', () => {
    expect(validarTasas(null)).toEqual(TASAS_INICIALES);
    expect(validarTasas({ gasolina: 'mucha', gas: -100 })).toEqual(TASAS_INICIALES);
  });

  it('acepta cero a proposito: apagar un apartado es una decision, no un error', () => {
    expect(validarTasas({ gasolina: 5000, gas: 0 })).toEqual({ gasolina: 5000, gas: 0 });
  });
});

// ---------- resumen copiable ----------

describe('resumenCaja', () => {
  it('dice cuanto falta y en que sobre', () => {
    const texto = resumenCaja(
      estadoCaja([mov('apartado', 'gasolina', 4500), mov('prestamo', 'gasolina', -2500)])
    );
    expect(texto).toContain('Gasolina: $20.00 de 45.00 (faltan $25.00)');
    expect(texto).toContain('Debemos a la caja: $25.00');
  });

  it('con la caja completa lo dice y ya', () => {
    const texto = resumenCaja(estadoCaja([]));
    expect(texto).toContain('La caja está al corriente');
    expect(texto).not.toContain('Debemos');
  });
});
