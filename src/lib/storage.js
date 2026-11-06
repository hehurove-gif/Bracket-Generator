/* Guardado local (localStorage) y compartir por enlace/archivo. Nada sale del navegador:
   el enlace lleva el torneo completo dentro del "#", que ni siquiera se envía a ningún servidor. */
import { DEFAULT_SETTINGS, MAX_PLAYERS, applyOverrides, createTournament, setScore, slotOverrides, swissCanAdvance, swissNextRound, resolve } from './engine.js';

const KEY = 'bracket:v1';

export function loadAll() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!d || !Array.isArray(d.items)) return [];
    return d.items
      .filter((it) => it && it.id && it.t && Array.isArray(it.t.matches))
      .map((it) => ({ ...it, t: resolve(it.t) }));
  } catch {
    return [];
  }
}

export function saveAll(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ items }));
    return true;
  } catch {
    return false;
  }
}

export const newId = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

/* Formato compacto: solo lo necesario para reconstruir el torneo de forma determinista. */
export function toCompact(t) {
  return {
    v: 1,
    n: t.name,
    f: t.format,
    s: t.settings,
    p: t.players.map((p) => p.name),
    r: t.matches.filter((m) => m.scoreA != null && m.scoreB != null).map((m) => [m.id, m.scoreA, m.scoreB]),
    ...(slotOverrides(t).length ? { x: slotOverrides(t) } : {}), // jugadores movidos a mano
    ...(t.dq?.length ? { d: t.dq } : {}), // descalificados
  };
}

export function fromCompact(c) {
  if (!c || c.v !== 1 || !Array.isArray(c.p) || c.p.length > MAX_PLAYERS) throw new Error('Archivo o enlace inválido');
  const settings = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    const v = c.s?.[k];
    if (typeof v === typeof DEFAULT_SETTINGS[k]) settings[k] = v;
  }
  if (typeof c.s?.bestOf === 'number' && c.s.bestOfEarly == null) settings.bestOf = c.s.bestOf; // enlaces anteriores
  let t = createTournament({
    name: String(c.n ?? 'Torneo').slice(0, 80),
    format: c.f,
    names: c.p.map((n) => String(n).slice(0, 60)),
    settings,
  });
  t = applyOverrides(t, c.x);
  const valid = new Set(t.players.map((p) => p.id));
  t.dq = (Array.isArray(c.d) ? c.d : []).filter((id) => valid.has(id));
  resolve(t);
  const scores = new Map((Array.isArray(c.r) ? c.r : []).map(([id, a, b]) => [id, [a, b]]));
  // Los marcadores se reaplican en orden de dependencia. Un partido con DQ también puede traer marcador
  // (se jugó antes de la descalificación), así que se acepta si está listo o decidido por forfeit.
  for (let guard = 0; guard < 1000; guard++) {
    let changed = false;
    for (const id of [...scores.keys()]) {
      const m = t.matches.find((x) => x.id === id);
      if (m && (m.status === 'ready' || m.forfeit)) {
        const [a, b] = scores.get(id);
        scores.delete(id);
        t = setScore(t, id, a, b);
        changed = true;
      }
    }
    if (!changed && swissCanAdvance(t)) {
      t = swissNextRound(t);
      changed = true;
    }
    if (!changed) break;
  }
  return t;
}

/* ---------- enlace ---------- */

function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64(str) {
  const b = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (ch) => ch.charCodeAt(0));
}

export async function encodeShare(t) {
  const bytes = new TextEncoder().encode(JSON.stringify(toCompact(t)));
  if (typeof CompressionStream !== 'undefined') {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return 'z' + toB64(new Uint8Array(await new Response(stream).arrayBuffer()));
  }
  return 'j' + toB64(bytes);
}

export async function decodeShare(str) {
  const bytes = fromB64(str.slice(1));
  let json;
  if (str[0] === 'z') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    json = await new Response(stream).text();
  } else if (str[0] === 'j') {
    json = new TextDecoder().decode(bytes);
  } else {
    throw new Error('Enlace inválido');
  }
  return fromCompact(JSON.parse(json));
}
