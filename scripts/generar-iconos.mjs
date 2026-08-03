// Genera los PNG del manifest sin dependencias: fondo verde acento y una "R" blanca.
// Se corre una sola vez (npm run iconos); los archivos quedan versionados en public/.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ACENTO = [0x0d, 0x7a, 0x5f];
const BLANCO = [0xff, 0xff, 0xff];

const GLIFO_R = [
  '1111110',
  '1100011',
  '1100011',
  '1100011',
  '1111110',
  '1101100',
  '1100110',
  '1100011',
  '1100011',
];

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = TABLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

function png(lado) {
  const pixeles = Buffer.alloc(lado * (lado * 3 + 1));
  const escala = Math.floor(lado / 12);
  const anchoGlifo = GLIFO_R[0].length * escala;
  const altoGlifo = GLIFO_R.length * escala;
  const x0 = Math.floor((lado - anchoGlifo) / 2);
  const y0 = Math.floor((lado - altoGlifo) / 2);

  for (let y = 0; y < lado; y++) {
    const fila = y * (lado * 3 + 1);
    pixeles[fila] = 0; // filtro none
    for (let x = 0; x < lado; x++) {
      const gx = Math.floor((x - x0) / escala);
      const gy = Math.floor((y - y0) / escala);
      const dentro = gy >= 0 && gy < GLIFO_R.length && gx >= 0 && gx < GLIFO_R[0].length;
      const color = dentro && GLIFO_R[gy][gx] === '1' ? BLANCO : ACENTO;
      const p = fila + 1 + x * 3;
      pixeles[p] = color[0];
      pixeles[p + 1] = color[1];
      pixeles[p + 2] = color[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 2; // truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(pixeles, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(resolve(raiz, 'public'), { recursive: true });
for (const lado of [192, 512]) {
  const destino = resolve(raiz, 'public', `icono-${lado}.png`);
  writeFileSync(destino, png(lado));
  console.log('escrito', destino);
}
