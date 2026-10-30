/* Tema claro / oscuro. Se carga en el <head> sin defer para aplicar el tema antes de pintar.
   Oscuro es el de la marca y el default; la elección queda guardada en este navegador. */
(() => {
  const KEY = 'supplyba_tema_v1';
  const root = document.documentElement;
  const COLOR = { dark: '#000000', light: '#f4f4f2' };
  let t = 'dark';
  try { if (localStorage.getItem(KEY) === 'light') t = 'light'; } catch {}

  const apply = (v) => {
    t = v;
    root.dataset.theme = v;
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = COLOR[v];
    document.querySelectorAll('[data-tema]').forEach((b) => {
      b.setAttribute('aria-pressed', String(v === 'light'));
      b.setAttribute('aria-label', v === 'light' ? 'Pasar a modo oscuro' : 'Pasar a modo claro');
      b.title = v === 'light' ? 'Modo oscuro' : 'Modo claro';
    });
  };
  apply(t);

  const toggle = () => {
    const v = t === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(KEY, v); } catch {}
    root.classList.add('tema-fade');
    apply(v);
    setTimeout(() => root.classList.remove('tema-fade'), 400);
    try { window.sbMedir?.('cambiar_tema', { tema: v }); } catch {}
  };
  window.sbTema = { toggle, get: () => t };

  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-tema]');
    if (b) { e.preventDefault(); toggle(); }
  });
  document.addEventListener('DOMContentLoaded', () => apply(t));
})();
