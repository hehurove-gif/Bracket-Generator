import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolve, shuffle, createTournament, seedOrder, setScore, autoPlay, mulberry32, standings, champion, podium,
  isFinished, swissCanAdvance, swissNextRound, resetResults, progress, validate, BYE,
} from '../src/lib/engine.js';

const names = (n) => Array.from({ length: n }, (_, i) => `J${i + 1}`);
// Los tests de lógica usan Bo1 (un marcador 1-0 decide) salvo que pidan otra cosa; los de Bo por etapa usan makeDefault.
const make = (format, n, settings) => createTournament({ format, names: names(n), settings: { bestOfEarly: 1, bestOfLate: 1, ...settings } });
const makeDefault = (format, n, settings) => createTournament({ format, names: names(n), settings });
const seedOf = (t, id) => t.players.findIndex((p) => p.id === id) + 1;

test('seedOrder estándar', () => {
  assert.deepEqual(seedOrder(4), [1, 4, 2, 3]);
  assert.deepEqual(seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  assert.deepEqual(seedOrder(16).slice(0, 4), [1, 16, 8, 9]);
});

test('validaciones por formato', () => {
  assert.ok(validate('double', 2));
  assert.equal(validate('single', 2), null);
  assert.ok(validate('swiss', 3));
  assert.ok(validate('single', 500));
});

test('eliminación simple 8: 7 partidos, gana el seed 1 sin sorpresas', () => {
  let t = make('single', 8);
  assert.equal(t.matches.length, 7);
  t = autoPlay(t, { rng: mulberry32(1), upsets: 0 });
  assert.ok(isFinished(t));
  assert.equal(seedOf(t, champion(t)), 1);
});

test('eliminación simple con BYEs: los mejores seeds descansan', () => {
  const t = make('single', 5);
  const byes = t.matches.filter((m) => m.status === 'bye');
  assert.equal(byes.length, 3);
  const withBye = byes.map((m) => seedOf(t, m.winner)).sort();
  assert.deepEqual(withBye, [1, 2, 3]);
  const done = autoPlay(t, { rng: mulberry32(7) });
  assert.ok(isFinished(done));
  assert.ok(champion(done));
});

test('todos los tamaños de eliminación simple terminan', () => {
  for (let n = 2; n <= 33; n++) {
    const t = autoPlay(make('single', n), { rng: mulberry32(n) });
    assert.ok(isFinished(t), `n=${n}`);
    const real = t.matches.filter((m) => m.status === 'done').length;
    assert.equal(real, n - 1, `n=${n} debe tener n-1 partidos reales`);
  }
});

test('partido por el 3er lugar', () => {
  const t = autoPlay(make('single', 8, { thirdPlace: true }), { rng: mulberry32(3) });
  assert.ok(t.matches.find((m) => m.id === '3P-1').status === 'done');
  assert.equal(podium(t).length, 3);
});

test('doble eliminación 8: 15 partidos (con reset)', () => {
  const t = make('double', 8);
  assert.equal(t.matches.length, 15);
  assert.equal(t.matches.filter((m) => m.bracket === 'L').length, 6);
});

test('doble eliminación: sin sorpresas gana el seed 1 y no hay reset', () => {
  const t = autoPlay(make('double', 8), { rng: mulberry32(5), upsets: 0 });
  assert.ok(isFinished(t));
  assert.equal(seedOf(t, champion(t)), 1);
  assert.equal(t.matches.find((m) => m.id === 'GF-2').status, 'skipped');
});

test('doble eliminación: todo jugador eliminado pierde exactamente 2 veces', () => {
  for (const n of [3, 4, 5, 6, 7, 8, 9, 12, 16, 17, 25]) {
    for (let seed = 1; seed <= 6; seed++) {
      const t = autoPlay(make('double', n), { rng: mulberry32(seed * 31 + n), upsets: 0.8 });
      assert.ok(isFinished(t), `n=${n} seed=${seed} debe terminar`);
      const losses = new Map(t.players.map((p) => [p.id, 0]));
      t.matches.filter((m) => m.status === 'done').forEach((m) => losses.set(m.loser, losses.get(m.loser) + 1));
      const champ = champion(t);
      for (const [id, l] of losses) {
        if (id === champ) assert.ok(l <= 1, `n=${n} campeón con ${l} derrotas`);
        else assert.equal(l, 2, `n=${n} seed=${seed} ${id} con ${l} derrotas`);
      }
    }
  }
});

test('doble eliminación: si gana losers en la final se juega el reset', () => {
  let t = make('double', 4);
  // W: 1v4, 2v3 -> gana 1 y 2; final W: 1 gana. Losers: 4v3 -> gana 3; 3 vs perdedor de la final (2) -> gana 3. GF: 1 vs 3.
  const win = (id, a = true) => { t = setScore(t, id, a ? 1 : 0, a ? 0 : 1); };
  win('W1-1'); win('W1-2'); win('W2-1');
  win('L1-1'); win('L2-1');
  const gf = t.matches.find((m) => m.id === 'GF-1');
  assert.equal(gf.status, 'ready');
  win('GF-1', false); // gana el de losers
  assert.equal(t.matches.find((m) => m.id === 'GF-2').status, 'ready');
  assert.equal(champion(t), null);
  win('GF-2', true);
  assert.ok(champion(t));
  assert.ok(isFinished(t));
});

test('corregir un resultado anterior limpia lo que dependía de él', () => {
  let t = make('single', 4);
  t = setScore(t, 'W1-1', 1, 0);
  t = setScore(t, 'W1-2', 1, 0);
  t = setScore(t, 'W2-1', 1, 0);
  assert.ok(champion(t));
  t = setScore(t, 'W1-1', 0, 1); // ahora gana el seed 4
  const f = t.matches.find((m) => m.id === 'W2-1');
  assert.equal(f.status, 'ready');
  assert.equal(f.scoreA, null);
  assert.equal(champion(t), null);
});

test('mejor de 3: 1-0 no decide, 2-0 sí; empate no vale en eliminación', () => {
  let t = make('single', 2, { bestOfEarly: 3, bestOfLate: 3 });
  t = setScore(t, 'W1-1', 1, 0);
  assert.equal(t.matches[0].status, 'ready');
  t = setScore(t, 'W1-1', 1, 1);
  assert.equal(t.matches[0].status, 'ready');
  t = setScore(t, 'W1-1', 2, 1);
  assert.equal(t.matches[0].status, 'done');
});

test('no se puede puntuar un partido pendiente ni un BYE', () => {
  let t = make('single', 3);
  const before = JSON.stringify(t);
  t = setScore(t, 'W2-1', 1, 0);
  assert.equal(JSON.stringify(t), before);
  const bye = t.matches.find((m) => m.status === 'bye');
  assert.equal(JSON.stringify(setScore(t, bye.id, 1, 0)), before);
});

test('round robin: n(n-1)/2 partidos y cada par se juega una vez', () => {
  for (const n of [2, 3, 4, 5, 8, 9]) {
    const t = make('roundrobin', n);
    assert.equal(t.matches.length, (n * (n - 1)) / 2, `n=${n}`);
    const pairs = new Set(t.matches.map((m) => [m.a, m.b].sort().join('|')));
    assert.equal(pairs.size, t.matches.length);
  }
  assert.equal(make('roundrobin', 4, { doubleRoundRobin: true }).matches.length, 12);
});

test('round robin: tabla ordenada por puntos y seed 1 primero sin sorpresas', () => {
  const t = autoPlay(make('roundrobin', 6), { rng: mulberry32(2), upsets: 0 });
  const st = standings(t);
  assert.equal(st[0].seed, 1);
  assert.equal(st[0].points, 15);
  assert.ok(isFinished(t));
  for (let i = 1; i < st.length; i++) assert.ok(st[i - 1].points >= st[i].points);
});

test('round robin con empates', () => {
  let t = make('roundrobin', 3, { allowDraw: true });
  t = setScore(t, t.matches[0].id, 2, 2);
  assert.equal(t.matches[0].status, 'done');
  assert.equal(t.matches[0].draw, true);
  const st = standings(t);
  assert.equal(st.reduce((s, r) => s + r.draws, 0), 2);
  assert.equal(st.reduce((s, r) => s + r.points, 0), 2);
});

test('suizo: rondas automáticas, sin revanchas y bye distinto cada ronda', () => {
  for (const n of [4, 7, 8, 9, 16]) {
    let t = make('swiss', n);
    const rng = mulberry32(n);
    t = autoPlay(t, { rng, upsets: 0.5 });
    assert.ok(isFinished(t), `n=${n}`);
    const rounds = Math.max(...t.matches.map((m) => m.round));
    assert.equal(rounds, t.settings.swissRounds);
    const seen = new Set();
    let rematch = 0;
    for (const m of t.matches.filter((x) => x.status === 'done')) {
      const k = [m.a, m.b].sort().join('|');
      if (seen.has(k)) rematch++;
      seen.add(k);
    }
    assert.equal(rematch, 0, `n=${n} sin revanchas`);
    const byes = t.matches.filter((m) => m.status === 'bye').map((m) => m.winner);
    assert.equal(new Set(byes).size, byes.length, `n=${n} bye repetido`);
  }
});

test('suizo: la siguiente ronda solo se genera cuando termina la actual', () => {
  let t = make('swiss', 8);
  assert.equal(swissCanAdvance(t), false);
  t.matches.forEach((m) => { t = setScore(t, m.id, 1, 0); });
  assert.equal(swissCanAdvance(t), true);
  t = swissNextRound(t);
  assert.equal(t.matches.filter((m) => m.round === 2).length, 4);
  assert.equal(swissCanAdvance(t), false);
});

test('reiniciar resultados', () => {
  let t = autoPlay(make('double', 6), { rng: mulberry32(4) });
  t = resetResults(t);
  assert.equal(progress(t).done, 0);
  assert.equal(champion(t), null);
  let s = autoPlay(make('swiss', 8), { rng: mulberry32(4) });
  s = resetResults(s);
  assert.ok(s.matches.every((m) => m.round === 1));
});

test('el nombre queda recortado y se ignoran nombres vacíos', () => {
  const t = createTournament({ format: 'single', names: [' Ana ', '', '  ', 'Beto'], name: '  ' });
  assert.equal(t.players.length, 2);
  assert.equal(t.players[0].name, 'Ana');
  assert.equal(t.name, 'Torneo');
  assert.throws(() => createTournament({ format: 'double', names: ['a', 'b'] }));
  assert.equal(BYE, 'BYE');
});

import { swapSlots, slotOf, playerAt, slotOverrides, applyOverrides, setDQ, isDQ, arrangementOrder } from '../src/lib/engine.js';

test('swapSlots: intercambia dos jugadores y reinicia lo que dependía de ellos', () => {
  let t = make('single', 8);
  t = autoPlay(t, { rng: mulberry32(1), upsets: 0 });
  assert.ok(champion(t));
  const k1 = slotOf(t, 'p1');
  const k4 = slotOf(t, 'p4');
  const s = swapSlots(t, k1, k4);
  assert.equal(playerAt(s, k1), 'p4');
  assert.equal(playerAt(s, k4), 'p1');
  assert.equal(slotOf(s, 'p1'), k4);
  assert.equal(champion(s), null, 'el campeón anterior ya no es válido');
  assert.ok(progress(s).done < progress(t).done);
  // Volver a jugar termina normalmente
  assert.ok(isFinished(autoPlay(s, { rng: mulberry32(2) })));
});

test('swapSlots: partidos no afectados conservan su resultado', () => {
  let t = make('single', 8);
  t = setScore(t, 'W1-1', 1, 0); // 1 vs 8
  t = setScore(t, 'W1-3', 1, 0); // 2 vs 7
  const s = swapSlots(t, slotOf(t, 'p4'), slotOf(t, 'p5')); // W1-2 no tiene resultado
  assert.equal(s.matches.find((m) => m.id === 'W1-1').status, 'done');
  assert.equal(s.matches.find((m) => m.id === 'W1-3').status, 'done');
});

test('swapSlots: mover a alguien a un lugar de BYE', () => {
  let t = make('single', 5); // seeds 1,2,3 con BYE
  const byeKey = t.matches.find((m) => m.id === 'W1-1').srcB.t === 'bye' ? 'W1-1:b' : null;
  assert.equal(byeKey, 'W1-1:b');
  const s = swapSlots(t, slotOf(t, 'p5'), byeKey); // p5 toma el BYE de p1
  assert.equal(playerAt(s, byeKey), 'p5');
  assert.equal(s.matches.find((m) => m.id === 'W1-2').srcB.t, 'bye', 'el lugar de p5 ahora es BYE');
  const done = autoPlay(s, { rng: mulberry32(3) });
  assert.ok(isFinished(done));
  assert.equal(done.matches.filter((m) => m.status === 'done').length, 4);
});

test('swapSlots: no hace nada con BYE↔BYE, casillas inválidas ni round robin', () => {
  const t = make('single', 5);
  const same = JSON.stringify(t);
  assert.equal(JSON.stringify(swapSlots(t, 'W1-1:b', 'W1-3:b')), same);
  assert.equal(JSON.stringify(swapSlots(t, 'W1-1:a', 'W9-9:a')), same);
  assert.equal(JSON.stringify(swapSlots(t, 'W2-1:a', 'W1-1:a')), same, 'las casillas de rondas siguientes no se mueven');
  const rr = make('roundrobin', 4);
  assert.equal(swapSlots(rr, 'R1-1:a', 'R1-2:a'), rr);
});

test('swapSlots al azar: single y double siempre terminan y respetan las reglas', () => {
  for (const format of ['single', 'double']) {
    for (const n of [3, 5, 6, 7, 11]) {
      for (let seed = 1; seed <= 8; seed++) {
        const rng = mulberry32(seed * 97 + n);
        let t = make(format, n);
        const slots = t.matches.flatMap((m) => ['a', 'b'].filter((s) => ['p', 'bye'].includes(m[s === 'a' ? 'srcA' : 'srcB']?.t)).map((s) => `${m.id}:${s}`));
        for (let i = 0; i < 6; i++) t = swapSlots(t, slots[Math.floor(rng() * slots.length)], slots[Math.floor(rng() * slots.length)]);
        t = autoPlay(t, { rng, upsets: 0.7 });
        assert.ok(isFinished(t), `${format} n=${n} seed=${seed}`);
        const champ = champion(t);
        assert.ok(champ, `${format} n=${n} seed=${seed} sin campeón`);
        const losses = new Map(t.players.map((p) => [p.id, 0]));
        t.matches.filter((m) => m.status === 'done').forEach((m) => losses.set(m.loser, losses.get(m.loser) + 1));
        const maxLoss = format === 'single' ? 1 : 2;
        for (const [id, l] of losses) {
          if (id === champ) assert.ok(l <= maxLoss - 1, `${format} n=${n} campeón con ${l} derrotas`);
          else assert.equal(l, maxLoss, `${format} n=${n} seed=${seed} ${id}`);
        }
      }
    }
  }
});

test('overrides: ida y vuelta de los jugadores movidos', () => {
  let t = make('double', 6);
  t = swapSlots(t, slotOf(t, 'p3'), slotOf(t, 'p6'));
  t = swapSlots(t, slotOf(t, 'p5'), 'W1-1:b');
  const ov = slotOverrides(t);
  assert.ok(ov.length >= 4);
  const back = applyOverrides(make('double', 6), ov);
  assert.deepEqual(back.matches.map((m) => [m.a, m.b]), t.matches.map((m) => [m.a, m.b]));
  assert.deepEqual(slotOverrides(make('double', 6)), []);
  assert.throws(() => applyOverrides(make('double', 6), [['W1-1', 'a', 'p9']]));
  assert.throws(() => applyOverrides(make('double', 6), [['W1-1', 'a', 'p2']]), /inválido/, 'jugador repetido');
});


/* ---------- Bo por etapa ---------- */

const boOf = (t, id) => t.matches.find((m) => m.id === id).bo;

test('Bo por defecto: Bo3 en rondas iniciales y Bo5 desde cuartos (16 jugadores)', () => {
  const t = makeDefault('single', 16);
  assert.equal(t.settings.bestOfEarly, 3);
  assert.equal(t.settings.bestOfLate, 5);
  assert.equal(boOf(t, 'W1-1'), 3, 'ronda de 16');
  assert.equal(boOf(t, 'W2-1'), 5, 'cuartos');
  assert.equal(boOf(t, 'W3-1'), 5, 'semifinal');
  assert.equal(boOf(t, 'W4-1'), 5, 'final');
});

test('Bo por defecto: nunca toda la bracket es avanzada (8 y 4 jugadores)', () => {
  const t8 = makeDefault('single', 8);
  assert.equal(boOf(t8, 'W1-1'), 3, 'los cuartos de un bracket de 8 son iniciales');
  assert.equal(boOf(t8, 'W2-1'), 5);
  assert.equal(boOf(t8, 'W3-1'), 5);
  const t4 = makeDefault('single', 4);
  assert.equal(boOf(t4, 'W1-1'), 3);
  assert.equal(boOf(t4, 'W2-1'), 5);
});

test('Bo: lateFrom semis/final y 3er lugar', () => {
  const semis = makeDefault('single', 16, { lateFrom: 'semis', thirdPlace: true });
  assert.deepEqual(['W1-1', 'W2-1', 'W3-1', 'W4-1', '3P-1'].map((id) => boOf(semis, id)), [3, 3, 5, 5, 5]);
  const fin = makeDefault('single', 16, { lateFrom: 'final' });
  assert.deepEqual(['W1-1', 'W2-1', 'W3-1', 'W4-1'].map((id) => boOf(fin, id)), [3, 3, 3, 5]);
  const bo7 = makeDefault('single', 16, { bestOfLate: 7 });
  assert.equal(boOf(bo7, 'W4-1'), 7);
});

test('Bo en doble eliminación: losers avanzadas, Grand Finals y reset siempre avanzadas', () => {
  const t = makeDefault('double', 16);
  assert.equal(boOf(t, 'W1-1'), 3);
  assert.equal(boOf(t, 'W2-1'), 5);
  assert.equal(boOf(t, 'L1-1'), 3);
  assert.equal(boOf(t, 'L2-1'), 3);
  assert.equal(boOf(t, 'L3-1'), 5);
  assert.equal(boOf(t, 'L6-1'), 5, 'final de losers');
  assert.equal(boOf(t, 'GF-1'), 5);
  assert.equal(boOf(t, 'GF-2'), 5);
  const small = makeDefault('double', 4, { bestOfLate: 7 });
  assert.equal(boOf(small, 'W1-1'), 3);
  assert.equal(boOf(small, 'L1-1'), 3);
  assert.equal(boOf(small, 'L2-1'), 7);
  assert.equal(boOf(small, 'GF-1'), 7);
});

test('Bo en round robin y suizo: siempre bestOfEarly', () => {
  for (const f of ['roundrobin', 'swiss']) {
    const t = makeDefault(f, 6, { bestOfEarly: 5, bestOfLate: 7 });
    assert.ok(t.matches.every((m) => m.bo === 5), f);
  }
});

test('Bo: cada partido pide sus propias victorias (Bo3 = 2, Bo5 = 3)', () => {
  let t = makeDefault('single', 8);
  assert.equal(boOf(t, 'W1-1'), 3);
  t = setScore(t, 'W1-1', 1, 0);
  assert.equal(t.matches.find((m) => m.id === 'W1-1').status, 'ready');
  t = setScore(t, 'W1-1', 2, 1);
  assert.equal(t.matches.find((m) => m.id === 'W1-1').status, 'done');
  t = setScore(t, 'W1-2', 2, 0); t = setScore(t, 'W1-3', 2, 0); t = setScore(t, 'W1-4', 2, 0);
  t = setScore(t, 'W2-1', 2, 0); // semifinal Bo5: 2-0 aún no decide
  assert.equal(t.matches.find((m) => m.id === 'W2-1').status, 'ready');
  t = setScore(t, 'W2-1', 3, 1);
  assert.equal(t.matches.find((m) => m.id === 'W2-1').status, 'done');
});

test('Bo: autoPlay respeta el Bo de cada partido', () => {
  const t = autoPlay(makeDefault('double', 8), { rng: mulberry32(3) });
  for (const m of t.matches.filter((x) => x.status === 'done')) {
    assert.equal(Math.max(m.scoreA, m.scoreB), Math.ceil(m.bo / 2), `${m.id} Bo${m.bo} ${m.scoreA}-${m.scoreB}`);
  }
});

test('Bo: compatibilidad con ajustes y torneos guardados con un solo bestOf', () => {
  const viejo = createTournament({ format: 'single', names: names(4), settings: { bestOf: 1 } });
  assert.ok(viejo.matches.every((m) => m.bo === 1));
  assert.equal(viejo.settings.bestOf, undefined);
  // un torneo guardado antes del cambio: sin `bo` en los partidos y con settings.bestOf
  const guardado = JSON.parse(JSON.stringify(make('single', 4)));
  guardado.matches.forEach((m) => delete m.bo);
  delete guardado.settings.bestOfEarly; delete guardado.settings.bestOfLate;
  guardado.settings.bestOf = 3;
  const t = resolve(guardado);
  assert.ok(t.matches.every((m) => m.bo === 3));
  assert.equal(setScore(t, 'W1-1', 2, 0).matches.find((m) => m.id === 'W1-1').status, 'done');
});

/* ---------- DQ ---------- */

const matchOf = (t, id) => t.matches.find((m) => m.id === id);

test('DQ antes de empezar: el rival avanza por forfeit y aparece marcado', () => {
  let t = make('single', 4);
  t = setDQ(t, 'p2');
  assert.ok(isDQ(t, 'p2'));
  const m = matchOf(t, 'W1-2'); // p2 vs p3
  assert.equal(m.status, 'done');
  assert.equal(m.forfeit, 'a');
  assert.equal(m.winner, 'p3');
  assert.equal(m.scoreA, null);
  assert.equal(matchOf(t, 'W2-1').b, 'p3', 'p3 ya está en la final');
});

test('DQ no pisa un resultado ya jugado, pero sí los partidos que faltan', () => {
  let t = make('single', 4);
  t = setScore(t, 'W1-1', 1, 0); // p1 gana
  t = setScore(t, 'W1-2', 1, 0); // p2 gana
  t = setDQ(t, 'p2');
  assert.equal(matchOf(t, 'W1-2').forfeit, null, 'su victoria anterior se conserva');
  assert.equal(matchOf(t, 'W1-2').scoreA, 1);
  const f = matchOf(t, 'W2-1'); // p1 vs p2 (DQ)
  assert.equal(f.forfeit, 'b');
  assert.equal(f.winner, 'p1');
  assert.equal(champion(t), 'p1');
  assert.ok(isFinished(t));
});

test('DQ desde un partido con marcador parcial: se pierde ese partido', () => {
  let t = make('single', 4, { bestOfEarly: 3, bestOfLate: 3 });
  t = setScore(t, 'W1-1', 1, 0);
  t = setDQ(t, 'p4', true, 'W1-1');
  const m = matchOf(t, 'W1-1');
  assert.equal(m.forfeit, 'b');
  assert.equal(m.winner, 'p1');
  assert.equal(m.scoreA, null, 'se descarta el marcador parcial');
});

test('Reincorporar: se deshacen los forfeits y lo que dependía de ellos', () => {
  let t = make('single', 4);
  t = setDQ(t, 'p2');
  t = setScore(t, 'W1-1', 1, 0);
  t = setScore(t, 'W2-1', 1, 0);
  assert.ok(champion(t));
  t = setDQ(t, 'p2', false);
  assert.ok(!isDQ(t, 'p2'));
  assert.equal(matchOf(t, 'W1-2').status, 'ready');
  assert.equal(matchOf(t, 'W2-1').status, 'pending');
  assert.equal(matchOf(t, 'W2-1').scoreA, null, 'la final se reinicia');
  assert.equal(champion(t), null);
});

test('DQ: en doble eliminación el campeón nunca es un descalificado y el torneo termina', () => {
  for (const n of [3, 4, 5, 8, 11, 16]) {
    for (let seed = 1; seed <= 6; seed++) {
      const rng = mulberry32(seed * 131 + n);
      let t = makeDefault('double', n);
      const ids = t.players.map((p) => p.id);
      const quitados = shuffle(ids, rng).slice(0, Math.min(3, n - 1));
      for (const id of quitados) t = setDQ(t, id);
      t = autoPlay(t, { rng, upsets: 0.6 });
      assert.ok(isFinished(t), `n=${n} seed=${seed}`);
      const champ = champion(t);
      assert.ok(champ && !isDQ(t, champ), `n=${n} seed=${seed} campeón ${champ}`);
      // un descalificado no deja marcador en los forfeits
      for (const m of t.matches.filter((x) => x.forfeit)) assert.equal(m.scoreA, null);
    }
  }
});

test('DQ en round robin: sus partidos pendientes son forfeit y queda al final de la tabla', () => {
  let t = make('roundrobin', 4);
  t = setScore(t, 'R1-1', 1, 0);
  const jugado = matchOf(t, 'R1-1');
  const dqId = jugado.a;
  t = setDQ(t, dqId);
  t = autoPlay(t, { rng: mulberry32(1) });
  assert.ok(isFinished(t));
  const st = standings(t);
  assert.equal(st[st.length - 1].id, dqId);
  assert.equal(st[st.length - 1].dq, true);
  assert.equal(matchOf(t, 'R1-1').forfeit, null, 'su resultado previo se conserva');
  assert.equal(matchOf(t, 'R1-1').winner, dqId);
});

test('DQ en suizo: ya no se le empareja en las rondas siguientes', () => {
  let t = make('swiss', 8);
  t = setDQ(t, 'p3');
  t = autoPlay(t, { rng: mulberry32(2) });
  assert.ok(isFinished(t));
  const apareado = t.matches.filter((m) => m.round >= 2 && (m.a === 'p3' || m.b === 'p3'));
  assert.equal(apareado.length, 0);
  assert.equal(standings(t).at(-1).id, 'p3');
});

test('DQ: ids desconocidos se ignoran y reiniciar resultados quita los DQ', () => {
  let t = make('single', 4);
  assert.equal(setDQ(t, 'p99'), t);
  t = setDQ(t, 'p1');
  t = resetResults(t);
  assert.deepEqual(t.dq, []);
  assert.equal(matchOf(t, 'W1-1').forfeit, null);
});

/* ---------- orden para editar ---------- */

test('arrangementOrder: recrear con ese orden reproduce el acomodo movido a mano', () => {
  for (const format of ['single', 'double']) {
    for (const n of [4, 6, 8, 11]) {
      let t = make(format, n);
      t = swapSlots(t, slotOf(t, 'p1'), slotOf(t, 'p2'));
      t = swapSlots(t, slotOf(t, 'p3'), slotOf(t, 'p4'));
      const { names: orden, exact } = arrangementOrder(t);
      assert.ok(exact, `${format} n=${n}`);
      const rec = createTournament({ format, names: orden, settings: t.settings });
      const quien = (x, id) => x.players.find((p) => p.id === id)?.name;
      const a = t.matches.filter((m) => m.round === 1 && m.bracket === 'W').map((m) => [quien(t, m.a) ?? m.a, quien(t, m.b) ?? m.b]);
      const b = rec.matches.filter((m) => m.round === 1 && m.bracket === 'W').map((m) => [quien(rec, m.a) ?? m.a, quien(rec, m.b) ?? m.b]);
      assert.deepEqual(b, a, `${format} n=${n}`);
    }
  }
});

test('arrangementOrder: sin cambios devuelve el mismo orden; mover a un BYE no es exacto', () => {
  const t = make('single', 6);
  assert.deepEqual(arrangementOrder(t), { names: names(6), exact: true });
  const movido = swapSlots(t, slotOf(t, 'p6'), 'W1-1:b');
  assert.equal(arrangementOrder(movido).exact, false);
  assert.deepEqual(arrangementOrder(make('roundrobin', 4)).names, names(4));
});
