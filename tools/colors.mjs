#!/usr/bin/env node
// Color dominante por producto.
// Lee site/data/products.json, mira la miniatura de cada producto (webp) y
// escribe site/data/colors.json -> { "<id>": "#rrggbb" }. Solo calcula los que
// faltan, así se puede correr (o re-correr) las veces que quieras.
//
// Usado por la sección "Armá tu outfit" para sugerir prendas que combinan.
//
// Uso:  node tools/colors.mjs [site]

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const CONCURRENCY = 8;

const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

// Color representativo de una imagen: promedio ponderado por saturación/luminancia
// de los píxeles "vivos" (ignora fondos blancos/negros/grises y transparencia).
export async function dominantColor(file) {
  const { data, info } = await sharp(file, { failOn: 'none' })
    .rotate()
    .resize(28, 28, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  let r = 0, g = 0, b = 0, w = 0, ar = 0, ag = 0, ab = 0, an = 0;
  for (let i = 0; i < data.length; i += ch) {
    const a = ch === 4 ? data[i + 3] : 255;
    if (a < 24) continue;
    const R = data[i], G = data[i + 1], B = data[i + 2];
    ar += R; ag += G; ab += B; an++;
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    const sat = mx ? (mx - mn) / mx : 0;
    const lum = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
    if (sat > 0.16 && lum > 0.12 && lum < 0.92) {
      const k = sat * (1 - Math.abs(lum - 0.5));
      r += R * k; g += G * k; b += B * k; w += k;
    }
  }
  let col;
  if (w > 0.5) col = [r / w, g / w, b / w];
  else if (an) col = [ar / an, ag / an, ab / an];
  else return null;
  return '#' + toHex(col[0]) + toHex(col[1]) + toHex(col[2]);
}

export async function computeColors(site = 'site') {
  const dataFile = path.join(site, 'data', 'products.json');
  const colorFile = path.join(site, 'data', 'colors.json');
  const data = JSON.parse(await fs.readFile(dataFile, 'utf8'));
  let existing = {};
  try { existing = JSON.parse(await fs.readFile(colorFile, 'utf8')); } catch {}

  const out = { ...existing };
  const todo = (data.products || []).filter((p) => p && p.id && p.thumb && !out[p.id]);
  let done = 0, failed = 0;
  const queue = [...todo];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const p = queue.shift();
      try {
        const c = await dominantColor(path.join(site, p.thumb));
        if (c) out[p.id] = c;
        else failed++;
      } catch { failed++; }
      if (++done % 100 === 0) console.log(`  ${done}/${todo.length}`);
    }
  }));

  // limpia ids que ya no existen
  const ids = new Set((data.products || []).map((p) => p.id));
  for (const k of Object.keys(out)) if (!ids.has(k)) delete out[k];

  await fs.writeFile(colorFile, JSON.stringify(out, null, 0) + '\n');
  return { total: (data.products || []).length, computed: todo.length, failed, stored: Object.keys(out).length };
}

// Ejecuta como CLI (no cuando se importa desde build.mjs).
const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  computeColors(process.argv[2] || 'site')
    .then((s) => console.log(`Listo: ${s.stored}/${s.total} colores (${s.computed} nuevos, ${s.failed} fallidos).`))
    .catch((e) => { console.error(e); process.exit(1); });
}
