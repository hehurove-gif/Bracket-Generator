import { podium } from '../lib/engine.js';

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };
const TITLE = { 1: 'Campeón', 2: 'Segundo lugar', 3: 'Tercer lugar' };

export default function Podium({ t, names }) {
  const list = podium(t);
  if (!list.length) return null;
  return (
    <div className="card flex flex-wrap items-center gap-x-8 gap-y-3 border-cyan-400/30">
      {list.map((p) => (
        <div key={p.place} className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden="true">{MEDAL[p.place]}</span>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{TITLE[p.place]}</p>
            <p className={`font-semibold ${p.place === 1 ? 'text-xl text-cyan-300' : ''}`}>{p.ids.map((id) => names.get(id)).join(' / ')}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
