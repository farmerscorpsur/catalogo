/* El sitio usa solo el modo claro. Se deja este archivo para que las páginas que lo cargan
   queden en claro aunque alguien tenga guardada la elección vieja de modo oscuro. */
(() => {
  document.documentElement.dataset.theme = 'light';
  try { localStorage.removeItem('supplyba_tema_v1'); } catch {}
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = '#ededed';
})();
