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
