import { memo } from 'react';
import { BYE } from '../lib/engine.js';
import { CARD_H, CARD_W } from '../lib/layout.js';

function slotLabel(src, m) {
  if (m.reset) return 'Si gana losers';
  if (!src) return 'Por definir';
  if (src.t === 'w') return `Ganador ${src.m}`;
  if (src.t === 'l') return `Perdedor ${src.m}`;
  return 'Por definir';
}

function Row({ id, score, isWinner, isLoser, names, seeds, colors, active, setHl, pending, draw }) {
  const bye = id === BYE;
  const real = id && !bye;
  const name = real ? names.get(id) : null;
  const color = real ? colors.get(id) : undefined;
  return (
    <div
      onMouseEnter={() => real && setHl?.(id)}
      onMouseLeave={() => setHl?.(null)}
      className={`flex h-[32px] items-center gap-2 border-l-[3px] pl-2 pr-2.5 text-sm transition-colors ${active ? 'bg-white/10' : ''}`}
      style={{ borderLeftColor: color ?? 'transparent' }}
    >
      <span className="w-5 shrink-0 text-right font-mono text-[10px] text-slate-500">{real ? seeds.get(id) : ''}</span>
      <span
        className={`min-w-0 flex-1 truncate ${isWinner ? 'font-bold' : 'font-medium'} ${isLoser ? 'opacity-50' : ''} ${!name ? 'text-xs font-normal italic text-slate-500' : ''}`}
        style={name ? { color } : undefined}
        title={name || undefined}
      >
        {name ?? (bye ? 'BYE' : pending)}
      </span>
      <span
        className={`w-7 shrink-0 rounded text-center font-mono text-sm ${isWinner ? 'font-bold text-slate-950' : draw ? 'bg-slate-600/60 text-slate-100' : 'bg-slate-800 text-slate-300'} ${score == null ? 'opacity-0' : ''}`}
        style={isWinner ? { backgroundColor: color } : undefined}
      >
        {score ?? 0}
      </span>
    </div>
  );
}

/* Tarjeta de un partido. En el bracket va en posición absoluta (x, y); en listas ocupa todo el ancho.
   Está memorizada: pasar el cursor sobre un jugador solo vuelve a pintar las tarjetas donde aparece. */
function MatchCard({ m, names, seeds, colors, hlA, hlB, setHl, onOpen, readOnly, x, y }) {
  const fixed = x != null;
  const clickable = !readOnly && (m.status === 'ready' || m.status === 'done');
  const dim = m.status === 'bye' || m.status === 'skipped';
  const winnerA = m.status === 'done' && !m.draw && m.winner === m.a;
  const winnerB = m.status === 'done' && !m.draw && m.winner === m.b;
  const border = m.status === 'ready' ? 'border-cyan-400/50' : m.status === 'done' ? 'border-slate-600' : 'border-slate-800';

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onOpen?.(m) : undefined}
      onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen?.(m)) : undefined}
      style={fixed ? { left: x, top: y, width: CARD_W, height: CARD_H } : undefined}
      className={`${fixed ? 'absolute' : 'relative'} select-none overflow-hidden rounded-xl border bg-slate-900/90 shadow-sm ${border} ${
        clickable ? 'cursor-pointer hover:border-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300' : ''
      } ${dim ? 'opacity-45' : ''}`}
      aria-label={clickable ? `Partido ${m.id}: abrir marcador` : undefined}
    >
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/50 px-2.5 py-[1px] font-mono text-[10px] text-slate-500">
        <span>{m.id}</span>
        <span>
          {m.status === 'ready' && <span className="text-cyan-300">● por jugar</span>}
          {m.status === 'done' && m.draw && 'empate'}
          {m.status === 'skipped' && 'no necesario'}
        </span>
      </div>
      <Row id={m.a} score={m.scoreA} isWinner={winnerA} isLoser={winnerB} names={names} seeds={seeds} colors={colors} active={hlA} setHl={setHl} pending={slotLabel(m.srcA, m)} draw={m.draw} />
      <div className="h-px bg-slate-800" />
      <Row id={m.b} score={m.scoreB} isWinner={winnerB} isLoser={winnerA} names={names} seeds={seeds} colors={colors} active={hlB} setHl={setHl} pending={slotLabel(m.srcB, m)} draw={m.draw} />
    </div>
  );
}

export default memo(MatchCard);
