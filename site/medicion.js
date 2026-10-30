/* Medición: GA4 + Pixel de Meta, solo después de que la persona acepte.
   Los IDs van en config.json ("ga4": "G-XXXX", "metaPixelId": "123..."). Sin IDs no se carga nada. */
(() => {
  const KEY = 'supplyba_consent_v1';
  const queue = [];
  let on = false, ga = '', px = '';

  // nombres de evento del sitio → evento estándar de Meta
  const FB = { select_item: 'ViewContent', add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout', send_order_whatsapp: 'Lead', outfit_order: 'Lead', whatsapp: 'Contact', search: 'Search' };

  const send = (name, props) => {
    if (!on) { queue.push([name, props]); return; }
    if (ga && window.gtag) window.gtag('event', name, props || {});
    if (px && window.fbq) {
      if (FB[name]) window.fbq('track', FB[name], props || {});
      else window.fbq('trackCustom', name, props || {});
    }
  };
  window.sbMedir = send;

  const pageView = () => {
    if (!on) return;
    const path = location.pathname + location.hash;
    if (ga && window.gtag) window.gtag('event', 'page_view', { page_location: location.href, page_path: path, page_title: document.title });
    if (px && window.fbq) window.fbq('track', 'PageView');
  };

  const load = () => {
    if (on) return;
    on = true;
    if (ga) {
      const s = document.createElement('script'); s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ga);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', ga, { send_page_view: false });
    }
    if (px) {
      /* snippet oficial de Meta */
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', px);
    }
    pageView();
    queue.splice(0).forEach(([n, p]) => send(n, p));
  };

  // clicks a WhatsApp / Instagram desde cualquier botón del sitio
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    const h = a.getAttribute('href') || '';
    const where = a.id || a.className || 'link';
    if (/wa\.me|whatsapp/.test(h)) send('whatsapp', { boton: String(where).slice(0, 40) });
    else if (/instagram\.com|ig\.me/.test(h)) send('instagram', { boton: String(where).slice(0, 40) });
    else if (/supplyba\.com\.ar/.test(h)) send('ver_stock', { boton: String(where).slice(0, 40) });
  }, true);
  addEventListener('hashchange', () => setTimeout(pageView, 60));

  const banner = () => {
    const b = document.createElement('div');
    b.className = 'consent'; b.setAttribute('role', 'region'); b.setAttribute('aria-label', 'Aviso de cookies');
    b.innerHTML = '<p>Usamos cookies de Meta y Google para medir qué productos se miran y mostrarte anuncios relevantes. Podés aceptarlas o seguir solo con las necesarias.</p>' +
      '<div><button type="button" class="c-no">Solo necesarias</button><button type="button" class="c-ok">Aceptar</button></div>';
    const st = document.createElement('style');
    st.textContent = '.consent{position:fixed;left:max(12px,env(safe-area-inset-left));right:max(12px,env(safe-area-inset-right));bottom:calc(76px + env(safe-area-inset-bottom));z-index:60;max-width:520px;margin:0 auto;background:rgba(15,16,21,.96);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.14);padding:14px 16px;display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;color:#ededed;font:400 13.5px/1.5 "Space Grotesk",system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.5)}' +
      '.consent p{margin:0;flex:1 1 240px;color:#c3c8cf}.consent div{display:flex;gap:8px}' +
      '.consent button{min-height:40px;padding:0 14px;border:1px solid rgba(255,255,255,.2);background:transparent;color:inherit;font:600 13px "Space Grotesk",system-ui,sans-serif;cursor:pointer}' +
      '.consent .c-ok{background:#ededed;color:#000;border:0}' +
      '@media(min-width:860px){.consent{bottom:calc(20px + env(safe-area-inset-bottom))}}' +
      '[data-theme="light"] .consent{background:rgba(255,255,255,.97);color:#111;border-color:rgba(0,0,0,.12);box-shadow:0 12px 40px rgba(0,0,0,.18)}[data-theme="light"] .consent p{color:#4a4f57}[data-theme="light"] .consent button{border-color:rgba(0,0,0,.2)}[data-theme="light"] .consent .c-ok{background:#111;color:#fff}';
    document.head.appendChild(st);
    const done = (v) => { try { localStorage.setItem(KEY, v); } catch {} b.remove(); if (v === 'si') load(); };
    b.querySelector('.c-ok').addEventListener('click', () => done('si'));
    b.querySelector('.c-no').addEventListener('click', () => done('no'));
    document.body.appendChild(b);
  };

  fetch('/config.json').then((r) => r.json()).then((cfg) => {
    ga = String(cfg.ga4 || '').trim();
    px = String(cfg.metaPixelId || '').trim();
    if (!/^G-[A-Z0-9]+$/.test(ga)) ga = '';
    if (!/^\d{10,20}$/.test(px) || px === '123456789012345') px = '';
    if (!ga && !px) return;
    let c = null; try { c = localStorage.getItem(KEY); } catch {}
    if (c === 'si') load();
    else if (c !== 'no') banner();
  }).catch(() => {});
})();
