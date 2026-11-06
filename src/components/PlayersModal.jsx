import { useEffect, useRef } from 'react';

/* Lista de jugadores con DQ / Reincorporar (sirve también para descalificar a alguien que no llegó,
   antes de que le toque jugar). `onDQ(jugador, on)` devuelve true si se aplicó. */
export default function PlayersModal({ t, names, seeds, colors, onDQ, onEdit, onClose }) {
  const ref = useRef(null);
  const dq = new Set(t.dq || []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Jugadores" className="card flex max-h-[85vh] w-full max-w-md flex-col gap-3 outline-none">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-sm text-cyan-300">Jugadores ({t.players.length}{dq.size ? ` · ${dq.size} DQ` : ''})</h2>
          <button type="button" className="btn btn-ghost !px-2" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {t.players.map((p) => {
            const out = dq.has(p.id);
            return (
              <li key={p.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-2 py-1.5 text-sm">
                <span className="w-6 text-right font-mono text-xs text-slate-500">{seeds.get(p.id)}</span>
                <span className={`min-w-0 flex-1 truncate font-semibold ${out ? 'line-through opacity-60' : ''}`} style={{ color: colors.get(p.id) }}>{names.get(p.id)}</span>
                {out && <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-300">DQ</span>}
                {out ? (
                  <button type="button" className="btn !py-0.5 text-xs" onClick={() => onDQ(p.id, false)}>Reincorporar</button>
                ) : (
                  <button type="button" className="btn !border-red-400/40 !py-0.5 text-xs !text-red-300 hover:!bg-red-500/10" onClick={() => onDQ(p.id, true)} aria-label={`DQ a ${names.get(p.id)}`}>DQ</button>
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-2 border-t border-slate-800 pt-3">
          <p className="min-w-0 flex-1 text-xs text-slate-500">¿Falta alguien o hay que cambiar el seeding?</p>
          <button type="button" className="btn" onClick={() => { onClose(); onEdit(); }}>✎ Editar torneo</button>
        </div>
      </div>
    </div>
  );
}
