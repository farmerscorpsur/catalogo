#!/usr/bin/env node
// Colores por producto, para el filtro "Color" del catálogo.
// Sale del nombre del producto (ej. "Hat (Black & Camo)", "Hoodie Black Gray").
// Si el nombre no trae ningún color, el producto queda sin color (no se adivina
// por la foto: el fondo y los modelos la hacen poco confiable). Escribe `colores: ["Negro", ...]` en cada producto de
// site/data/products.json.
//
// Uso:  node tools/colores.mjs [site]

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// orden = cómo se muestran en el filtro
export const COLORES = [
  ['Negro', '#111111'], ['Blanco', '#f4f4f4'], ['Gris', '#8a8a8a'], ['Beige', '#d8c8a8'],
  ['Marrón', '#6b4a32'], ['Rojo', '#c62828'], ['Naranja', '#ef7d22'], ['Amarillo', '#f2d024'],
  ['Verde', '#2e7d4f'], ['Celeste', '#8cc8ee'], ['Azul', '#1f4fb0'], ['Violeta', '#7a4fb8'],
  ['Rosa', '#f08cb8'], ['Plateado', '#c0c4c8'], ['Dorado', '#c9a227'], ['Camuflado', '#6b7355'],
  ['Multicolor', 'conic-gradient(#c62828,#f2d024,#2e7d4f,#1f4fb0,#c62828)'],
];

// frases primero (se consumen antes de mirar palabras sueltas)
const FRASES = [
  [/\b(?:light|pale|baby|sky|ice|powder)\s+blue\b/g, 'Celeste'],
  [/\b(?:dark|navy)\s+blue\b/g, 'Azul'],
  [/\boff\s*white\b/g, 'Blanco'],
  [/\bmulti\s*colou?rs?\b/g, 'Multicolor'],
];
const PALABRAS = {
  black: 'Negro', white: 'Blanco', milk: 'Blanco', ivory: 'Blanco', sail: 'Blanco',
  gray: 'Gris', grey: 'Gris', slate: 'Gris', charcoal: 'Gris', smoke: 'Gris', cement: 'Gris',
  cream: 'Beige', beige: 'Beige', natural: 'Beige', sand: 'Beige', khaki: 'Beige', bone: 'Beige', stone: 'Beige',
  brown: 'Marrón', mocha: 'Marrón', chocolate: 'Marrón', tan: 'Marrón', coffee: 'Marrón',
  red: 'Rojo', burgundy: 'Rojo', maroon: 'Rojo', bred: 'Rojo', wine: 'Rojo',
  orange: 'Naranja', yellow: 'Amarillo',
  green: 'Verde', olive: 'Verde', mint: 'Verde', lime: 'Verde', sage: 'Verde', cactus: 'Verde', emerald: 'Verde',
  blue: 'Azul', navy: 'Azul', indigo: 'Azul', royal: 'Azul', cyan: 'Celeste', aqua: 'Celeste',
  purple: 'Violeta', violet: 'Violeta', lilac: 'Violeta', lavender: 'Violeta', grape: 'Violeta',
  pink: 'Rosa', magenta: 'Rosa', fuchsia: 'Rosa',
  silver: 'Plateado', metallic: 'Plateado', gold: 'Dorado',
  camo: 'Camuflado', camouflage: 'Camuflado', multicolor: 'Multicolor', multicolour: 'Multicolor', various: 'Multicolor',
};
const ORDEN = new Map(COLORES.map(([n], i) => [n, i]));

function desdeTexto(txt) {
  const out = new Set();
  let t = ' ' + txt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') + ' ';
  for (const [re, c] of FRASES) t = t.replace(re, () => { out.add(c); return ' '; });
  for (const w of t.split(/[^a-z]+/)) if (PALABRAS[w]) out.add(PALABRAS[w]);
  return out;
}

export function coloresDe(name) {
  const par = [...name.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]).join(' ');
  let set = par ? desdeTexto(par) : new Set();
  if (!set.size) set = desdeTexto(name);
  return [...set].sort((a, b) => ORDEN.get(a) - ORDEN.get(b));
}

export async function assignColores(site) {
  const f = path.join(site, 'data', 'products.json');
  const data = JSON.parse(await fs.readFile(f, 'utf8'));
  let sin = 0;
  for (const p of data.products) {
    const c = coloresDe(p.name);
    if (c.length) p.colores = c; else { delete p.colores; sin++; }
  }
  await fs.writeFile(f, JSON.stringify(data, null, 2) + '\n');
  return { total: data.products.length, sin };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const site = path.resolve(process.argv[2] || new URL('../site', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const r = await assignColores(site);
  console.log(`Colores: ${r.total - r.sin}/${r.total} productos (${r.sin} sin color).`);
}
