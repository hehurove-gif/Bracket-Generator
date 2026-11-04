/* Motor de torneos (sin dependencias ni UI): eliminación simple, doble eliminación,
   round robin y suizo. Todo es un objeto JSON simple, así se guarda y se comparte fácil.

   Idea central: cada partido sabe de dónde salen sus participantes ("fuentes": un jugador fijo,
   el ganador de otro partido, el perdedor de otro partido...). `resolve()` recalcula todo a partir
   de los marcadores, así que cambiar un resultado actualiza solo el resto del bracket. */

export const FORMATS = ['single', 'double', 'roundrobin', 'swiss'];
export const MIN_PLAYERS = { single: 2, double: 3, roundrobin: 2, swiss: 4 };
export const MAX_PLAYERS = 128;
export const BYE = 'BYE';

export const DEFAULT_SETTINGS = {
  bestOf: 1, // sets/juegos al mejor de N (1, 3, 5, 7)
  thirdPlace: false, // partido por el 3er lugar (eliminación simple)
  grandFinalReset: true, // doble eliminación: si gana el de losers, se juega una segunda final
  doubleRoundRobin: false, // round robin a ida y vuelta
  swissRounds: 0, // 0 = automático
  allowDraw: false, // empates (solo round robin y suizo)
  winPoints: 3,
  drawPoints: 1,
};

const P = (id) => ({ t: 'p', id });
const BYE_SRC = { t: 'bye' };
const W = (m) => ({ t: 'w', m });
const L = (m) => ({ t: 'l', m });

export function validate(format, n) {
  if (!FORMATS.includes(format)) return 'Formato desconocido';
  if (n < MIN_PLAYERS[format]) return `Se necesitan al menos ${MIN_PLAYERS[format]} jugadores`;
  if (n > MAX_PLAYERS) return `Máximo ${MAX_PLAYERS} jugadores`;
  return null;
}

/* ---------- utilidades ---------- */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pow2 = (n) => 2 ** Math.ceil(Math.log2(Math.max(2, n)));

/* Orden estándar de siembra: [1,16,8,9,4,13,...]; los partidos son pares consecutivos. */
export function seedOrder(size) {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

export const swissRoundCount = (n) => Math.max(1, Math.ceil(Math.log2(Math.max(2, n))));

function mk(id, bracket, round, index, srcA, srcB, extra = {}) {
  return { id, bracket, round, index, srcA, srcB, scoreA: null, scoreB: null, rec: null, ...extra };
}

/* ---------- construcción ---------- */

function buildSingle(players, s) {
  const n = players.length;
  const size = pow2(n);
  const k = Math.log2(size);
  const order = seedOrder(size);
  const matches = [];
  const src = (seed) => (seed <= n ? P(players[seed - 1].id) : BYE_SRC);
  for (let i = 0; i < size / 2; i++) {
    matches.push(mk(`W1-${i + 1}`, 'W', 1, i + 1, src(order[2 * i]), src(order[2 * i + 1])));
  }
  for (let r = 2; r <= k; r++) {
    for (let i = 0; i < size / 2 ** r; i++) {
      matches.push(mk(`W${r}-${i + 1}`, 'W', r, i + 1, W(`W${r - 1}-${2 * i + 1}`), W(`W${r - 1}-${2 * i + 2}`)));
    }
  }
  if (s.thirdPlace && k >= 2) {
    matches.push(mk('3P-1', '3P', 1, 1, L(`W${k - 1}-1`), L(`W${k - 1}-2`)));
  }
  return { matches, size, k };
}

function buildDouble(players, s) {
  const { matches, size, k } = buildSingle(players, { thirdPlace: false });
  const lb = [];
  // LR1: pierden en W1 se enfrentan entre sí.
  let prev = [];
  for (let i = 0; i < size / 4; i++) {
    const m = mk(`L1-${i + 1}`, 'L', 1, i + 1, L(`W1-${2 * i + 1}`), L(`W1-${2 * i + 2}`));
    lb.push(m);
    prev.push(m.id);
  }
  let round = 1;
  for (let j = 2; j <= k; j++) {
    // Ronda donde caen los perdedores de W{j}; se invierte el orden en rondas pares para evitar revanchas rápidas.
    round++;
    const count = size / 2 ** j;
    const next = [];
    for (let i = 0; i < count; i++) {
      const dropIdx = j % 2 === 0 ? count - i : i + 1;
      const m = mk(`L${round}-${i + 1}`, 'L', round, i + 1, W(prev[i]), L(`W${j}-${dropIdx}`));
      lb.push(m);
      next.push(m.id);
    }
    prev = next;
    if (j < k) {
      round++;
      const next2 = [];
      for (let i = 0; i < prev.length / 2; i++) {
        const m = mk(`L${round}-${i + 1}`, 'L', round, i + 1, W(prev[2 * i]), W(prev[2 * i + 1]));
        lb.push(m);
        next2.push(m.id);
      }
      prev = next2;
    }
  }
  const all = [...matches, ...lb];
  all.push(mk('GF-1', 'GF', 1, 1, W(`W${k}-1`), W(prev[0])));
  if (s.grandFinalReset) all.push(mk('GF-2', 'GF', 2, 1, null, null, { reset: true, resetOf: 'GF-1' }));
  return all;
}

function buildRoundRobin(players, s) {
  const ids = players.map((p) => p.id);
  if (ids.length % 2) ids.push(BYE);
  const n = ids.length;
  const matches = [];
  let arr = [...ids];
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      let a = arr[i];
      let b = arr[n - 1 - i];
      if (a === BYE || b === BYE) continue;
      if (i === 0 && r % 2 === 1) [a, b] = [b, a];
      pairs.push([a, b]);
    }
    rounds.push(pairs);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  const passes = s.doubleRoundRobin ? 2 : 1;
  for (let pass = 0; pass < passes; pass++) {
    rounds.forEach((pairs, r) => {
      const round = pass * rounds.length + r + 1;
      pairs.forEach(([a, b], i) => {
        const [x, y] = pass ? [b, a] : [a, b];
        matches.push(mk(`R${round}-${i + 1}`, 'RR', round, i + 1, P(x), P(y)));
      });
    });
  }
  return matches;
}

export function createTournament({ name = 'Torneo', format = 'single', names = [], settings = {} }) {
  const clean = names.map((n) => String(n).trim()).filter(Boolean);
  const players = clean.map((n, i) => ({ id: `p${i + 1}`, name: n }));
  const err = validate(format, players.length);
  if (err) throw new Error(err);
  const s = { ...DEFAULT_SETTINGS, ...settings };
  if (format === 'swiss' && !s.swissRounds) s.swissRounds = swissRoundCount(players.length);
  if (format !== 'roundrobin' && format !== 'swiss') s.allowDraw = false;
  let matches = [];
  if (format === 'single') matches = buildSingle(players, s).matches;
  else if (format === 'double') matches = buildDouble(players, s);
  else if (format === 'roundrobin') matches = buildRoundRobin(players, s);
  else matches = swissPair({ players, matches: [], settings: s, format }, 1);
  const t = { name: String(name).trim() || 'Torneo', format, settings: s, players, matches };
  return resolve(t);
}

/* ---------- resolución ---------- */

function clearScores(m) {
  m.scoreA = null;
  m.scoreB = null;
  m.rec = null;
}

/* Recalcula participantes, estado y ganadores de todos los partidos. Muta y devuelve `t`.
   Estados: pending (faltan participantes), ready (listo para jugarse), done, bye, skipped. */
export function resolve(t) {
  const byId = new Map();
  const need = Math.ceil(t.settings.bestOf / 2);
  const drawsOk = t.settings.allowDraw && (t.format === 'roundrobin' || t.format === 'swiss');
  for (const m of t.matches) {
    byId.set(m.id, m);
    const get = (src) => {
      switch (src.t) {
        case 'p': return src.id;
        case 'bye': return BYE;
        case 'w': return byId.get(src.m).winner;
        case 'l': return byId.get(src.m).loser;
        default: return null;
      }
    };
    m.winner = null;
    m.loser = null;
    m.draw = false;

    let a;
    let b;
    let skipped = false;
    if (m.reset) {
      const g = byId.get(m.resetOf);
      if (g.status === 'done') {
        a = g.a;
        b = g.b;
        skipped = g.winner === g.a; // ganó el de winners: no hay segunda final
      } else {
        a = null;
        b = null;
      }
    } else {
      a = get(m.srcA);
      b = get(m.srcB);
    }
    m.a = a;
    m.b = b;

    if (skipped) {
      const g = byId.get(m.resetOf);
      m.status = 'skipped';
      m.winner = g.winner;
      m.loser = g.loser;
      clearScores(m);
      continue;
    }
    if (a === BYE || b === BYE) {
      const p = a === BYE ? b : a;
      m.status = 'bye';
      m.winner = a === BYE && b === BYE ? BYE : p;
      m.loser = p === null ? null : BYE;
      if (a === BYE && b === BYE) m.loser = BYE;
      clearScores(m);
      continue;
    }
    if (a === null || b === null) {
      m.status = 'pending';
      clearScores(m);
      continue;
    }
    if (m.rec && (m.rec.a !== a || m.rec.b !== b)) clearScores(m); // cambió quién juega: el marcador ya no vale
    m.status = 'ready';
    const { scoreA: sa, scoreB: sb } = m;
    if (sa != null && sb != null) {
      if (sa !== sb && Math.max(sa, sb) >= need) {
        m.status = 'done';
        m.winner = sa > sb ? a : b;
        m.loser = sa > sb ? b : a;
        if (!m.rec) m.rec = { a, b };
      } else if (sa === sb && drawsOk) {
        m.status = 'done';
        m.draw = true;
        if (!m.rec) m.rec = { a, b };
      }
    }
  }
  return t;
}

const clone = (t) => JSON.parse(JSON.stringify(t));

export function setScore(t, matchId, scoreA, scoreB) {
  const next = clone(t);
  const m = next.matches.find((x) => x.id === matchId);
  if (!m) return t;
  resolve(next); // asegura a/b actualizados
  if (m.a == null || m.b == null || m.a === BYE || m.b === BYE) return t;
  const ok = (v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 99);
  if (!ok(scoreA) || !ok(scoreB)) return t;
  m.scoreA = scoreA;
  m.scoreB = scoreB;
  m.rec = { a: m.a, b: m.b };
  return resolve(next);
}

export function clearMatch(t, matchId) {
  const next = clone(t);
  const m = next.matches.find((x) => x.id === matchId);
  if (m) clearScores(m);
  return resolve(next);
}

export function resetResults(t) {
  const next = clone(t);
  next.matches.forEach(clearScores);
  if (next.format === 'swiss') next.matches = next.matches.filter((m) => m.round === 1);
  return resolve(next);
}

/* ---------- tabla de posiciones (round robin y suizo) ---------- */

export function standings(t) {
  const rows = new Map(t.players.map((p, i) => [p.id, { id: p.id, name: p.name, seed: i + 1, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0, buchholz: 0, opponents: [], byes: 0 }]));
  const { winPoints, drawPoints } = t.settings;
  for (const m of t.matches) {
    if (m.status === 'bye' && m.winner && m.winner !== BYE && t.format !== 'single' && t.format !== 'double') {
      const r = rows.get(m.winner);
      r.played++;
      r.wins++;
      r.byes++;
      r.points += winPoints;
      continue;
    }
    if (m.status !== 'done') continue;
    const ra = rows.get(m.a);
    const rb = rows.get(m.b);
    ra.played++;
    rb.played++;
    ra.gf += m.scoreA; ra.ga += m.scoreB;
    rb.gf += m.scoreB; rb.ga += m.scoreA;
    ra.opponents.push(m.b);
    rb.opponents.push(m.a);
    if (m.draw) {
      ra.draws++; rb.draws++;
      ra.points += drawPoints; rb.points += drawPoints;
    } else {
      const w = m.winner === m.a ? ra : rb;
      const l = m.winner === m.a ? rb : ra;
      w.wins++; l.losses++;
      w.points += winPoints;
    }
  }
  for (const r of rows.values()) r.buchholz = r.opponents.reduce((acc, id) => acc + rows.get(id).points, 0);
  const list = [...rows.values()];
  const swiss = t.format === 'swiss';
  list.sort((x, y) =>
    y.points - x.points ||
    (swiss ? y.buchholz - x.buchholz : 0) ||
    (y.gf - y.ga) - (x.gf - x.ga) ||
    y.gf - x.gf ||
    x.seed - y.seed);
  return list;
}

/* ---------- suizo ---------- */

function pairPlayers(order, played, allowRematch) {
  if (!order.length) return [];
  const [first, ...rest] = order;
  for (let i = 0; i < rest.length; i++) {
    const other = rest[i];
    if (!allowRematch && played.has(`${first}|${other}`)) continue;
    const tail = pairPlayers(rest.filter((_, j) => j !== i), played, allowRematch);
    if (tail) return [[first, other], ...tail];
  }
  return null;
}

function swissPair(t, round) {
  const ids = t.players.map((p) => p.id);
  let order;
  let byePlayer = null;
  let pairs;
  if (round === 1) {
    order = [...ids];
    if (order.length % 2) byePlayer = order.pop();
    const half = order.length / 2;
    pairs = order.slice(0, half).map((id, i) => [id, order[i + half]]);
  } else {
    const st = standings(t).map((r) => r.id);
    order = st;
    if (order.length % 2) {
      const hadBye = new Set(t.matches.filter((m) => m.status === 'bye' && m.winner !== BYE).map((m) => m.winner));
      const pick = [...order].reverse().find((id) => !hadBye.has(id)) ?? order[order.length - 1];
      byePlayer = pick;
      order = order.filter((id) => id !== pick);
    }
    const played = new Set();
    for (const m of t.matches) {
      if (m.a && m.b && m.a !== BYE && m.b !== BYE) {
        played.add(`${m.a}|${m.b}`);
        played.add(`${m.b}|${m.a}`);
      }
    }
    pairs = pairPlayers(order, played, false) || pairPlayers(order, played, true);
  }
  const out = pairs.map(([a, b], i) => mk(`S${round}-${i + 1}`, 'S', round, i + 1, P(a), P(b)));
  if (byePlayer) out.push(mk(`S${round}-${pairs.length + 1}`, 'S', round, pairs.length + 1, P(byePlayer), BYE_SRC));
  return out;
}

export const swissCurrentRound = (t) => t.matches.reduce((mx, m) => Math.max(mx, m.round), 0);

export function swissCanAdvance(t) {
  if (t.format !== 'swiss') return false;
  const r = swissCurrentRound(t);
  if (r >= t.settings.swissRounds) return false;
  return t.matches.filter((m) => m.round === r).every((m) => m.status === 'done' || m.status === 'bye');
}

export function swissNextRound(t) {
  if (!swissCanAdvance(t)) return t;
  const next = clone(t);
  next.matches.push(...swissPair(next, swissCurrentRound(next) + 1));
  return resolve(next);
}

/* ---------- resultados ---------- */

export function isFinished(t) {
  if (t.format === 'swiss') {
    return swissCurrentRound(t) >= t.settings.swissRounds && t.matches.every((m) => m.status === 'done' || m.status === 'bye');
  }
  return t.matches.every((m) => m.status === 'done' || m.status === 'bye' || m.status === 'skipped');
}

export function progress(t) {
  const real = t.matches.filter((m) => m.status !== 'bye' && m.status !== 'skipped');
  return { done: real.filter((m) => m.status === 'done').length, total: real.length };
}

/* Podio: [{ place, ids: [...] }] con lo que ya se pueda saber. */
export function podium(t) {
  const byId = new Map(t.matches.map((m) => [m.id, m]));
  const out = [];
  const real = (id) => (id && id !== BYE ? id : null);
  if (t.format === 'single') {
    const k = Math.log2(pow2(t.players.length));
    const f = byId.get(`W${k}-1`);
    if (f.winner && real(f.winner)) {
      out.push({ place: 1, ids: [f.winner] });
      if (real(f.loser)) out.push({ place: 2, ids: [f.loser] });
      const tp = byId.get('3P-1');
      if (tp && tp.status === 'done') out.push({ place: 3, ids: [tp.winner] });
      else if (!tp && k >= 2) {
        const semis = [byId.get(`W${k - 1}-1`), byId.get(`W${k - 1}-2`)].map((m) => real(m.loser)).filter(Boolean);
        if (semis.length) out.push({ place: 3, ids: semis });
      }
    }
  } else if (t.format === 'double') {
    const gf1 = byId.get('GF-1');
    const gf2 = byId.get('GF-2');
    const last = gf2 && gf2.status !== 'skipped' ? gf2 : gf1;
    const champ = last.status === 'done' ? last : gf2 && gf2.status === 'skipped' ? gf1 : null;
    if (champ && champ.winner) {
      out.push({ place: 1, ids: [champ.winner] });
      out.push({ place: 2, ids: [champ.loser] });
      const lastL = t.matches.filter((m) => m.bracket === 'L').pop();
      if (lastL && real(lastL.loser)) out.push({ place: 3, ids: [lastL.loser] });
    }
  } else if (isFinished(t)) {
    standings(t).slice(0, 3).forEach((r, i) => out.push({ place: i + 1, ids: [r.id] }));
  }
  return out;
}

export const champion = (t) => podium(t).find((p) => p.place === 1)?.ids[0] ?? null;

/* ---------- simulación ---------- */

/* Juega todo lo que falta. `upsets` (0-1) = qué tan impredecible es: 0 gana siempre el mejor seed, 1 es volado. */
export function autoPlay(t, { rng = Math.random, upsets = 0.35 } = {}) {
  let cur = clone(t);
  resolve(cur);
  const seedOf = new Map(cur.players.map((p, i) => [p.id, i + 1]));
  const need = Math.ceil(cur.settings.bestOf / 2);
  const exp = 2 * (1 - upsets);
  for (let guard = 0; guard < 5000; guard++) {
    const m = cur.matches.find((x) => x.status === 'ready' && !(x.scoreA != null && x.scoreB != null && x.status === 'done'));
    if (!m) {
      if (swissCanAdvance(cur)) {
        cur = swissNextRound(cur);
        continue;
      }
      break;
    }
    const ra = (1 / seedOf.get(m.a)) ** exp;
    const rb = (1 / seedOf.get(m.b)) ** exp;
    let sa;
    let sb;
    if (cur.settings.allowDraw && rng() < 0.12) {
      sa = sb = 1;
    } else if (rng() < ra / (ra + rb)) {
      sa = need;
      sb = Math.floor(rng() * need);
    } else {
      sb = need;
      sa = Math.floor(rng() * need);
    }
    m.scoreA = sa;
    m.scoreB = sb;
    m.rec = { a: m.a, b: m.b };
    resolve(cur);
  }
  return cur;
}
