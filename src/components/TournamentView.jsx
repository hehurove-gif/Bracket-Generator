import { useEffect, useMemo, useState } from 'react';
import { autoPlay, clearMatch, isFinished, progress, resetResults, setScore, swapSlots, swissNextRound } from '../lib/engine.js';
import { encodeShare, toCompact } from '../lib/storage.js';
import { FORMAT_LABEL, download, isElimination, maps } from '../lib/helpers.js';
import TournamentBody from './TournamentBody.jsx';
import ScoreModal from './ScoreModal.jsx';

export default function TournamentView({ item, onChange, onBack }) {
  const t = item.t;
  const [sim, setSim] = useState(null);
  const [upsets, setUpsets] = useState(0.35);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');
  const [undo, setUndo] = useState(null); // { prev, label } del último intercambio de jugadores
  const shown = sim || t;
  const { names, seeds, colors } = useMemo(() => maps(shown), [shown]);
  const prog = progress(t);
  const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;

  useEffect(() => {
    if (!notice) return undefined;
    const id = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(id);
  }, [notice]);

  const update = (next) => {
    setUndo(null);
    onChange({ ...item, t: next, updated: Date.now() });
  };

  // Arrastrar un nombre sobre otro (o sobre un BYE) intercambia sus lugares en la primera ronda.
  const swap = ({ from, to, fromPlayer, toPlayer }) => {
    const next = swapSlots(t, from, to);
    if (next === t) return;
    const lost = progress(t).done - progress(next).done;
    const who = names.get(fromPlayer);
    const other = toPlayer ? names.get(toPlayer) : 'un BYE';
    if (lost > 0 && !window.confirm(`Mover a ${who} cambia los cruces y borrará ${lost} resultado${lost > 1 ? 's' : ''}. ¿Continuar?`)) return;
    onChange({ ...item, t: next, updated: Date.now() });
    setUndo({ prev: t, label: `${who} ↔ ${other}` });
  };
  const undoSwap = () => {
    if (!undo) return;
    onChange({ ...item, t: undo.prev, updated: Date.now() });
    setUndo(null);
  };
  const rename = (name) => update({ ...t, name: name.slice(0, 80) || 'Torneo' });

  const share = async () => {
    try {
      const code = await encodeShare(t);
      const url = `${location.origin}${location.pathname}#t=${code}`;
      try {
        await navigator.clipboard.writeText(url);
        setNotice('Enlace copiado. Quien lo abra recibe una copia del torneo con sus resultados.');
      } catch {
        window.prompt('Copia este enlace:', url);
      }
    } catch {
      setNotice('No se pudo crear el enlace. Prueba exportando el archivo.');
    }
  };

  const reset = () => {
    if (window.confirm('¿Borrar todos los resultados? Se conservan los jugadores y el seeding.')) update(resetResults(t));
  };

  const open = (m) => {
    if (sim) return;
    setEditing(m.id);
  };
  const editingMatch = editing ? t.matches.find((m) => m.id === editing) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-ghost" onClick={onBack}>← Mis torneos</button>
        <input
          aria-label="Nombre del torneo"
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-xl font-semibold outline-none hover:border-slate-700 focus:border-cyan-400"
          value={t.name}
          onChange={(e) => update({ ...t, name: e.target.value.slice(0, 80) })}
          onBlur={(e) => rename(e.target.value.trim())}
        />
        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
          {FORMAT_LABEL[t.format]} · {t.players.length} jugadores{t.settings.bestOf > 1 ? ` · Bo${t.settings.bestOf}` : ''}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[180px] flex-1 items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-xs text-slate-400">{prog.done}/{prog.total}{t.format === 'swiss' && !isFinished(t) ? '+' : ''}</span>
        </div>
        <button type="button" className="btn" onClick={() => setSim(autoPlay(t, { upsets }))} disabled={isFinished(t) || !!sim}>🎲 Simular lo que falta</button>
        <button type="button" className="btn" onClick={share}>🔗 Compartir enlace</button>
        <button type="button" className="btn" onClick={() => download(`${t.name.replace(/[^\w-]+/g, '_') || 'torneo'}.bracket.json`, JSON.stringify(toCompact(t)))}>⬇ Exportar</button>
        <button type="button" className="btn" onClick={reset}>Reiniciar</button>
      </div>

      {notice && <p role="status" className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-200">{notice}</p>}

      {undo && (
        <p role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-200">
          Bracket modificado: {undo.label}
          <button type="button" className="btn !py-0.5" onClick={undoSwap}>↶ Deshacer</button>
          <button type="button" className="btn btn-ghost !py-0.5" onClick={() => setUndo(null)}>Listo</button>
        </p>
      )}

      {sim && (
        <div className="card flex flex-wrap items-center gap-3 border-violet-400/40">
          <p className="text-sm text-violet-200">
            <strong>Simulación</strong> — así podría terminar; tus resultados reales no se han tocado.
          </p>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            Sorpresas
            <input type="range" min={0} max={1} step={0.05} value={upsets} onChange={(e) => setUpsets(Number(e.target.value))} className="accent-violet-400" />
            <span className="w-9 font-mono">{Math.round(upsets * 100)}%</span>
          </label>
          <button type="button" className="btn" onClick={() => setSim(autoPlay(t, { upsets }))}>Simular otra vez</button>
          <button type="button" className="btn btn-primary" onClick={() => { update(sim); setSim(null); }}>Conservar estos resultados</button>
          <button type="button" className="btn" onClick={() => setSim(null)}>Descartar</button>
        </div>
      )}

      <TournamentBody
        t={shown}
        readOnly={!!sim}
        onOpen={open}
        onNextRound={() => update(swissNextRound(t))}
        onSwap={isElimination(t) && !sim ? swap : undefined}
        allowBye
        height="68vh"
      />

      {editingMatch && (
        <ScoreModal
          key={editingMatch.id}
          m={editingMatch}
          t={t}
          names={names}
          seeds={seeds}
          colors={colors}
          onClose={() => setEditing(null)}
          onSave={(a, b) => update(setScore(t, editingMatch.id, a, b))}
          onClear={() => update(clearMatch(t, editingMatch.id))}
        />
      )}
    </div>
  );
}
