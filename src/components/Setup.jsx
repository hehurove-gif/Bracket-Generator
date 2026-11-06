import { useDeferredValue, useMemo, useState } from 'react';
import { BEST_OF_OPTIONS, DEFAULT_SETTINGS, FORMATS, MAX_PLAYERS, MIN_PLAYERS, autoPlay, createTournament, mulberry32, shuffle, swissRoundCount, validate } from '../lib/engine.js';
import { FORMAT_DESC, FORMAT_LABEL, isElimination, playerColor } from '../lib/helpers.js';
import TournamentBody from './TournamentBody.jsx';

const linesOf = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean);

const LATE_LABEL = { quarters: 'Cuartos de final (Top 8)', semis: 'Semifinales (Top 4)', final: 'Solo la final' };

/* Ajustes con los que arranca la pantalla. Al editar vienen del torneo: se normalizan los de versiones
   anteriores (un solo bestOf) y las rondas del suizo vuelven a "Automático" si eran las automáticas. */
function initialSettings(s, playerCount) {
  const base = { ...DEFAULT_SETTINGS, ...(s ?? {}) };
  if (s && s.bestOf != null && s.bestOfEarly == null && BEST_OF_OPTIONS.includes(s.bestOf)) {
    base.bestOfEarly = s.bestOf;
    base.bestOfLate = s.bestOf;
  }
  delete base.bestOf;
  if (!BEST_OF_OPTIONS.includes(base.bestOfEarly)) base.bestOfEarly = DEFAULT_SETTINGS.bestOfEarly;
  if (!BEST_OF_OPTIONS.includes(base.bestOfLate)) base.bestOfLate = DEFAULT_SETTINGS.bestOfLate;
  if (base.swissRounds === swissRoundCount(playerCount)) base.swissRounds = 0;
  return base;
}

function Check({ label, checked, onChange, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-cyan-400" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

/* Sin `initial` crea un torneo nuevo. Con `initial` ({ name, format, names, settings, notExact }) edita uno existente:
   la lista ya viene en el orden que reproduce el acomodo actual del bracket. `warning` avisa si guardar borra avance. */
export default function Setup({ onSubmit, onCancel, initial = null, warning = null }) {
  const editing = !!initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [format, setFormat] = useState(initial?.format ?? 'single');
  const [text, setText] = useState(initial ? initial.names.join('\n') : '');
  const [settings, setSettings] = useState(() => initialSettings(initial?.settings, initial?.names.length ?? 0));
  const [newName, setNewName] = useState('');
  const [simulate, setSimulate] = useState(false);
  const [upsets, setUpsets] = useState(0.35);
  const [simSeed, setSimSeed] = useState(1);
  const [dragFrom, setDragFrom] = useState(null);

  const names = linesOf(text);
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const setNames = (arr) => setText(arr.join('\n'));
  const move = (i, j) => {
    if (j < 0 || j >= names.length) return;
    const a = [...names];
    const [x] = a.splice(i, 1);
    a.splice(j, 0, x);
    setNames(a);
  };

  const deferred = useDeferredValue(names.join('\n'));
  const error = validate(format, names.length);

  const preview = useMemo(() => {
    const list = linesOf(deferred);
    if (validate(format, list.length)) return null;
    try {
      let t = createTournament({ name, format, names: list, settings });
      if (simulate) t = autoPlay(t, { rng: mulberry32(simSeed), upsets });
      return t;
    } catch {
      return null;
    }
  }, [deferred, format, settings, simulate, upsets, simSeed, name]);

  // Arrastrar un jugador del bracket sobre otro intercambia sus seeds (y por tanto sus cruces).
  const swapSeeds = ({ fromPlayer, toPlayer }) => {
    if (!toPlayer) return;
    const i = Number(fromPlayer.slice(1)) - 1;
    const j = Number(toPlayer.slice(1)) - 1;
    if (!names[i] || !names[j] || i === j) return;
    const a = [...names];
    [a[i], a[j]] = [a[j], a[i]];
    setNames(a);
  };

  const addPlayer = () => {
    const n = newName.trim();
    if (!n || names.length >= MAX_PLAYERS) return;
    setNames([...names, n]);
    setNewName('');
  };

  const submit = () => {
    if (error) return;
    if (warning && !window.confirm(`${warning}\n\n¿Guardar de todos modos?`)) return;
    onSubmit(createTournament({ name, format, names, settings }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="space-y-5">
        {editing && (
          <div className="card space-y-2 border-cyan-400/30">
            <p className="font-mono text-sm text-cyan-300">Editando torneo</p>
            <p className="text-xs text-slate-400">
              Agrega o quita jugadores, cambia el seeding (arrastra en la lista o en el bracket de la derecha) o el formato.
              Al guardar se vuelve a armar el bracket.
            </p>
            {initial.notExact && (
              <p className="text-xs text-amber-300">
                Habías movido a alguien a un lugar de BYE: ese cambio no se puede conservar al editar y se vuelve al orden de seeds.
              </p>
            )}
            {warning && <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">{warning}</p>}
          </div>
        )}
        <div className="card space-y-4">
          <div>
            <label className="label" htmlFor="t-name">Nombre del torneo</label>
            <input id="t-name" className="field" value={name} maxLength={80} placeholder="Ej. Smash del viernes" onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <span className="label">Formato</span>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map((f) => (
                <button key={f} type="button" onClick={() => setFormat(f)} aria-pressed={format === f} className={`rounded-xl border p-2.5 text-left text-sm transition ${format === f ? 'border-cyan-400 bg-cyan-400/10' : 'border-slate-800 hover:border-slate-600'}`}>
                  <span className="block font-semibold">{FORMAT_LABEL[f]}</span>
                  <span className="block text-[11px] leading-tight text-slate-400">mín. {MIN_PLAYERS[f]} jugadores</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">{FORMAT_DESC[format]}</p>
          </div>

          {isElimination({ format }) ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="bo-early">Rondas iniciales</label>
                  <select id="bo-early" className="field" value={settings.bestOfEarly} onChange={(e) => set('bestOfEarly', Number(e.target.value))}>
                    {BEST_OF_OPTIONS.map((n) => <option key={n} value={n}>Al mejor de {n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="bo-late">Rondas avanzadas</label>
                  <select id="bo-late" className="field" value={settings.bestOfLate} onChange={(e) => set('bestOfLate', Number(e.target.value))}>
                    {BEST_OF_OPTIONS.map((n) => <option key={n} value={n}>Al mejor de {n}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="late-from">Las avanzadas empiezan en</label>
                <select id="late-from" className="field" value={settings.lateFrom} onChange={(e) => set('lateFrom', e.target.value)}>
                  {Object.entries(LATE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {format === 'double'
                    ? 'La Grand Finals y su reset siempre usan el Bo de las avanzadas; en losers cuentan sus rondas finales.'
                    : 'La final (y el 3er lugar, si lo activas) siempre usan el Bo de las avanzadas.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="bo">Series</label>
                <select id="bo" className="field" value={settings.bestOfEarly} onChange={(e) => set('bestOfEarly', Number(e.target.value))}>
                  {BEST_OF_OPTIONS.map((n) => <option key={n} value={n}>Al mejor de {n}</option>)}
                </select>
              </div>
              {format === 'swiss' && (
                <div>
                  <label className="label" htmlFor="sr">Rondas</label>
                  <select id="sr" className="field" value={settings.swissRounds} onChange={(e) => set('swissRounds', Number(e.target.value))}>
                    <option value={0}>Automático</option>
                    {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
          <div className="space-y-2">
            {format === 'single' && <Check label="Partido por el 3er lugar" checked={settings.thirdPlace} onChange={(v) => set('thirdPlace', v)} />}
            {format === 'double' && <Check label="Final con reset" checked={settings.grandFinalReset} onChange={(v) => set('grandFinalReset', v)} hint="Si gana el de losers la gran final, se juega una segunda (como Start.gg)." />}
            {format === 'roundrobin' && <Check label="Ida y vuelta" checked={settings.doubleRoundRobin} onChange={(v) => set('doubleRoundRobin', v)} />}
            {(format === 'roundrobin' || format === 'swiss') && (
              <>
                <Check label="Permitir empates" checked={settings.allowDraw} onChange={(v) => set('allowDraw', v)} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="wp">Puntos por victoria</label>
                    <input id="wp" type="number" min={1} max={9} className="field" value={settings.winPoints} onChange={(e) => set('winPoints', Math.max(1, Math.min(9, Number(e.target.value) || 1)))} />
                  </div>
                  {settings.allowDraw && (
                    <div>
                      <label className="label" htmlFor="dp">Puntos por empate</label>
                      <input id="dp" type="number" min={0} max={9} className="field" value={settings.drawPoints} onChange={(e) => set('drawPoints', Math.max(0, Math.min(9, Number(e.target.value) || 0)))} />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <label className="label !mb-0" htmlFor="players">Jugadores ({names.length})</label>
            <button type="button" className="btn btn-ghost !px-2 !py-0.5 text-xs" onClick={() => setNames(Array.from({ length: 8 }, (_, i) => `Jugador ${i + 1}`))}>
              Poner 8 de ejemplo
            </button>
          </div>
          <div className="flex gap-2">
            <input
              aria-label="Agregar jugador"
              className="field"
              value={newName}
              maxLength={60}
              placeholder="Agregar jugador y Enter"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPlayer())}
            />
            <button type="button" className="btn shrink-0" disabled={!newName.trim()} onClick={addPlayer}>+ Agregar</button>
          </div>
          <textarea id="players" className="field h-28 resize-y font-mono" value={text} placeholder={'Uno por línea (pega la lista).\nEl orden es el seeding: el primero es el seed 1.'} onChange={(e) => setText(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" disabled={names.length < 2} onClick={() => setNames(shuffle(names))}>🎲 Mezclar (seeding aleatorio)</button>
            <button type="button" className="btn" disabled={names.length < 2} onClick={() => setNames([...names].sort((a, b) => a.localeCompare(b, 'es')))}>A–Z</button>
            <button type="button" className="btn" disabled={names.length < 2} onClick={() => setNames([...names].reverse())}>Invertir</button>
          </div>
          {names.length > 0 && (
            <ol className="max-h-72 space-y-1 overflow-y-auto pr-1" aria-label="Orden de seeding">
              {names.map((n, i) => (
                <li
                  key={`${i}-${n}`}
                  draggable
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragFrom != null) move(dragFrom, i); setDragFrom(null); }}
                  className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-2 py-1 text-sm"
                >
                  <span className="cursor-grab text-slate-600" aria-hidden="true">⠿</span>
                  <span className="w-6 text-right font-mono text-xs text-slate-500">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium" style={{ color: playerColor(i) }}>{n}</span>
                  <button type="button" className="btn btn-ghost !px-1.5 !py-0" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Subir ${n}`}>↑</button>
                  <button type="button" className="btn btn-ghost !px-1.5 !py-0" onClick={() => move(i, i + 1)} disabled={i === names.length - 1} aria-label={`Bajar ${n}`}>↓</button>
                  <button type="button" className="btn btn-ghost !px-1.5 !py-0 text-red-300" onClick={() => setNames(names.filter((_, j) => j !== i))} aria-label={`Quitar ${n}`}>✕</button>
                </li>
              ))}
            </ol>
          )}
          {names.length > MAX_PLAYERS && <p className="text-xs text-red-300">Máximo {MAX_PLAYERS} jugadores.</p>}
        </div>

        <div className="flex items-center gap-2">
          <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn btn-primary ml-auto" disabled={!!error} onClick={submit}>{editing ? 'Guardar cambios' : 'Crear torneo →'}</button>
        </div>
        {error && names.length > 0 && <p className="text-xs text-amber-300">{error}</p>}
      </div>

      <div className="min-w-0 space-y-3">
        <div className="card flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Vista previa" className="flex rounded-xl border border-slate-800 p-0.5">
            <button type="button" aria-pressed={!simulate} onClick={() => setSimulate(false)} className={`rounded-lg px-3 py-1.5 text-sm ${!simulate ? 'bg-cyan-500 font-semibold text-slate-950' : 'text-slate-300'}`}>Bracket</button>
            <button type="button" aria-pressed={simulate} onClick={() => setSimulate(true)} className={`rounded-lg px-3 py-1.5 text-sm ${simulate ? 'bg-violet-400 font-semibold text-slate-950' : 'text-slate-300'}`}>Simular torneo</button>
          </div>
          {simulate && (
            <>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                Sorpresas
                <input type="range" min={0} max={1} step={0.05} value={upsets} onChange={(e) => setUpsets(Number(e.target.value))} className="accent-violet-400" />
                <span className="w-9 font-mono">{Math.round(upsets * 100)}%</span>
              </label>
              <button type="button" className="btn" onClick={() => setSimSeed((s) => s + 1)}>🎲 Simular otra vez</button>
            </>
          )}
          <p className="basis-full text-xs text-slate-500">
            {simulate
              ? 'Así podría terminar con este seeding (con 0% de sorpresas siempre gana el mejor seed). No se guarda nada.'
              : 'Vista previa en vivo: mezcla o reordena a los jugadores —o arrastra un nombre sobre otro en el bracket— para ver cómo cambian los cruces.'}
          </p>
        </div>
        {preview ? (
          <TournamentBody t={preview} readOnly onSwap={isElimination(preview) ? swapSeeds : undefined} height={isElimination(preview) ? '62vh' : undefined} />
        ) : (
          <div className="card grid h-72 place-items-center text-center text-sm text-slate-400">
            <p>
              Agrega al menos {MIN_PLAYERS[format]} jugadores para ver el bracket.
              <br />
              <span className="text-xs text-slate-500">Pega una lista a la izquierda: uno por línea.</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
