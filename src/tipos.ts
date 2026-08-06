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

/**
 * Botellas que pasan de una hielera a la otra para emparejar cargas: el que se esta quedando
 * sin nada recibe del que le sobra, y asi acaban juntos. Ni entran ni salen del dia; solo
 * cambian de mano, por eso el total cargado de la jornada no se mueve.
 *
 * Es un evento propio y no una correccion de las cargas a proposito: colapsarlo a "sumale 5
 * a uno y restale 5 al otro" perderia para siempre de quien era la botella que vendio el otro,
 * y ese es justo el dato que hace falta el dia que el reparto deje de ser mitad y mitad.
 */
export type TransferEvent = {
  id: string;
  type: 'transfer';
  ts: string;
  from: Vendedor;
  to: Vendedor;
  qty: number;
  device: string;
};

export type AppEvent = SaleEvent | VoidEvent | LoadEvent | ShiftEvent | TransferEvent;

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
