import { BYE } from '../lib/engine.js';

function slotLabel(src, m, side) {
  if (m.reset) return 'Si gana losers';
  if (!src) return 'Por definir';
  if (src.t === 'w') return `Ganador ${src.m}`;
  if (src.t === 'l') return `Perdedor ${src.m}`;
  return 'Por definir';
}

function Row({ id, label, score, isWinner, isLoser, names, seeds, hl, setHl, pending, draw }) {
  const bye = id === BYE;
  const name = id && !bye ? names.get(id) : null;
  const active = hl && id && hl === id;
  return (
    <div
      onMouseEnter={() => id && !bye && setHl?.(id)}
      onMouseLeave={() => setHl?.(null)}
      className={`flex h-[32px] items-center gap-2 px-2.5 text-sm transition-colors ${
        active ? 'bg-cyan-400/15' : ''
      } ${isLoser ? 'text-slate-500' : 'text-slate-100'}`}
    >
      <span className="w-5 shrink-0 text-right font-mono text-[10px] text-slate-500">{id && !bye ? seeds.get(id) : ''}</span>
      <span
        className={`min-w-0 flex-1 truncate ${isWinner ? 'font-semibold text-cyan-300' : ''} ${
          !name ? 'text-xs italic text-slate-500' : ''
        }`}
        title={name || undefined}
      >
        {name ?? (bye ? 'BYE' : pending)}
      </span>
      <span
        className={`w-7 shrink-0 rounded text-center font-mono text-sm ${
          isWinner ? 'bg-cyan-400 text-slate-950' : draw ? 'bg-slate-600/60 text-slate-100' : 'bg-slate-800 text-slate-300'
        } ${score == null ? 'opacity-0' : ''}`}
      >
        {score ?? 0}
      </span>
    </div>
  );
}

/* Tarjeta de un partido. En el bracket usa tamaño fijo; en listas ocupa todo el ancho. */
export default function MatchCard({ m, names, seeds, hl, setHl, onOpen, readOnly, style, fixed = true }) {
  const clickable = !readOnly && (m.status === 'ready' || m.status === 'done');
  const dim = m.status === 'bye' || m.status === 'skipped';
  const winnerA = m.status === 'done' && !m.draw && m.winner === m.a;
  const winnerB = m.status === 'done' && !m.draw && m.winner === m.b;
  const border =
    m.status === 'ready' ? 'border-cyan-400/50' : m.status === 'done' ? 'border-slate-600' : 'border-slate-800';

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onOpen?.(m) : undefined}
      onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen?.(m)) : undefined}
      style={style}
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
      <Row id={m.a} label="A" score={m.scoreA} isWinner={winnerA} isLoser={winnerB} names={names} seeds={seeds} hl={hl} setHl={setHl} pending={slotLabel(m.srcA, m, 'a')} draw={m.draw} />
      <div className="h-px bg-slate-800" />
      <Row id={m.b} label="B" score={m.scoreB} isWinner={winnerB} isLoser={winnerA} names={names} seeds={seeds} hl={hl} setHl={setHl} pending={slotLabel(m.srcB, m, 'b')} draw={m.draw} />
    </div>
  );
}
