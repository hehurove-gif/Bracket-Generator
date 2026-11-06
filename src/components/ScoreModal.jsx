import { useEffect, useRef, useState } from 'react';

function Stepper({ label, seed, color, value, onChange, max, win }) {
  return (
    <div className={`flex flex-1 flex-col items-center gap-2 rounded-xl border p-3 ${win ? 'border-cyan-400/60 bg-cyan-400/5' : 'border-slate-800'}`}>
      <p className="max-w-full truncate text-center text-sm font-bold" style={{ color }} title={label}>
        <span className="mr-1 font-mono text-[10px] text-slate-500">{seed}</span>
        {label}
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className="btn !px-3" onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Restar a ${label}`}>−</button>
        <span className="w-12 text-center font-mono text-3xl">{value}</span>
        <button type="button" className="btn !px-3" onClick={() => onChange(Math.min(max, value + 1))} aria-label={`Sumar a ${label}`}>+</button>
      </div>
    </div>
  );
}

/* Marcador de un partido, con DQ. `onDQ(jugador, on, partido)` devuelve true si se aplicó (puede pedir confirmación). */
export default function ScoreModal({ m, t, names, seeds, colors, onSave, onClear, onDQ, onClose }) {
  const bestOf = m.bo;
  const need = Math.ceil(bestOf / 2);
  const draws = t.settings.allowDraw && (t.format === 'roundrobin' || t.format === 'swiss');
  const [a, setA] = useState(m.scoreA ?? 0);
  const [b, setB] = useState(m.scoreB ?? 0);
  const ref = useRef(null);
  const max = bestOf === 1 ? 1 : need;
  const cap = draws ? 99 : max;

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hint =
    a === b && a > 0 && !draws
      ? 'Los empates no son válidos aquí: alguien tiene que ganar.'
      : a !== b && Math.max(a, b) < need
        ? `Al mejor de ${bestOf}: gana quien llegue a ${need}.`
        : null;

  const setWinner = (side) => {
    const loser = side === 'a' ? b : a;
    const l = Math.min(loser, need - 1);
    if (side === 'a') { setA(need); setB(l); } else { setB(need); setA(l); }
  };

  const forfeiter = m.forfeit ? (m.forfeit === 'a' ? m.a : m.b) : null;
  const dq = (id, on) => {
    if (onDQ?.(id, on, m.id)) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Marcador ${m.id}`} className="card w-full max-w-md space-y-4 outline-none">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-sm text-cyan-300">
            Partido {m.id}
            {bestOf > 1 && <span className="ml-2 text-slate-500">Bo{bestOf}</span>}
          </h2>
          <button type="button" className="btn btn-ghost !px-2" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {forfeiter ? (
          <>
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm">
              <p>
                <strong style={{ color: colors.get(forfeiter) }}>{names.get(forfeiter)}</strong>{' '}
                está descalificado (DQ).{' '}
                <strong style={{ color: colors.get(m.winner) }}>{names.get(m.winner)}</strong> avanza por forfeit.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Si fue un error, reincorpóralo: se quita su DQ en todo el torneo y se reinician los partidos que dependían de este.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn" onClick={onClose}>Cerrar</button>
              <button type="button" className="btn btn-primary ml-auto" onClick={() => dq(forfeiter, false)}>Reincorporar a {names.get(forfeiter)}</button>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-3">
              <Stepper label={names.get(m.a)} seed={seeds.get(m.a)} color={colors.get(m.a)} value={a} onChange={setA} max={cap} win={a > b} />
              <Stepper label={names.get(m.b)} seed={seeds.get(m.b)} color={colors.get(m.b)} value={b} onChange={setB} max={cap} win={b > a} />
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn flex-1" onClick={() => setWinner('a')}>Gana {names.get(m.a)}</button>
              <button type="button" className="btn flex-1" onClick={() => setWinner('b')}>Gana {names.get(m.b)}</button>
            </div>
            {hint && <p className="text-xs text-amber-300">{hint}</p>}
            {m.status === 'done' && (
              <p className="text-xs text-slate-400">
                Si cambias el ganador, los partidos siguientes que dependían de este se reinician solos.
              </p>
            )}
            <div className="flex gap-2">
              {(m.scoreA != null || m.scoreB != null) && (
                <button type="button" className="btn" onClick={() => { onClear(); onClose(); }}>Borrar resultado</button>
              )}
              <button type="button" className="btn btn-primary ml-auto" onClick={() => { onSave(a, b); onClose(); }}>
                Guardar
              </button>
            </div>
            {onDQ && (
              <div className="border-t border-slate-800 pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Descalificar (DQ)</p>
                <div className="flex gap-2">
                  <button type="button" className="btn flex-1 !border-red-400/40 !text-red-300 hover:!bg-red-500/10" onClick={() => dq(m.a, true)}>
                    DQ a {names.get(m.a)}
                  </button>
                  <button type="button" className="btn flex-1 !border-red-400/40 !text-red-300 hover:!bg-red-500/10" onClick={() => dq(m.b, true)}>
                    DQ a {names.get(m.b)}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
