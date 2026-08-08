import { describe, expect, it } from 'vitest';
import type { MovimientoCaja, Sobre, TipoMovimiento } from './caja';
import {
  BASE_SOBRE,
  TASAS_INICIALES,
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
  movimientosRecientes,
  origenDelGasto,
  planCaja,
  planSemana,
  resumenCaja,
  saldoDe,
  sellarMovimientos,
  sinMovimientosDeGasto,
  sobresEnDeuda,
  tipoDeMovimiento,
  validarMovimiento,
  validarTasas,
} from './caja';
import { calcularReparto, efectivoEsperado, importe } from './corte';

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

/** Un movimiento capturado a mano hoy: todavia editable porque nadie ha cerrado el corte. */
function abierto(
  tipo: TipoMovimiento,
  sobre: Sobre,
  centavos: number,
  concepto = 'x'
): MovimientoCaja {
  return { ...mov(tipo, sobre, centavos, concepto), abierto: true };
}

// ---------- el tipo se deduce, no se pregunta ----------

describe('tipoDeMovimiento', () => {
  it('lo tecleado a mano solo mueve efectivo: sale y se debe, entra y se salda', () => {
    expect(tipoDeMovimiento(-1)).toBe('prestamo');
    expect(tipoDeMovimiento(1)).toBe('reposicion');
  });

  it('sacar de la gasolina para un gasto deja deuda, igual que sacar del fondo', () => {
    // La regla del negocio: los gastos se cubren con el fondo y, si no alcanza, con la
    // gasolina. Ese faltante tiene que aparecer, o el domingo no alcanza para cargar.
    const delFondo = mov(tipoDeMovimiento(-1), 'fondo', -20000, 'botellas PET');
    const deLaGasolina = mov(tipoDeMovimiento(-1), 'gasolina', -1800, 'botellas PET');
    const estado = estadoCaja([delFondo, deLaGasolina]);
    expect(saldoDe([delFondo], 'fondo').deuda).toBe(20000);
    expect(saldoDe([deLaGasolina], 'gasolina').deuda).toBe(1800);
    expect(estado.deuda).toBe(21800);
  });

  it('devolver salda sin tocar lo que el sobre deberia traer', () => {
    const saca = mov(tipoDeMovimiento(-1), 'gasolina', -1800);
    const devuelve = mov(tipoDeMovimiento(1), 'gasolina', 1800);
    const saldo = saldoDe([saca, devuelve], 'gasolina');
    expect(saldo.deuda).toBe(0);
    expect(saldo.objetivo).toBe(0);
  });
});

// ---------- corregir lo capturado ----------

describe('editarMovimiento', () => {
  it('cambia monto y concepto de un movimiento abierto', () => {
    const m = abierto('prestamo', 'gasolina', -4500, 'tecle mal');
    const nuevos = editarMovimiento([m], m.id, {
      sobre: 'gasolina',
      centavos: -5500,
      concepto: 'botellas PET',
    });
    expect(nuevos?.[0]).toMatchObject({
      centavos: -5500,
      concepto: 'botellas PET',
      tipo: 'prestamo',
      abierto: true,
    });
  });

  it('recalcula el tipo al voltear el signo: si no, quedaria una deuda fantasma', () => {
    // Nacio como prestamo; corregido a positivo tiene que volverse reposicion y saldar.
    const m = abierto('prestamo', 'fondo', -24500, 'insumos');
    const nuevos = editarMovimiento([m], m.id, {
      sobre: 'fondo',
      centavos: 24500,
      concepto: 'devolvi',
    });
    expect(nuevos?.[0]?.tipo).toBe('reposicion');
    expect(estadoCaja(nuevos ?? []).deuda).toBe(-24500);
  });

  it('no toca un movimiento sellado ni uno que no existe', () => {
    const sellado = mov('pago', 'gasolina', -4500);
    const cambios = { sobre: 'gasolina' as Sobre, centavos: -1000, concepto: 'x' };
    expect(editarMovimiento([sellado], sellado.id, cambios)).toBeNull();
    expect(editarMovimiento([sellado], 'no-existe', cambios)).toBeNull();
  });

  it('rechaza el cero y los centavos partidos: un movimiento de nada no es un movimiento', () => {
    const m = abierto('pago', 'gasolina', -4500);
    const base = { sobre: 'gasolina' as Sobre, concepto: 'x' };
    expect(editarMovimiento([m], m.id, { ...base, centavos: 0 })).toBeNull();
    expect(editarMovimiento([m], m.id, { ...base, centavos: -12.5 })).toBeNull();
  });

  it('no altera el arreglo original', () => {
    const m = abierto('pago', 'gasolina', -4500);
    const original = [m];
    editarMovimiento(original, m.id, { sobre: 'gasolina', centavos: -9000, concepto: 'x' });
    expect(original[0]?.centavos).toBe(-4500);
  });
});

describe('borrarMovimiento', () => {
  it('quita el abierto y deja la caja como si nunca se hubiera capturado', () => {
    const m = abierto('prestamo', 'fondo', -24500);
    const nuevos = borrarMovimiento([m], m.id);
    expect(nuevos).toEqual([]);
    expect(estadoCaja(nuevos ?? []).deuda).toBe(0);
  });

  it('no borra un sellado ni uno inexistente', () => {
    const sellado = mov('prestamo', 'fondo', -24500);
    expect(borrarMovimiento([sellado], sellado.id)).toBeNull();
    expect(borrarMovimiento([sellado], 'no-existe')).toBeNull();
  });
});

describe('sellarMovimientos', () => {
  it('cierra los abiertos y deja de poder editarlos', () => {
    const m = abierto('pago', 'gasolina', -4500);
    const sellados = sellarMovimientos([m]);
    expect(sellados[0]).not.toHaveProperty('abierto');
    expect(editarMovimiento(sellados, m.id, { sobre: 'gasolina', centavos: -1, concepto: 'x' })).toBeNull();
    expect(borrarMovimiento(sellados, m.id)).toBeNull();
  });

  it('no mueve el dinero: sellar solo quita el permiso de editar', () => {
    const antes = [abierto('apartado', 'gasolina', 4500), mov('prestamo', 'fondo', -24500)];
    expect(estadoCaja(sellarMovimientos(antes))).toEqual(estadoCaja(antes));
  });

  it('lo ya sellado pasa tal cual, sin copiarse', () => {
    const sellado = mov('pago', 'gas', -4000);
    expect(sellarMovimientos([sellado])[0]).toBe(sellado);
  });
});

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
  const base = { tasas: TASAS_INICIALES, huboVentas: true, deuda: 0 };

  /**
   * El dia que describe Fran: 1 lote de 18 botellas a 20 son 360 de ingreso, y el te costo 154
   * pagados con dinero del fondo. Su cuenta con la mano da 60.50 para cada uno.
   */
  it('el dia real de Fran: 60.50 para cada quien, no 0 y 103', () => {
    const reparto = calcularReparto(36000, [{ id: 'g', concepto: 'Te', centavos: 15400 }]);
    const plan = planCaja({ ...base, utilidad: reparto.utilidad, deuda: 15400 });

    expect(importe(reparto.utilidad)).toBe('$206.00');
    expect(plan.totalApartado).toBe(8500);
    expect(importe(plan.repartible)).toBe('$121.00');
    expect(importe(plan.fran)).toBe('$60.50');
    expect(importe(plan.primo)).toBe('$60.50');
  });

  it('el apartado sale antes de repartir: lo pagan los dos, no solo Fran', () => {
    const plan = planCaja({ ...base, utilidad: 70000 });
    expect(plan.totalApartado).toBe(8500);
    expect(plan.repartible).toBe(70000 - 8500);
    // Mitades iguales. Antes Primo cobraba 35000 completos y Fran financiaba los 8500.
    expect(plan.fran).toBe(30750);
    expect(plan.primo).toBe(30750);
  });

  it('la deuda no se cobra en el reparto: el gasto ya la pago', () => {
    // Misma utilidad con y sin deuda pendiente reparte exactamente igual. Cobrarla aqui seria
    // cobrar dos veces el gasto que la genero.
    const sinDeuda = planCaja({ ...base, utilidad: 70000, deuda: 0 });
    const conDeuda = planCaja({ ...base, utilidad: 70000, deuda: 25000 });
    expect(conDeuda.fran).toBe(sinDeuda.fran);
    expect(conDeuda.primo).toBe(sinDeuda.primo);
    expect(conDeuda.deuda).toBe(25000);
  });

  it('lo que se queda mas lo que se lleva Fran es la utilidad completa: no se pierde un peso', () => {
    const plan = planCaja({ ...base, utilidad: 70000, deuda: 2500 });
    expect(plan.seQuedaEnCaja + plan.fran).toBe(70000);
  });

  it('el centavo impar se lo queda Fran, que trae la caja', () => {
    const plan = planCaja({ ...base, huboVentas: false, utilidad: 101 });
    expect(plan.fran).toBe(51);
    expect(plan.primo).toBe(50);
  });

  /**
   * 120 de utilidad contra 85 de apartado: alcanza para los dos sobres y quedan 35 a repartir.
   * El tope existe para no obligar a nadie a poner dinero de su bolsa.
   */
  it('en un dia flojo aparta hasta donde alcanza', () => {
    const plan = planCaja({ ...base, utilidad: 12000, deuda: 10000 });
    expect(plan.apartados).toEqual([
      { sobre: 'gasolina', centavos: 4500 },
      { sobre: 'gas', centavos: 4000 },
    ]);
    expect(plan.repartible).toBe(3500);
  });

  it('si la utilidad no da ni para el apartado, aparta lo que hay y no reparte nada', () => {
    const plan = planCaja({ ...base, utilidad: 6000 });
    expect(plan.apartados).toEqual([
      { sobre: 'gasolina', centavos: 4500 },
      { sobre: 'gas', centavos: 1500 },
    ]);
    expect(plan.totalApartado).toBe(6000);
    expect(plan.repartible).toBe(0);
    expect(plan.fran).toBe(0);
  });

  it('sin ventas no aparta nada: el apartado es por dia vendido, no por dia del calendario', () => {
    const plan = planCaja({ ...base, huboVentas: false, utilidad: 0, deuda: 2500 });
    expect(plan.apartados).toEqual([]);
    expect(plan.totalApartado).toBe(0);
    expect(plan.deuda).toBe(2500);
  });

  it('un dia en perdida lo absorben los dos, mitad y mitad', () => {
    const plan = planCaja({ ...base, utilidad: -5000 });
    expect(plan.apartados).toEqual([]);
    expect(plan.fran).toBe(-2500);
    expect(plan.primo).toBe(-2500);
  });

  it('una tasa en cero no genera linea de apartado', () => {
    const plan = planCaja({
      utilidad: 70000,
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
  const entrada = { fecha: FECHA, ts: `${FECHA}T22:00:00-07:00`, device: 'dev1' };
  const plan = planCaja({
    utilidad: 70000,
    deuda: 0,
    tasas: TASAS_INICIALES,
    huboVentas: true,
  });

  it('aparta gasolina, gas y la mitad de cada socio', () => {
    const movs = movimientosDeCierre({ ...entrada, plan });
    expect(movs.map((m) => m.sobre)).toEqual(['gasolina', 'gas', 'fran', 'primo']);
    expect(movs.every((m) => m.tipo === 'apartado')).toBe(true);
    expect(estadoCaja(movs).hay).toBe(32000 + 70000);
  });

  it('los ids salen de la fecha, asi que cerrar dos veces no aparta el doble', () => {
    const unaVez = agregarMovimientos([], movimientosDeCierre({ ...entrada, plan }));
    const dosVeces = agregarMovimientos(unaVez, movimientosDeCierre({ ...entrada, plan }));
    expect(dosVeces).toHaveLength(unaVez.length);
    expect(estadoCaja(dosVeces)).toEqual(estadoCaja(unaVez));
  });

  /**
   * Lo que faltaba cuando Fran no tenia sobre: su mitad del mal dia se evaporaba y terminaba
   * absorbiendo la perdida completa el dia que volvia a haber utilidad.
   */
  it('un dia en perdida le baja el acumulado a LOS DOS, no solo a Primo', () => {
    const malo = planCaja({
      utilidad: -5000,
      deuda: 0,
      tasas: TASAS_INICIALES,
      huboVentas: true,
    });
    const movs = movimientosDeCierre({ ...entrada, plan: malo });
    expect(saldoDe(movs, 'fran').hay).toBe(-2500);
    expect(saldoDe(movs, 'primo').hay).toBe(-2500);
  });

  it('sin mitad que repartir no escribe lineas de cero', () => {
    const cero = planCaja({
      utilidad: 0,
      deuda: 0,
      tasas: TASAS_INICIALES,
      huboVentas: false,
    });
    const movs = movimientosDeCierre({ ...entrada, plan: cero });
    expect(movs).toEqual([]);
  });
});

// ---------- cobrar lo acumulado ----------

describe('movimientoDeCobro', () => {
  const base = { id: 'c1', ts: 'x', fecha: FECHA, device: 'd' };

  it('cobrar lo tuyo es un pago, no un prestamo: no deja deuda', () => {
    const cobro = movimientoDeCobro({ ...base, sobre: 'fran', centavos: 6050 });
    expect(cobro?.tipo).toBe('pago');
    expect(cobro?.centavos).toBe(-6050);
    const acumulado = mov('apartado', 'fran', 6050);
    expect(estadoCaja([acumulado, cobro as MovimientoCaja]).deuda).toBe(0);
    expect(saldoDe([acumulado, cobro as MovimientoCaja], 'fran').hay).toBe(0);
  });

  it('con el sobre vacio o en negativo no escribe nada', () => {
    expect(movimientoDeCobro({ ...base, sobre: 'fran', centavos: 0 })).toBeNull();
    expect(movimientoDeCobro({ ...base, sobre: 'fran', centavos: -2500 })).toBeNull();
  });
});

// ---------- la semana completa, dia por dia ----------

/**
 * El caso que obligo a darle sobre a Fran: comprar un dia y vender al siguiente. Repartido bien
 * son 60.50 para cada quien; sin sobre para Fran le tocaban 137.50 a Primo y 60.50 a el.
 */
describe('comprar un dia y vender al otro', () => {
  const tasas = TASAS_INICIALES;

  it('cierra parejo aunque el gasto y la venta caigan en dias distintos', () => {
    // Lunes: se saca el te del fondo y no se vende nada.
    const lunes = planCaja({
      utilidad: calcularReparto(0, [{ id: 'g', concepto: 'Te', centavos: 15400 }]).utilidad,
      deuda: 0,
      tasas,
      huboVentas: false,
    });
    const movsLunes = movimientosDeCierre({
      fecha: '2026-08-10',
      ts: '2026-08-10T22:00:00-07:00',
      device: 'd',
      plan: lunes,
    });

    // Martes: se venden los 360 sin gastos nuevos.
    const martes = planCaja({
      utilidad: calcularReparto(36000, []).utilidad,
      deuda: 15400,
      tasas,
      huboVentas: true,
    });
    const movsMartes = movimientosDeCierre({
      fecha: '2026-08-11',
      ts: '2026-08-11T22:00:00-07:00',
      device: 'd',
      plan: martes,
    });

    const todos = [...movsLunes, ...movsMartes];
    expect(importe(saldoDe(todos, 'fran').hay)).toBe('$60.50');
    expect(importe(saldoDe(todos, 'primo').hay)).toBe('$60.50');
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

  it('conserva la marca de abierto para que se siga pudiendo corregir tras recargar', () => {
    const editable = abierto('prestamo', 'fondo', -20000, 'Insumos');
    expect(validarMovimiento(JSON.parse(JSON.stringify(editable)))).toEqual(editable);
  });

  it('lo guardado antes de que existiera la marca queda sellado, no editable', () => {
    // El historico de produccion no trae el campo: instalar esta version no puede volverlo
    // editable, porque esos movimientos ya estan dentro de cortes cerrados.
    const leido = validarMovimiento(JSON.parse(JSON.stringify(bueno)));
    expect(leido).not.toHaveProperty('abierto');
    expect(borrarMovimiento([leido as MovimientoCaja], bueno.id)).toBeNull();
  });

  it('ante una marca dudosa prefiere sellar', () => {
    expect(validarMovimiento({ ...bueno, abierto: 'si' })).not.toHaveProperty('abierto');
    expect(validarMovimiento({ ...bueno, abierto: 1 })).not.toHaveProperty('abierto');
    expect(validarMovimiento({ ...bueno, abierto: false })).not.toHaveProperty('abierto');
  });
});

// ---------- los gastos salen solos de la caja ----------

describe('origenDelGasto', () => {
  it('un gasto que cabe en el fondo sale entero de ahi', () => {
    expect(origenDelGasto(estadoCaja([]), 15400)).toEqual([{ sobre: 'fondo', centavos: 15400 }]);
  });

  it('si el fondo no alcanza, el resto sale de lo apartado para gasolina', () => {
    // Fondo con 46 (ya se habian sacado 154) y gasolina con 135: un gasto de 100 toma de los dos.
    const estado = estadoCaja([
      mov('prestamo', 'fondo', -15400),
      mov('apartado', 'gasolina', 13500),
    ]);
    expect(origenDelGasto(estado, 10000)).toEqual([
      { sobre: 'fondo', centavos: 4600 },
      { sobre: 'gasolina', centavos: 5400 },
    ]);
  });

  it('nunca saca de un sobre mas de lo que tiene', () => {
    const estado = estadoCaja([mov('prestamo', 'fondo', -20000)]);
    expect(origenDelGasto(estado, 5000)).toEqual([]);
  });

  it('con la caja vacia no registra nada: ese dinero no salio de la caja', () => {
    const estado = estadoCaja([
      mov('prestamo', 'fondo', -20000),
      mov('apartado', 'gasolina', 1000),
    ]);
    // Solo hay 10 en gasolina para un gasto de 154: se toman los 10 y el resto no se inventa.
    expect(origenDelGasto(estado, 15400)).toEqual([{ sobre: 'gasolina', centavos: 1000 }]);
  });

  it('el cambio no paga gastos: es para dar cambio, no para comprar', () => {
    const origen = origenDelGasto(estadoCaja([]), 40000);
    expect(origen.some((o) => o.sobre === 'cambio')).toBe(false);
  });
});

describe('movimientosDeGasto', () => {
  const base = { gastoId: 'g1', concepto: 'Te', ts: 'x', fecha: FECHA, device: 'd' };

  it('el te de Fran sale del fondo y deja su deuda', () => {
    const origen = origenDelGasto(estadoCaja([]), 15400);
    const movs = movimientosDeGasto({ ...base, origen });
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ sobre: 'fondo', centavos: -15400, tipo: 'prestamo' });
    const estado = estadoCaja(movs);
    expect(estado.deuda).toBe(15400);
    expect(saldoDe(movs, 'fondo').hay).toBe(4600);
  });

  it('nacen sellados: se corrigen borrando el gasto, no a mano', () => {
    const movs = movimientosDeGasto({ ...base, origen: origenDelGasto(estadoCaja([]), 15400) });
    expect(movs[0]).not.toHaveProperty('abierto');
    expect(borrarMovimiento(movs, movs[0]?.id ?? '')).toBeNull();
  });

  it('capturar el mismo gasto dos veces no descuenta el doble', () => {
    const origen = origenDelGasto(estadoCaja([]), 15400);
    const unaVez = agregarMovimientos([], movimientosDeGasto({ ...base, origen }));
    const dosVeces = agregarMovimientos(unaVez, movimientosDeGasto({ ...base, origen }));
    expect(dosVeces).toHaveLength(unaVez.length);
  });
});

describe('sinMovimientosDeGasto', () => {
  it('borrar el gasto devuelve el efectivo al fondo', () => {
    const movs = movimientosDeGasto({
      gastoId: 'g1',
      concepto: 'Te',
      ts: 'x',
      fecha: FECHA,
      device: 'd',
      origen: origenDelGasto(estadoCaja([]), 15400),
    });
    expect(estadoCaja(movs).deuda).toBe(15400);
    expect(estadoCaja(sinMovimientosDeGasto(movs, 'g1')).deuda).toBe(0);
  });

  it('se lleva las dos partes cuando el gasto salio de dos sobres', () => {
    const previos = [mov('prestamo', 'fondo', -15400), mov('apartado', 'gasolina', 13500)];
    const delGasto = movimientosDeGasto({
      gastoId: 'g1',
      concepto: 'Insumos',
      ts: 'x',
      fecha: FECHA,
      device: 'd',
      origen: origenDelGasto(estadoCaja(previos), 10000),
    });
    expect(delGasto).toHaveLength(2);
    const todos = [...previos, ...delGasto];
    expect(sinMovimientosDeGasto(todos, 'g1')).toEqual(previos);
  });

  it('no toca los movimientos de otros gastos ni los capturados a mano', () => {
    const aMano = abierto('prestamo', 'fondo', -1000);
    const otro = movimientosDeGasto({
      gastoId: 'g2',
      concepto: 'Otro',
      ts: 'x',
      fecha: FECHA,
      device: 'd',
      origen: [{ sobre: 'fondo', centavos: 500 }],
    });
    const todos = [aMano, ...otro];
    expect(sinMovimientosDeGasto(todos, 'g1')).toEqual(todos);
  });
});

// ---------- el cierre del domingo ----------

describe('planSemana', () => {
  it('paga lo que hay en gasolina, gas y sueldo, y deja el fondo en paz', () => {
    const plan = planSemana(
      estadoCaja([
        mov('apartado', 'gasolina', 13500),
        mov('apartado', 'gas', 12000),
        mov('apartado', 'primo', 84000),
      ])
    );
    expect(plan.pagos).toEqual([
      { sobre: 'gasolina', centavos: 13500 },
      { sobre: 'gas', centavos: 12000 },
      { sobre: 'primo', centavos: 84000 },
    ]);
    expect(plan.total).toBe(109500);
    expect(plan.pagos.some((p) => p.sobre === 'fondo' || p.sobre === 'cambio')).toBe(false);
  });

  it('si entre semana se presto de la gasolina, solo alcanza para lo que quedo', () => {
    // Se apartaron 135 y se tomaron 18 para las botellas: el domingo hay 117 para cargar.
    const estado = estadoCaja([
      mov('apartado', 'gasolina', 13500),
      mov('prestamo', 'gasolina', -1800),
    ]);
    const plan = planSemana(estado);
    expect(plan.pagos).toEqual([{ sobre: 'gasolina', centavos: 11700 }]);
    expect(plan.deuda).toBe(1800);
  });

  it('un sobre vacio o en negativo no genera pago: no se inventa dinero que no esta', () => {
    const plan = planSemana(estadoCaja([mov('prestamo', 'gasolina', -1800)]));
    expect(plan.pagos).toEqual([]);
    expect(plan.total).toBe(0);
  });
});

describe('movimientosDeSemana', () => {
  const entrada = { fecha: '2026-08-09', ts: '2026-08-09T19:00:00-07:00', device: 'd' };

  it('vacia los sobres pagados y no deja deuda por lo que si se aparto', () => {
    const antes = [mov('apartado', 'gasolina', 13500), mov('apartado', 'primo', 84000)];
    const plan = planSemana(estadoCaja(antes));
    const despues = estadoCaja([...antes, ...movimientosDeSemana({ ...entrada, plan })]);
    for (const sobre of ['gasolina', 'primo'] as const) {
      const saldo = despues.sobres.find((s) => s.sobre === sobre);
      expect(saldo?.hay).toBe(0);
      expect(saldo?.deuda).toBe(0);
    }
  });

  it('lo prestado sigue debiendose despues de cerrar la semana', () => {
    const antes = [mov('apartado', 'gasolina', 13500), mov('prestamo', 'gasolina', -1800)];
    const plan = planSemana(estadoCaja(antes));
    const despues = estadoCaja([...antes, ...movimientosDeSemana({ ...entrada, plan })]);
    expect(despues.deuda).toBe(1800);
  });

  it('cerrar dos veces el mismo domingo no paga doble', () => {
    const antes = [mov('apartado', 'gasolina', 13500)];
    const plan = planSemana(estadoCaja(antes));
    const unaVez = agregarMovimientos(antes, movimientosDeSemana({ ...entrada, plan }));
    const dosVeces = agregarMovimientos(unaVez, movimientosDeSemana({ ...entrada, plan }));
    expect(dosVeces).toHaveLength(unaVez.length);
  });

  it('los pagos nacen sellados: un pago hecho no se edita', () => {
    const plan = planSemana(estadoCaja([mov('apartado', 'gas', 12000)]));
    const generados = movimientosDeSemana({ ...entrada, plan });
    expect(generados[0]).not.toHaveProperty('abierto');
  });
});

// ---------- arqueo ----------

describe('arquear', () => {
  it('dice cuanto falta contra lo que la caja cree tener', () => {
    const estado = estadoCaja([]);
    expect(arquear(estado, 31500)).toEqual({
      contado: 31500,
      calculado: 32000,
      diferencia: -500,
    });
  });

  it('cero de diferencia cuando cuadra', () => {
    expect(arquear(estadoCaja([]), 32000).diferencia).toBe(0);
  });
});

describe('movimientoDeArqueo', () => {
  const base = { id: 'a1', ts: 'x', fecha: '2026-08-08', device: 'd', sobre: 'fondo' as Sobre };

  it('un faltante queda como deuda a la caja', () => {
    const ajuste = movimientoDeArqueo({ ...base, diferencia: -1700 });
    expect(ajuste?.tipo).toBe('prestamo');
    expect(estadoCaja([ajuste as MovimientoCaja]).deuda).toBe(1700);
  });

  it('un sobrante cuenta como dinero devuelto', () => {
    const ajuste = movimientoDeArqueo({ ...base, diferencia: 1700 });
    expect(ajuste?.tipo).toBe('reposicion');
    expect(estadoCaja([ajuste as MovimientoCaja]).deuda).toBe(-1700);
  });

  it('sin diferencia no escribe nada', () => {
    expect(movimientoDeArqueo({ ...base, diferencia: 0 })).toBeNull();
  });

  it('nace sellado: es la foto de un conteo que ya se hizo', () => {
    expect(movimientoDeArqueo({ ...base, diferencia: -1700 })).not.toHaveProperty('abierto');
  });
});

// ---------- el efectivo que se cuenta contra el bulto ----------

describe('cajaParaEsperado', () => {
  const HOY = '2026-08-08';

  function conFecha(m: MovimientoCaja, fecha: string): MovimientoCaja {
    return { ...m, fecha, ts: `${fecha}T12:00:00-07:00` };
  }

  it('el escenario de las botellas PET: 200 del fondo no se restan dos veces', () => {
    // Fondo 200 + cambio 120 al abrir. Hoy se sacan 200 del fondo para unas botellas de 218,
    // 18 salen del bulto y se venden 600. En la mano quedan 320 - 200 + 600 - 18 = 702.
    const prestamo = conFecha(mov('prestamo', 'fondo', -20000, 'botellas PET'), HOY);
    const reparto = calcularReparto(60000, [
      { id: 'g1', concepto: 'Botellas PET', centavos: 21800 },
    ]);
    const real = 32000 - 20000 + 60000 - 1800;

    expect(cajaParaEsperado([prestamo], HOY)).toBe(32000);
    expect(efectivoEsperado(reparto, cajaParaEsperado([prestamo], HOY))).toBe(real);
    // Con el saldo de ahora daba 200 de menos: ese era el bug.
    expect(efectivoEsperado(reparto, estadoCaja([prestamo]).hay)).toBe(real - 20000);
  });

  it('un prestamo de ayer si baja el saldo con el que se abre hoy', () => {
    const ayer = conFecha(mov('prestamo', 'fondo', -20000), '2026-08-07');
    expect(cajaParaEsperado([ayer], HOY)).toBe(12000);
  });

  it('pagarle a Primo hoy si se resta: ese efectivo salio sin gasto que lo respalde', () => {
    const apartado = conFecha(mov('apartado', 'primo', 84000), '2026-08-07');
    const pago = conFecha(mov('pago', 'primo', -84000), HOY);
    // Al abrir habia 320 + 840 = 1160; los 840 ya se fueron, quedan 320 contra los que contar.
    expect(cajaParaEsperado([apartado, pago], HOY)).toBe(32000);
  });

  it('pagar gasolina hoy NO se resta aparte: ese dia tambien se captura como gasto', () => {
    const apartado = conFecha(mov('apartado', 'gasolina', 13500), '2026-08-07');
    const pago = conFecha(mov('pago', 'gasolina', -13500), HOY);
    expect(cajaParaEsperado([apartado, pago], HOY)).toBe(32000 + 13500);
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
