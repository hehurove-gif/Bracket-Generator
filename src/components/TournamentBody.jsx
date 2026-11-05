import { useMemo, useState } from 'react';
import { swissCanAdvance, swissCurrentRound, isFinished } from '../lib/engine.js';
import { isElimination, maps } from '../lib/helpers.js';
import BracketView from './BracketView.jsx';
import MatchCard from './MatchCard.jsx';
import Standings from './Standings.jsx';
import Podium from './Podium.jsx';

function RoundList({ t, names, seeds, colors, hl, setHl, onOpen, readOnly }) {
  const rounds = [...new Set(t.matches.map((m) => m.round))].sort((a, b) => a - b);
  return (
    <div className="space-y-6">
      {rounds.map((r) => (
        <section key={r}>
          <h3 className="mb-2 font-mono text-xs uppercase tracking-widest text-violet-300">Ronda {r}</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {t.matches.filter((m) => m.round === r).map((m) => (
              <MatchCard key={m.id} m={m} names={names} seeds={seeds} colors={colors} hlA={!!hl && m.a === hl} hlB={!!hl && m.b === hl} setHl={setHl} onOpen={onOpen} readOnly={readOnly} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* Contenido principal de un torneo: bracket (eliminación) o partidos + tabla (round robin / suizo). */
export default function TournamentBody({ t, readOnly, onOpen, onNextRound, onSwap, allowBye, height }) {
  const { names, seeds, colors } = useMemo(() => maps(t), [t]);
  const [hl, setHl] = useState(null);
  const [tab, setTab] = useState('matches');
  const finished = isFinished(t);

  if (isElimination(t)) {
    return (
      <div className="space-y-4">
        {finished && <Podium t={t} names={names} colors={colors} />}
        <BracketView t={t} names={names} seeds={seeds} colors={colors} hl={hl} setHl={setHl} onOpen={onOpen} onSwap={onSwap} allowBye={allowBye} readOnly={readOnly} height={height} />
      </div>
    );
  }

  const swiss = t.format === 'swiss';
  const canNext = swiss && swissCanAdvance(t);
  return (
    <div className="space-y-4">
      {finished && <Podium t={t} names={names} colors={colors} />}
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex rounded-xl border border-slate-800 p-0.5">
          {[['matches', 'Partidos'], ['table', 'Tabla']].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-lg px-4 py-1.5 text-sm ${tab === id ? 'bg-cyan-500 font-semibold text-slate-950' : 'text-slate-300 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
        {swiss && (
          <>
            <span className="text-sm text-slate-400">Ronda {swissCurrentRound(t)} de {t.settings.swissRounds}</span>
            {!readOnly && !finished && (
              <button type="button" className="btn btn-primary ml-auto" disabled={!canNext} onClick={onNextRound} title={canNext ? '' : 'Termina todos los partidos de la ronda para generar la siguiente'}>
                Generar siguiente ronda →
              </button>
            )}
          </>
        )}
      </div>
      {tab === 'table' ? (
        <Standings t={t} colors={colors} hl={hl} setHl={setHl} />
      ) : (
        <RoundList t={t} names={names} seeds={seeds} colors={colors} hl={hl} setHl={setHl} onOpen={onOpen} readOnly={readOnly} />
      )}
    </div>
  );
}
