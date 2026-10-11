import { describe, expect, it } from 'vitest';
import { estadoRegistrar } from './vender';

describe('estadoRegistrar', () => {
  it('sin ningun conteo no se puede registrar', () => {
    expect(estadoRegistrar({ botella: null, litro: null })).toEqual({ habilitado: false });
  });

  it('un 0 tecleado si cuenta: es haber vendido todo', () => {
    expect(estadoRegistrar({ botella: 0, litro: null })).toEqual({ habilitado: true });
  });

  it('basta con contar solo los litros', () => {
    expect(estadoRegistrar({ botella: null, litro: 3 })).toEqual({ habilitado: true });
  });
});
