/* Posiciones de los partidos en el lienzo del bracket (eliminación simple y doble). */

export const CARD_W = 232;
export const CARD_H = 88;
const COL_GAP = 56;
const ROW_GAP = 18;
const HEAD_H = 30; // título de sección
const ROUND_H = 26; // encabezado de ronda
const SECTION_GAP = 44;
const PAD = 24;

export function roundLabel(bracket, round, maxRound, double) {
  if (bracket === 'GF') return round === 1 ? 'Grand Finals' : 'Reset (solo si gana losers)';
  if (bracket === '3P') return 'Tercer lugar';
  if (bracket === 'L') return round === maxRound ? 'Final de losers' : `Losers ronda ${round}`;
  const suffix = double ? ' de winners' : '';
  if (round === maxRound) return double ? 'Final de winners' : 'Final';
  if (round === maxRound - 1) return `Semifinal${suffix}`;
  if (round === maxRound - 2) return `Cuartos${suffix}`;
  return `Ronda ${round}${double ? ' (winners)' : ''}`;
}

export function computeLayout(t) {
  const double = t.format === 'double';
  const defs = double
    ? [['W', 'Winners'], ['L', 'Losers']]
    : [['W', 'Bracket'], ['3P', 'Partido por el tercer lugar']];
  const nodes = [];
  const lines = [];
  const headers = [];
  const titles = [];
  const pos = new Map();
  let top = PAD;
  let width = 0;

  for (const [key, title] of defs) {
    const ms = t.matches.filter((m) => m.bracket === key);
    if (!ms.length) continue;
    const maxRound = Math.max(...ms.map((m) => m.round));
    titles.push({ key, title, y: top });
    const bodyTop = top + HEAD_H + ROUND_H;
    let bottom = bodyTop;
    for (let r = 1; r <= maxRound; r++) {
      const col = ms.filter((m) => m.round === r).sort((a, b) => a.index - b.index);
      const x = PAD + (r - 1) * (CARD_W + COL_GAP);
      headers.push({ key: `${key}${r}`, x, y: top + HEAD_H, label: roundLabel(key, r, maxRound, double) });
      col.forEach((m, i) => {
        const feeders = [m.srcA, m.srcB]
          .filter((s) => s && s.t === 'w' && pos.get(s.m)?.m.bracket === key)
          .map((s) => pos.get(s.m).y - bodyTop);
        const rel = feeders.length ? feeders.reduce((a, b) => a + b, 0) / feeders.length : i * (CARD_H + ROW_GAP);
        const node = { m, x, y: bodyTop + rel };
        pos.set(m.id, node);
        nodes.push(node);
        bottom = Math.max(bottom, node.y + CARD_H);
        width = Math.max(width, x + CARD_W + PAD);
      });
    }
    // Líneas desde cada partido que alimenta (ganador) hacia el siguiente, solo dentro de la sección.
    for (const m of ms) {
      const to = pos.get(m.id);
      for (const s of [m.srcA, m.srcB]) {
        if (!s || s.t !== 'w' || pos.get(s.m)?.m.bracket !== key) continue;
        const from = pos.get(s.m);
        if (from.x >= to.x) continue;
        lines.push({ id: `${s.m}>${m.id}`, from: s.m, to: m.id, x1: from.x + CARD_W, y1: from.y + CARD_H / 2, x2: to.x, y2: to.y + CARD_H / 2 });
      }
    }
    top = bottom + SECTION_GAP;
  }
  // Grand Finals: a la derecha de winners y losers, a media altura entre sus dos finalistas, con conectores.
  const gf = t.matches.filter((m) => m.bracket === 'GF').sort((a, b) => a.round - b.round);
  if (double && gf.length) {
    const cols = Math.max(...[...pos.values()].map((n) => Math.round((n.x - PAD) / (CARD_W + COL_GAP)) + 1));
    const g1 = gf[0];
    const feeds = [g1.srcA, g1.srcB].map((s) => pos.get(s.m));
    const gy = feeds.reduce((a, n) => a + n.y, 0) / feeds.length;
    const gx = PAD + cols * (CARD_W + COL_GAP);
    gf.forEach((m, i) => {
      const node = { m, x: gx + i * (CARD_W + COL_GAP), y: gy };
      pos.set(m.id, node);
      nodes.push(node);
      headers.push({ key: `GF${m.round}`, x: node.x, y: gy - ROUND_H + 2, label: roundLabel('GF', m.round, gf.length, true) });
      width = Math.max(width, node.x + CARD_W + PAD);
    });
    const node1 = pos.get(g1.id);
    for (const n of feeds) {
      lines.push({ id: `${n.m.id}>${g1.id}`, from: n.m.id, to: g1.id, x1: n.x + CARD_W, y1: n.y + CARD_H / 2, x2: node1.x, y2: node1.y + CARD_H / 2, mid: node1.x - COL_GAP / 2 });
    }
    if (gf[1]) {
      const n2 = pos.get(gf[1].id);
      lines.push({ id: `${g1.id}>${gf[1].id}`, from: g1.id, to: gf[1].id, x1: node1.x + CARD_W, y1: node1.y + CARD_H / 2, x2: n2.x, y2: n2.y + CARD_H / 2, dashed: true });
    }
  }
  return { nodes, lines, headers, titles, width: Math.max(width, 320), height: top - SECTION_GAP + PAD };
}
