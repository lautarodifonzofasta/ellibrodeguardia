// Intro shown before entering the app, once per session. It follows the
// original animation of the logo: the open book spreads its pages like a hand
// fan; then the book closes: the pages turn up together and fuse into one
// line, and that line is the upright of the medical cross (nothing rises on
// its own from the centre), while the base closes into its arm. Then the
// title appears and the intro fades into the home. Drawn in SVG (the book is the
// logo traced from the original animation, in index.html), so it stays sharp
// at any size and weighs a few KB. About 3 s; a tap or a key skips it. Not
// shown on deep links or on a reload within the same session (see the inline
// script in index.html), and reduced to a still frame with
// prefers-reduced-motion.

const SVG_NS = 'http://www.w3.org/2000/svg';
const CX = 279.5;                                    // vertical axis of the logo
const BASE = { left: 65.25, right: 493.75, y: 317, notch: 18, w: 16.5 };
const STEM = { bottom: 467.25, w: 17.5 };
const GUTTER = 13;                                   // pages fan from 13 units above the base line
const CROSS = { y: 270, arm: 125, w: 26 };           // medical cross: equal arms

// Pages, measured on the original animation: degrees above the horizontal,
// from the cover (outer) to the spine (inner), mirrored on both sides.
const FAN = [4, 13, 28, 45.5, 65.5, 84.5];           // fully open fan
const HALF = [1.3, 3.2, 3.4, 4, 4.5, 4.5];           // half the angular width of each page
const OPEN_FROM = 0.38;                              // the logo is a fan already 38 % open
const ELLIPSE = { a: 185, b: 148 };                  // outline of the open fan
const OVERLAP = 3;                                   // closed, each page also covers the next three pages' places

const T = {
  pagesOut: [100, 320], open: [100, 950], close: [1100, 1750],
  base: [1500, 1950], notch: [1500, 1630], pulse: [1950, 2300],
  title: [1800, 2350], tag: [2050, 2500], exit: [2750, 3150],
};
const STILL_MS = 900;   // prefers-reduced-motion: how long the still frame stays

const clamp01 = v => Math.min(1, Math.max(0, v));
const prog = (t, [a, b]) => clamp01((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = k => 1 - (1 - k) ** 3;
const easeIn = k => k ** 3;
const easeInOut = k => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
const r1 = v => Math.round(v * 10) / 10;
const rad = deg => (deg * Math.PI) / 180;

// Distance from the gutter to the outline of the open fan (an ellipse), along
// a page `deg` degrees above the horizontal.
const toEllipse = deg => 1 / Math.hypot(Math.cos(rad(deg)) / ELLIPSE.a, Math.sin(rad(deg)) / ELLIPSE.b);

// One page seen from the spine. Open (`k` 0) it is a wedge from the gutter,
// arched upwards (`bend`) like the pages of the logo. Closed (`k` 1) it
// stands up edge-on as one strip of the upright of the cross: from the base
// line to the round top, between `far` and `near` (its outer and inner edges,
// measured out from the axis; the cover is the outermost page). Its corners
// move in the page's own frame (along and across it) while it turns about the
// gutter, so the pages close like the leaves of a book: they come together
// side by side, each in its place, and fuse into one bar without a waist.
function pagePath(gx, gy, side, deg, r, half, bend, k = 0, slot = null) {
  if (r < 1) return '';
  const a = rad(deg), h = rad(half);
  const u = [side * Math.cos(a), -Math.sin(a)];       // along the page, outwards
  const n = [-side * Math.sin(a), -Math.cos(a)];      // across it, towards the spine
  const rIn = Math.min(r * 0.12, 16);
  const { far = 0, near = 0, len = 0, cap = 1 } = slot || {};
  const top = x => len + Math.sqrt(Math.max(0, cap * cap - x * x));   // the round top of the upright
  // Open position → closed position, as [along, across] from the gutter
  const at = ([l0, c0], [l1, c1]) => {
    const l = lerp(l0, l1, k), c = lerp(c0, c1, k);
    return [gx + l * u[0] + c * n[0], gy + l * u[1] + c * n[1]];
  };
  const ci = Math.cos(0.3 * h), si = Math.sin(0.3 * h), co = Math.cos(h), so = Math.sin(h);
  const i1 = at([rIn * ci, -rIn * si], [-GUTTER, -far]);
  const o1 = at([r * co, -r * so], [top(far), -far]);
  const o2 = at([r * co, r * so], [top(near), -near]);
  const i2 = at([rIn * ci, rIn * si], [-GUTTER, -near]);
  const c1 = [(i1[0] + o1[0]) / 2, (i1[1] + o1[1]) / 2 - bend];
  const c2 = [(i2[0] + o2[0]) / 2, (i2[1] + o2[1]) / 2 - bend];
  const f = ([x, y]) => `${r1(x)},${r1(y)}`;
  const arc = r1(1 / lerp(1 / 600, 1 / cap, k));     // the edge of the fan, then the round top
  return `M${f(i1)}Q${f(c1)} ${f(o1)}A${arc} ${arc} 0 0 ${side > 0 ? 0 : 1} ${f(o2)}Q${f(c2)} ${f(i2)}Z`;
}
// The book's base line with the dip at the spine; notch 0 is a straight bar.
function basePath(left, right, y, notch) {
  const w = 32;
  return `M${r1(left)},${r1(y)}L${CX - w},${r1(y)}` +
    `C${CX - w + 9},${r1(y)} ${CX - 15},${r1(y + notch)} ${CX},${r1(y + notch)}` +
    `C${CX + 15},${r1(y + notch)} ${CX + w - 9},${r1(y)} ${CX + w},${r1(y)}L${r1(right)},${r1(y)}`;
}

export function runSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  if (document.documentElement.classList.contains('no-splash')) {
    splash.remove();
    return;
  }
  try { sessionStorage.setItem('elg-splash', '1'); } catch { /* storage off: it shows again on reload, nothing else */ }
  splash.style.animation = 'none'; // the script takes over from the CSS fallback

  const inner = splash.querySelector('.splash-in');
  const logoPages = [...splash.querySelectorAll('.splash-page')];
  const bookBase = splash.querySelector('.splash-book-base');
  const cross = splash.querySelector('.splash-cross');
  const base = splash.querySelector('.splash-base');
  const stem = splash.querySelector('.splash-stem');
  const glow = splash.querySelector('.splash-glow');
  const title = splash.querySelector('.splash-title');
  const tag = splash.querySelector('.splash-tag');
  const group = splash.querySelector('.splash-rays');
  // Left pages then right pages, each from the cover to the spine
  const pages = [-1, 1].flatMap(side => FAN.map((_, i) => ({
    side, i, el: group.appendChild(document.createElementNS(SVG_NS, 'path')),
  })));

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let exitAt = reduced ? STILL_MS : T.exit[0];
  let exitLen = reduced ? 250 : T.exit[1] - T.exit[0];
  let start = null;
  let done = false;

  function draw(t) {
    // The traced pages of the logo lift a little and hand over to the fan
    const po = easeOut(prog(t, T.pagesOut));
    logoPages.forEach((p, i) => {
      const lift = (i < logoPages.length / 2 ? 1 : -1) * 6 * po;
      p.setAttribute('transform', `rotate(${r1(lift)} ${CX} ${BASE.y - GUTTER})`);
      p.style.opacity = 1 - po;
    });

    // Base and spine: they carry the gutter the pages fan from
    const b = easeInOut(prog(t, T.base));
    const baseY = lerp(BASE.y, CROSS.y, b);
    const gutterY = baseY - GUTTER;

    // Pages: open like a hand fan; then the book closes: every page turns up
    // (all together, like a hand fan closing) and edge-on, and they come
    // together side by side, the cover outermost, until they fuse into one
    // bar: the upright of the cross. Nothing shrinks away downwards: the tips
    // go up to the top of the upright and stay there while the base rises.
    const open = lerp(OPEN_FROM, 1, easeInOut(prog(t, T.open)));
    const openK = (open - OPEN_FROM) / (1 - OPEN_FROM);
    const close = easeInOut(prog(t, T.close));
    const closed = t >= T.close[1];
    const appear = clamp01((t - T.pagesOut[0]) / 160);
    const topY = CROSS.y - CROSS.arm;
    const uprightW = lerp(STEM.w, CROSS.w, b);         // the closed pages are exactly as wide as the stem
    const share = uprightW / 2 / FAN.length;           // each page's share of half the upright
    pages.forEach(({ side, i, el }) => {
      const deg = lerp(FAN[i] * open, 90, close);
      const r = toEllipse(deg);
      const half = HALF[i] * lerp(0.55, 1, openK);
      const bend = 0.1 * r * Math.cos(rad(deg)) ** 2;
      const slot = {
        far: share * (FAN.length - i),                 // the cover outermost, the last page at the axis
        near: share * (FAN.length - 1 - i - OVERLAP),  // over the next pages' places: no seams
        len: gutterY - topY,
        cap: uprightW / 2,
      };
      // Once closed, the upright is drawn whole in their place and they are dropped
      el.setAttribute('d', closed ? '' : pagePath(CX, gutterY, side, deg, r, half, bend, close, slot));
      el.style.opacity = appear;
    });

    // The vector base takes over from the traced one before anything moves
    const vector = t >= T.close[0];
    bookBase.style.opacity = vector ? 0 : 1;
    cross.style.opacity = vector ? 1 : 0;

    // The stem stays below the base (the upright above it is the closed
    // pages until they have fused); the base closes into the cross's arm
    const notch = lerp(BASE.notch, 0, easeInOut(prog(t, T.notch)));
    const top = closed ? topY : baseY + notch;
    const bottom = lerp(STEM.bottom, CROSS.y + CROSS.arm, b);
    stem.setAttribute('d', `M${CX},${r1(top)}L${CX},${r1(bottom)}`);
    stem.setAttribute('stroke-width', r1(uprightW));
    base.setAttribute('d', basePath(
      lerp(BASE.left, CX - CROSS.arm, b), lerp(BASE.right, CX + CROSS.arm, b),
      baseY, notch));
    base.setAttribute('stroke-width', r1(lerp(BASE.w, CROSS.w, b)));

    // One heartbeat of the cross, with its glow
    const p = prog(t, T.pulse);
    const beat = Math.sin(Math.PI * p);
    cross.setAttribute('transform', `translate(${CX} ${CROSS.y}) scale(${1 + 0.07 * beat}) translate(${-CX} ${-CROSS.y})`);
    glow.style.opacity = p > 0 ? Math.max(beat, 0.55 * p) : 0;

    // Title and tagline
    const ti = easeOut(prog(t, T.title));
    title.style.opacity = ti;
    title.style.transform = `translateY(${r1(14 * (1 - ti))}px)`;
    const tg = easeOut(prog(t, T.tag));
    tag.style.opacity = tg;
    tag.style.transform = `translateY(${r1(8 * (1 - tg))}px)`;
  }

  function finish() {
    if (done) return;
    done = true;
    splash.remove();
  }

  function frame(now) {
    if (done) return;
    if (start === null) start = now;
    const t = now - start;
    draw(reduced ? T.tag[1] : Math.min(t, exitAt));
    const e = clamp01((t - exitAt) / exitLen);
    if (e > 0) {
      splash.style.opacity = 1 - easeIn(e);
      if (!reduced) inner.style.transform = `scale(${1 + 0.03 * easeIn(e)})`;
    }
    if (e >= 1) finish();
    else requestAnimationFrame(frame);
  }

  // Tap, click or any key: skip to a short fade
  const skip = () => {
    if (start === null || done) return;
    const t = performance.now() - start;
    if (t < exitAt) { exitAt = t; exitLen = 220; }
  };
  splash.addEventListener('pointerdown', skip);
  window.addEventListener('keydown', skip, { once: true });

  draw(0);
  requestAnimationFrame(frame);
}
