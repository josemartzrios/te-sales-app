// Ladrillos del DOM que comparten las pantallas. Viven aparte de ui.ts para que cualquier modulo
// de pantalla (vender.ts) los use sin importar ui.ts y sin ciclo. Nada aqui toca `document` al
// cargar: solo al llamarse, asi las pruebas en node pueden importar los modulos que los usan.
//
// Toda la escritura de texto pasa por textContent: nunca innerHTML con datos del usuario.

type Opciones = {
  clase?: string;
  texto?: string;
  attrs?: Record<string, string>;
  onClick?: () => void;
};

export function el<K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  opciones: Opciones = {},
  hijos: readonly (Node | null)[] = []
): HTMLElementTagNameMap[K] {
  const nodo = document.createElement(etiqueta);
  if (opciones.clase !== undefined) nodo.className = opciones.clase;
  if (opciones.texto !== undefined) nodo.textContent = opciones.texto;
  if (opciones.attrs !== undefined) {
    for (const [nombre, valor] of Object.entries(opciones.attrs)) nodo.setAttribute(nombre, valor);
  }
  if (opciones.onClick !== undefined) nodo.addEventListener('click', opciones.onClick);
  for (const hijo of hijos) if (hijo !== null) nodo.appendChild(hijo);
  return nodo;
}

export function boton(texto: string, clase: string, onClick: () => void): HTMLButtonElement {
  return el('button', { clase, texto, attrs: { type: 'button' }, onClick });
}

export function campo(etiqueta: string, control: HTMLElement): HTMLElement {
  return el('label', {}, [el('span', { clase: 'detalle', texto: etiqueta }), control]);
}

export function selector(valores: readonly string[], valorInicial: string): HTMLSelectElement {
  const s = el('select');
  for (const v of valores) {
    const opcion = el('option', { texto: v });
    opcion.value = v;
    s.appendChild(opcion);
  }
  s.value = valorInicial;
  return s;
}

export function entrada(
  tipo: string,
  valor: string,
  attrs: Record<string, string> = {}
): HTMLInputElement {
  const i = el('input', { attrs: { type: tipo, ...attrs } });
  i.value = valor;
  return i;
}

/** La hora de ahora en punto, HH:MM. Es el arranque bueno casi siempre; se teclea encima si no. */
export function horaEnPunto(ahora: Date): string {
  return `${String(ahora.getHours()).padStart(2, '0')}:00`;
}
