export type Vendedor = 'Fran' | 'Primo';
export type Canal = 'calle' | 'mayoreo';

export type SaleEvent = {
  id: string;
  type: 'sale';
  ts: string;
  point: string;
  channel: Canal;
  vendor: Vendedor;
  qty: number;
  device: string;
  retro?: true;
};

export type VoidEvent = {
  id: string;
  type: 'void';
  ts: string;
  refId: string;
  device: string;
};

/** Piezas que un vendedor mete a su hielera. Se acumulan por dia: varias recargas suman. */
export type LoadEvent = {
  id: string;
  type: 'load';
  ts: string;
  vendor: Vendedor;
  qty: number;
  device: string;
};

/**
 * Llegada de un vendedor a un lugar: "a las 17:03 Fran se paro en la Plazuela".
 * Solo marca el inicio. El turno se cierra solo cuando empieza el siguiente de ese vendedor,
 * porque el historico es inmutable: nada se edita despues de escrito.
 */
export type ShiftEvent = {
  id: string;
  type: 'shift';
  ts: string;
  point: string;
  vendor: Vendedor;
  device: string;
};

export type AppEvent = SaleEvent | VoidEvent | LoadEvent | ShiftEvent;

export type Settings = {
  points: string[];
  defaultVendor: Vendedor;
  deviceId: string;
};

export type ArchivoExport = {
  app: string;
  version: 1;
  exportedAt: string;
  device: string;
  events: AppEvent[];
};
