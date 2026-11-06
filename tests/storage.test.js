import test from 'node:test';
import assert from 'node:assert/strict';
import { createTournament, autoPlay, mulberry32, champion } from '../src/lib/engine.js';
import { encodeShare, decodeShare, toCompact, fromCompact } from '../src/lib/storage.js';
import { computeLayout, CARD_W, CARD_H } from '../src/lib/layout.js';

const names = (n) => Array.from({ length: n }, (_, i) => `Jugador ñ${i + 1}`);

test('compartir: ida y vuelta conserva resultados (todos los formatos)', async () => {
  for (const format of ['single', 'double', 'roundrobin', 'swiss']) {
    const base = createTournament({ format, names: names(9), settings: { bestOf: 3 } });
    const played = autoPlay(base, { rng: mulberry32(11) });
    const code = await encodeShare(played);
    const back = await decodeShare(code);
    assert.equal(back.matches.length, played.matches.length, format);
    assert.deepEqual(toCompact(back), toCompact(played), format);
    if (format === 'single' || format === 'double') assert.equal(champion(back), champion(played));
  }
});

test('el enlace de 64 jugadores en doble eliminación sigue siendo corto', async () => {
  const t = autoPlay(createTournament({ format: 'double', names: names(64) }), { rng: mulberry32(2) });
  const code = await encodeShare(t);
  assert.ok(code.length < 4000, `longitud ${code.length}`);
});

test('datos inválidos se rechazan', async () => {
  await assert.rejects(() => decodeShare('xabc'));
  assert.throws(() => fromCompact({ v: 2 }));
  assert.throws(() => fromCompact({ v: 1, f: 'single', p: ['solo uno'] }));
});

test('layout: sin solapamientos y líneas dentro del lienzo', () => {
  for (const [format, n] of [['single', 13], ['double', 13], ['double', 32]]) {
    const t = createTournament({ format, names: names(n), settings: { thirdPlace: true } });
    const L = computeLayout(t);
    for (let i = 0; i < L.nodes.length; i++) {
      const a = L.nodes[i];
      assert.ok(a.x + CARD_W <= L.width && a.y >= 0 && a.y + CARD_H <= L.height, `${format} ${a.m.id} fuera`);
      for (let j = i + 1; j < L.nodes.length; j++) {
        const b = L.nodes[j];
        const overlap = a.x === b.x && Math.abs(a.y - b.y) < CARD_H;
        assert.ok(!overlap, `${format} n=${n}: ${a.m.id} se solapa con ${b.m.id}`);
      }
    }
  }
});

test('layout doble eliminación: Grand Finals a la derecha, conectada con ambas finales', () => {
  for (const n of [3, 4, 8, 13, 32]) {
    const t = createTournament({ format: 'double', names: names(n) });
    const L = computeLayout(t);
    const gf = L.nodes.find((x) => x.m.id === 'GF-1');
    assert.ok(gf, `n=${n} falta GF-1`);
    assert.ok(L.nodes.find((x) => x.m.id === 'GF-2'), `n=${n} falta GF-2`);
    const others = L.nodes.filter((x) => x.m.bracket === 'W' || x.m.bracket === 'L');
    assert.ok(others.every((x) => x.x + CARD_W < gf.x), `n=${n} GF no está a la derecha`);
    const into = L.lines.filter((l) => l.to === 'GF-1');
    assert.equal(into.length, 2, `n=${n} conectores a GF-1`);
    const ys = into.map((l) => l.y1);
    assert.ok(gf.y + CARD_H / 2 >= Math.min(...ys) && gf.y + CARD_H / 2 <= Math.max(...ys));
    assert.ok(L.headers.some((h) => h.label === 'Grand Finals'));
  }
});

import { swapSlots, slotOf } from '../src/lib/engine.js';

test('compartir conserva los jugadores movidos a mano y sus resultados', async () => {
  let t = createTournament({ format: 'double', names: names(7) });
  t = swapSlots(t, slotOf(t, 'p2'), slotOf(t, 'p7'));
  t = swapSlots(t, slotOf(t, 'p4'), 'W1-1:b');
  const played = autoPlay(t, { rng: mulberry32(9) });
  const back = await decodeShare(await encodeShare(played));
  assert.deepEqual(back.matches.map((m) => [m.id, m.a, m.b, m.scoreA, m.scoreB]), played.matches.map((m) => [m.id, m.a, m.b, m.scoreA, m.scoreB]));
  assert.equal(champion(back), champion(played));
});

import { setDQ, setScore, isDQ } from '../src/lib/engine.js';

test('compartir conserva descalificaciones y resultados jugados antes del DQ', async () => {
  let t = createTournament({ format: 'double', names: names(6), settings: { bestOfEarly: 1, bestOfLate: 1 } });
  t = setScore(t, 'W1-1', 1, 0); // se juega algo
  const jugador = t.matches.find((m) => m.id === 'W1-1').winner;
  t = setDQ(t, jugador); // y luego lo descalifican: su victoria ya jugada debe sobrevivir
  t = setDQ(t, 'p6');
  const played = autoPlay(t, { rng: mulberry32(5) });
  const back = await decodeShare(await encodeShare(played));
  assert.deepEqual(back.dq.sort(), played.dq.sort());
  assert.ok(isDQ(back, jugador));
  assert.deepEqual(
    back.matches.map((m) => [m.id, m.a, m.b, m.scoreA, m.scoreB, m.forfeit, m.status]),
    played.matches.map((m) => [m.id, m.a, m.b, m.scoreA, m.scoreB, m.forfeit, m.status]),
  );
  assert.equal(champion(back), champion(played));
});

test('enlaces/archivos con el formato anterior (un solo bestOf) siguen abriendo', () => {
  const viejo = { v: 1, n: 'Viejo', f: 'single', s: { bestOf: 1, thirdPlace: false }, p: ['A', 'B', 'C', 'D'], r: [['W1-1', 1, 0]] };
  const t = fromCompact(viejo);
  assert.ok(t.matches.every((m) => m.bo === 1));
  assert.equal(t.matches.find((m) => m.id === 'W1-1').status, 'done');
  const nuevo = fromCompact({ v: 1, n: 'Nuevo', f: 'single', s: { bestOfEarly: 5, bestOfLate: 7, lateFrom: 'semis' }, p: names(8) });
  assert.equal(nuevo.matches.find((m) => m.id === 'W1-1').bo, 5);
  assert.equal(nuevo.matches.find((m) => m.id === 'W3-1').bo, 7);
  // valores inválidos caen al valor por defecto
  const raro = fromCompact({ v: 1, n: 'X', f: 'single', s: { bestOfEarly: 4, lateFrom: 'nada' }, p: names(4) });
  assert.equal(raro.settings.bestOfEarly, 3);
  assert.equal(raro.settings.lateFrom, 'quarters');
});
