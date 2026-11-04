import { useDeferredValue, useMemo, useState } from 'react';
import { DEFAULT_SETTINGS, FORMATS, MAX_PLAYERS, MIN_PLAYERS, autoPlay, createTournament, mulberry32, shuffle, validate } from '../lib/engine.js';
import { FORMAT_DESC, FORMAT_LABEL, isElimination } from '../lib/helpers.js';
import TournamentBody from './TournamentBody.jsx';

const linesOf = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean);

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

export default function Setup({ onCreate, onCancel }) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState('single');
  const [text, setText] = useState('');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
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

  const submit = () => {
    if (error) return;
    onCreate(createTournament({ name, format, names, settings }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="space-y-5">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="bo">Series</label>
              <select id="bo" className="field" value={settings.bestOf} onChange={(e) => set('bestOf', Number(e.target.value))}>
                {[1, 3, 5, 7].map((n) => <option key={n} value={n}>{n === 1 ? 'Partido único' : `Al mejor de ${n}`}</option>)}
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
                  <span className="min-w-0 flex-1 truncate">{n}</span>
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
          <button type="button" className="btn btn-primary ml-auto" disabled={!!error} onClick={submit}>Crear torneo →</button>
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
              : 'Vista previa en vivo: mezcla o reordena a los jugadores para ver cómo cambian los cruces.'}
          </p>
        </div>
        {preview ? (
          <TournamentBody t={preview} readOnly height={isElimination(preview) ? '62vh' : undefined} />
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
