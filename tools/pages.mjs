// Genera páginas HTML estáticas para que Google indexe el catálogo y WhatsApp
// muestre la foto al compartir un link:
//   site/p/<nombre>-<hash>.html   una por producto
//   site/marca/<slug>.html        una por marca
//   site/tipo/<slug>.html         una por categoría
//   site/sitemap.xml              con todas las anteriores
// Se corre solo al final de build.mjs, o a mano: node tools/pages.mjs [site]
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://catalogo.supplyba.store';

const slug = (s) =>
  String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' y ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Debe coincidir con productPath() de site/index.html.
export const productPath = (p) => `p/${slug(p.name).slice(0, 70).replace(/-+$/, '')}-${p.id.split('-').pop()}`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtArs = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v);
const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

function expandTalles(r) {
  if (!r) return null;
  const n = r.match(/^(\d+)\s*-\s*(\d+)$/);
  if (n) { const a = +n[1], b = +n[2]; if (a >= b || b - a > 40) return null; return Array.from({ length: b - a + 1 }, (_, i) => String(a + i)); }
  const l = r.match(/^(XS|S|M|L|XL|2XL|3XL|4XL)\s*-\s*(XS|S|M|L|XL|2XL|3XL|4XL)$/);
  if (l) { const a = SIZES.indexOf(l[1]), b = SIZES.indexOf(l[2]); return a < 0 || b < 0 || a > b ? null : SIZES.slice(a, b + 1); }
  return null;
}

const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.27-.2-.57-.35zM12 21.8h0a9.8 9.8 0 0 1-5-1.37l-.36-.21-3.72.98 1-3.63-.24-.37A9.8 9.8 0 1 1 12 21.8zm8.4-18.2A11.8 11.8 0 0 0 1.68 17.8L0 24l6.3-1.65A11.8 11.8 0 0 0 12 23.8h0A11.8 11.8 0 0 0 20.4 3.6z"/></svg>';

let CLUB_ON = false; // config.club.publicado: muestra el Club en menú y sitemap

function shell({ title, desc, canonical, image, imageAlt, jsonld, body, depth = 1, type = 'website' }) {
  const up = '../'.repeat(depth);
  return `<!doctype html>
<html lang="es-AR" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#ededed">
<link rel="canonical" href="${canonical}">
<link rel="icon" type="image/png" sizes="32x32" href="${up}brand/favicon-32.png">
<link rel="apple-touch-icon" href="${up}brand/apple-touch-icon.png">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="Supply BA">
<meta property="og:locale" content="es_AR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${image}">
<meta property="og:image:alt" content="${esc(imageAlt || title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${image}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<script src="${up}tema.js"></script>
<link rel="stylesheet" href="${up}estatico.css">
<script src="${up}medicion.js" defer></script>
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body>
<header class="top"><div class="bar">
  <a class="logo" href="${up}" aria-label="Supply BA, ir al catálogo"><img class="iso" src="${up}brand/isotipo.webp" width="44" height="44" alt="Supply BA"></a>
  <nav class="nav" aria-label="Secciones"><a href="${up}#ver=todo">Catálogo</a><a href="${up}encargos.html">Encargos / Envíos</a>${CLUB_ON ? `<a href="${up}club">Club</a>` : ''}<a href="https://supplyba.com.ar?utm_source=catalogo&amp;utm_medium=estatica&amp;utm_campaign=ver_stock" target="_blank" rel="noopener">Stock</a></nav>
</div></header>
<main>
${body}
</main>
<footer>
  <div class="fwm" aria-hidden="true"><img class="wm-d" src="${up}brand/wordmark-cromo.webp" alt="" width="1100" height="634" loading="lazy" decoding="async"><img class="wm-l" src="${up}brand/wordmark-negro.webp" alt="" width="1100" height="634" loading="lazy" decoding="async"></div>
  <span>✦ Supply BA · Lomas de Zamora, Buenos Aires · Encargue y stock · Envíos a todo el país</span>
  <span><a href="${up}">Catálogo</a> · <a href="${up}encargos.html">Cómo funciona el encargue</a> · <a href="https://instagram.com/supply_ba_" target="_blank" rel="noopener">Instagram</a></span>
</footer>
</body>
</html>
`;
}

// precio de contado (config.precios.contado.porcentaje; 0 = apagado). Misma cuenta que index.html.
function cashHtml(price, cfg, cls) {
  const c = Object.assign({ porcentaje: 0, texto: 'con transferencia o efectivo' }, cfg.precios?.contado || {});
  const pct = Math.min(50, Math.max(0, Number(c.porcentaje) || 0));
  if (!pct || !cfg.mostrarPrecios || !(price > 0)) return '';
  return `<span class="${cls}"><b>${fmtArs(Math.floor((price * (1 - pct / 100)) / 100) * 100)}</b> ${esc(c.texto)}</span>`;
}

// tabla de talles estática (data/talles.json), con los talles del producto resaltados
function sizeTable(p, T) {
  const key = T?.tipos?.[p.tipo]; const t = key && T.tablas[key];
  if (!t) return '';
  const mine = new Set(expandTalles(p.talles) || []);
  const nota = T.marcas?.[p.brandSlug];
  return `<details class="guia"><summary>Guía de talles</summary>
${nota ? `<p class="snota"><b>${esc(p.brand)}:</b> ${esc(nota)}</p>` : ''}<div class="sscroll"><table><caption>${esc(t.titulo)}${mine.size ? ' · <span>resaltados los talles de este producto</span>' : ''}</caption><thead><tr>${t.columnas.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${t.filas.map((f) => `<tr${mine.has(f[0]) ? ' class="on"' : ''}>${f.map((c, i) => (i ? `<td>${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`)).join('')}</tr>`).join('')}</tbody></table></div>
${t.medir ? `<p class="smedir"><b>Cómo medir:</b> ${esc(t.medir)}</p>` : ''}<p class="smedir">Las medidas son de referencia; algunas prendas tienen calce oversize por diseño.</p></details>`;
}

function card(p, up, cfg) {
  const price = cfg.mostrarPrecios && p.price ? `<span class="pr">${fmtArs(p.price)}</span>` : '';
  return `<a class="card" href="${up}${productPath(p)}"><span class="ph"><img loading="lazy" decoding="async" src="${up}${esc(p.thumb)}" alt="${esc(p.name)}"></span><span class="nm">${esc(p.name)}</span><span class="bm">${esc(p.brand)}${price ? ' · ' + price : ''}</span>${cashHtml(p.price, cfg, 'cash')}</a>`;
}

const breadcrumbLd = (items) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })),
});

function productPage(p, data, cfg) {
  const url = `${SITE}/${productPath(p)}`;
  const brandUrl = `${SITE}/marca/${p.brandSlug}`;
  const tipoSlug = slug(p.tipo || 'otros');
  const tipoUrl = `${SITE}/tipo/${tipoSlug}`;
  const showPrice = cfg.mostrarPrecios && p.price > 0;
  const talles = expandTalles(p.talles);
  const waText = (cfg.mensaje || 'Hola Supply BA! Quiero pedir: {producto}')
    .replace('{producto}', p.name).replace('{codigo}', p.num != null ? `#${p.num}` : p.id).replace('{marca}', p.brand) + `\n${url}`;
  const wa = `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(waText)}`;
  const kind = p.tipo && p.tipo !== 'Otros' ? p.tipo : '';
  const title = `${p.name} | ${p.brand} por encargue — Supply BA`;
  const desc = `${p.name} de ${p.brand}${kind ? ` (${kind.toLowerCase()})` : ''} por encargue en Argentina${showPrice ? ` a ${fmtArs(p.price)}` : ''}. Seña del 50%, llegada en 25 a 35 días y envíos a todo el país. Pedilo por WhatsApp.`;

  const rel = [];
  const seen = new Set([p.id]);
  for (const q of data.products) { if (rel.length >= 8) break; if (!seen.has(q.id) && q.brandSlug === p.brandSlug && q.tipo === p.tipo) { rel.push(q); seen.add(q.id); } }
  for (const q of data.products) { if (rel.length >= 8) break; if (!seen.has(q.id) && q.brandSlug === p.brandSlug) { rel.push(q); seen.add(q.id); } }

  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.id,
    image: [`${SITE}/${p.img}`], brand: { '@type': 'Brand', name: p.brand }, category: p.tipo,
    description: desc, url,
  };
  if (showPrice) ld.offers = {
    '@type': 'Offer', url, priceCurrency: 'ARS', price: p.price, availability: 'https://schema.org/PreOrder',
    seller: { '@type': 'Organization', name: 'Supply BA' },
  };

  const body = `
<nav class="crumbs" aria-label="Ruta"><a href="../">Inicio</a><span>/</span><a href="../marca/${p.brandSlug}">${esc(p.brand)}</a>${kind ? `<span>/</span><a href="../tipo/${tipoSlug}">${esc(kind)}</a>` : ''}</nav>
<article class="prod">
  <div class="pic"><img src="../${esc(p.img)}" alt="${esc(p.name)}" fetchpriority="high" decoding="async"></div>
  <div class="info">
    <a class="eyebrow" href="../marca/${p.brandSlug}">${esc(p.brand)}</a>
    <h1>${esc(p.name)}</h1>
    <p class="sub">${[kind, p.num != null ? `Código #${p.num}` : ''].filter(Boolean).join(' · ')}</p>
    <div class="pricerow">${showPrice ? `<span class="price">${fmtArs(p.price)}</span>` : '<span class="price apc">Consultar precio</span>'}<span class="tag">Por encargue</span></div>
    ${cashHtml(showPrice ? p.price : 0, cfg, 'dcash')}
    ${talles ? `<div class="talles" aria-label="Talles disponibles">${talles.map((t) => `<span>${t}</span>`).join('')}</div>` : p.talles ? `<p class="sub">Talles: ${/proveedor/i.test(p.talles) ? 'a confirmar por chat' : esc(p.talles)}</p>` : ''}
    ${sizeTable(p, cfg._talles)}
    <ul class="serv"><li>Seña del 50% y el resto al recibir</li><li>Llegada en 25 a 35 días</li><li>Seguimiento personalizado</li><li>Envíos a todo el país</li></ul>
    <div class="cta">
      <a class="btn main" href="${esc(wa)}" target="_blank" rel="noopener">${WA_ICON}Pedir por WhatsApp</a>
      <a class="btn" href="../#p=${encodeURIComponent(p.id)}&amp;agregar=1">Agregar al pedido</a>
    </div>
    <p class="hint">¿Dudas con el talle? Escribinos con tu talle habitual, altura y peso. <a href="../encargos.html">Cómo funciona el encargue</a></p>
  </div>
</article>
${rel.length ? `<h2 class="sec">✦ Más de ${esc(p.brand)}</h2><div class="grid">${rel.map((q) => card(q, '../', cfg)).join('')}</div>` : ''}
<a class="btn verall" href="../marca/${p.brandSlug}">Ver todo ${esc(p.brand)} →</a>
<div class="mbar"><a class="btn" href="../#p=${encodeURIComponent(p.id)}&amp;agregar=1">Agregar al pedido</a><a class="btn main" href="${esc(wa)}" target="_blank" rel="noopener">${WA_ICON}Pedir</a></div>`;

  return shell({
    title, desc, canonical: url, image: `${SITE}/${p.img}`, imageAlt: p.name, type: 'product', body,
    jsonld: [ld, breadcrumbLd([['Inicio', `${SITE}/`], [p.brand, brandUrl], ...(kind ? [[kind, tipoUrl]] : []), [p.name, url]])],
  });
}

function listPage({ kind, name, slugName, items, data, cfg, intro, other }) {
  const url = `${SITE}/${kind}/${slugName}`;
  const title = kind === 'marca' ? `${name} en Argentina por encargue — Supply BA` : `${name} de marcas hype por encargue — Supply BA`;
  const desc = kind === 'marca'
    ? `${items.length} productos de ${name} por encargue en Argentina: ropa, zapatillas y accesorios. Seña del 50%, llegada en 25 a 35 días y envíos a todo el país.`
    : `${items.length} ${name.toLowerCase()} de ${[...new Set(items.map((p) => p.brand))].slice(0, 5).join(', ')} y más, por encargue en Argentina. Pedí por WhatsApp.`;
  const hash = kind === 'marca' ? `marca=${slugName}` : `tipo=${slugName}`;
  const body = `
<nav class="crumbs" aria-label="Ruta"><a href="../">Inicio</a><span>/</span><span>${esc(name)}</span></nav>
<div class="lhead">
  ${kind === 'marca' ? `<img class="blogo" src="../logos/${slugName}.webp" alt="" width="72" height="72">` : ''}
  <div><h1>${esc(name)}</h1><p class="sub">${items.length.toLocaleString('es-AR')} productos por encargue · ${esc(intro)}</p></div>
  <a class="btn main" href="../#${hash}">Filtrar y armar pedido →</a>
</div>
${other.length ? `<nav class="chips" aria-label="${kind === 'marca' ? 'Categorías' : 'Marcas'}">${other.map(([n, href, c]) => `<a href="${href}">${esc(n)} <small>${c}</small></a>`).join('')}</nav>` : ''}
<div class="grid">${items.map((p) => card(p, '../', cfg)).join('')}</div>`;
  return shell({
    title, desc, canonical: url, image: `${SITE}/${items[0]?.img || 'brand/og.png'}`, body,
    jsonld: [
      breadcrumbLd([['Inicio', `${SITE}/`], [name, url]]),
      { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url, numberOfItems: items.length },
    ],
  });
}

export async function buildPages(out = 'site') {
  const data = JSON.parse(await fs.readFile(path.join(out, 'data', 'products.json'), 'utf8'));
  const cfg = JSON.parse(await fs.readFile(path.join(out, 'config.json'), 'utf8'));
  CLUB_ON = !!(cfg.club?.activo && cfg.club?.publicado);
  try { cfg._talles = JSON.parse(await fs.readFile(path.join(out, 'data', 'talles.json'), 'utf8')); } catch { cfg._talles = null; }
  const ensure = async (d) => { await fs.rm(path.join(out, d), { recursive: true, force: true }); await fs.mkdir(path.join(out, d), { recursive: true }); };
  await ensure('p'); await ensure('marca'); await ensure('tipo');

  const urls = [];
  const byNewest = (a, b) => (b.num ?? 0) - (a.num ?? 0);
  for (const p of data.products) {
    await fs.writeFile(path.join(out, productPath(p) + '.html'), productPage(p, data, cfg));
    urls.push([`${SITE}/${productPath(p)}`, '0.6']);
  }
  for (const b of data.brands) {
    const items = data.products.filter((p) => p.brandSlug === b.slug).sort(byNewest);
    if (!items.length) continue;
    const other = data.tipos
      .map((t) => [t.name, `../#marca=${b.slug}&amp;tipo=${t.slug}`, items.filter((p) => p.tipo === t.name).length])
      .filter((x) => x[2]);
    await fs.writeFile(path.join(out, 'marca', b.slug + '.html'), listPage({ kind: 'marca', name: b.name, slugName: b.slug, items, data, cfg, intro: `${other.length} categorías`, other }));
    urls.push([`${SITE}/marca/${b.slug}`, '0.8']);
  }
  for (const t of data.tipos) {
    const items = data.products.filter((p) => p.tipo === t.name).sort(byNewest);
    if (!items.length) continue;
    const other = data.brands.map((b) => [b.name, `../#tipo=${t.slug}&amp;marca=${b.slug}`, items.filter((p) => p.brandSlug === b.slug).length]).filter((x) => x[2]);
    await fs.writeFile(path.join(out, 'tipo', t.slug + '.html'), listPage({ kind: 'tipo', name: t.name, slugName: t.slug, items, data, cfg, intro: `${other.length} marcas`, other }));
    urls.push([`${SITE}/tipo/${t.slug}`, '0.8']);
  }

  // links rastreables a marcas y categorías en el pie de la home
  const idx = path.join(out, 'index.html');
  const html = await fs.readFile(idx, 'utf8');
  const links = '<!--seo-links--><nav class="seol" aria-label="Marcas y categorías">' +
    `<div><b>Marcas</b>${data.brands.map((b) => `<a href="marca/${b.slug}">${esc(b.name)}</a>`).join('')}</div>` +
    `<div><b>Categorías</b>${data.tipos.map((t) => `<a href="tipo/${t.slug}">${esc(t.name)}</a>`).join('')}</div>` +
    '</nav><!--/seo-links-->';
  const next = html.replace(/<!--seo-links-->[\s\S]*?<!--\/seo-links-->/, links);
  if (next !== html) await fs.writeFile(idx, next);

  const today = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[[`${SITE}/`, '1.0'], [`${SITE}/encargos.html`, '0.6'], ...(CLUB_ON ? [[`${SITE}/club`, '0.7']] : []), ...urls].map(([u, pr]) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod><priority>${pr}</priority></url>`).join('\n')}
</urlset>
`;
  await fs.writeFile(path.join(out, 'sitemap.xml'), xml);
  return { products: data.products.length, brands: data.brands.length, tipos: data.tipos.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const r = await buildPages(path.resolve(process.argv[2] || 'site'));
  console.log(`Páginas: ${r.products} productos, ${r.brands} marcas, ${r.tipos} categorías + sitemap.xml`);
}
