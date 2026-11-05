import { standings } from '../lib/engine.js';

export default function Standings({ t, colors, hl, setHl }) {
  const rows = standings(t);
  const swiss = t.format === 'swiss';
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Jugador</th>
            <th className="px-2 py-2 text-center" title="Partidos jugados">PJ</th>
            <th className="px-2 py-2 text-center" title="Ganados">G</th>
            {t.settings.allowDraw && <th className="px-2 py-2 text-center" title="Empatados">E</th>}
            <th className="px-2 py-2 text-center" title="Perdidos">P</th>
            <th className="px-2 py-2 text-center" title="Diferencia de marcador">Dif</th>
            {swiss && <th className="px-2 py-2 text-center" title="Buchholz: suma de puntos de tus rivales (desempate)">Buch.</th>}
            <th className="px-3 py-2 text-right">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.id}
              onMouseEnter={() => setHl?.(r.id)}
              onMouseLeave={() => setHl?.(null)}
              className={`border-t border-slate-800 ${hl === r.id ? 'bg-cyan-400/10' : ''}`}
            >
              <td className="px-3 py-2 font-mono text-slate-400">{i + 1}</td>
              <td className="px-3 py-2 font-semibold" style={{ color: colors.get(r.id) }}>
                {r.name} <span className="font-mono text-[10px] text-slate-500">seed {r.seed}</span>
              </td>
              <td className="px-2 py-2 text-center text-slate-300">{r.played}</td>
              <td className="px-2 py-2 text-center text-slate-300">{r.wins}</td>
              {t.settings.allowDraw && <td className="px-2 py-2 text-center text-slate-300">{r.draws}</td>}
              <td className="px-2 py-2 text-center text-slate-300">{r.losses}</td>
              <td className="px-2 py-2 text-center text-slate-300">{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td>
              {swiss && <td className="px-2 py-2 text-center text-slate-300">{r.buchholz}</td>}
              <td className="px-3 py-2 text-right font-mono font-semibold text-cyan-300">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
