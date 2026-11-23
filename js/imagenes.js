// "¿Qué imagen pido?" (content/modules/imagenes-trauma.html): filters the cards by
// body area (chips) and by free text. The matching is pure so it can be tested;
// the two handlers below are installed on window by js/legacy-bridge.js.

/** Lowercase, no accents: "Muñeca" → "muneca", "RMN" → "rmn". */
export function normalizar(texto) {
  return String(texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/**
 * True if a card passes the area chip and every word of the query.
 * @param {{zona: string, texto: string}} tarjeta - texto is everything searchable in the card
 * @param {string} consulta - what the user typed
 * @param {string} zona - active chip, '' for all
 */
export function coincide(tarjeta, consulta, zona) {
  if (zona && tarjeta.zona !== zona) return false;
  const texto = normalizar(tarjeta.texto);
  return normalizar(consulta).split(/\s+/).filter(Boolean).every(palabra => texto.includes(palabra));
}

function aplicar(raiz) {
  const consulta = raiz.querySelector('.img-q')?.value ?? '';
  const zona = raiz.querySelector('.img-zonas .tab.on')?.dataset.imgZona ?? '';
  let visibles = 0;
  raiz.querySelectorAll('.img-card').forEach(card => {
    const ok = coincide({ zona: card.dataset.imgZona, texto: `${card.dataset.imgK} ${card.textContent}` }, consulta, zona);
    card.hidden = !ok;
    if (ok) visibles += 1;
  });
  const vacio = raiz.querySelector('.img-vacio');
  if (vacio) vacio.hidden = visibles > 0;
}

/** oninput of the search box. */
export function imgBuscar(input) {
  const raiz = input.closest('[data-img-pick]');
  if (raiz) aplicar(raiz);
}

/** onclick of an area chip: exactly one chip is active at a time. */
export function imgZona(chip) {
  const raiz = chip.closest('[data-img-pick]');
  if (!raiz) return;
  raiz.querySelectorAll('.img-zonas .tab').forEach(c => c.classList.toggle('on', c === chip));
  aplicar(raiz);
}
