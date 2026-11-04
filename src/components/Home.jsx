import { useRef } from 'react';
import { progress } from '../lib/engine.js';
import { FORMAT_LABEL } from '../lib/helpers.js';

export default function Home({ items, onNew, onOpen, onDelete, onDuplicate, onImport }) {
  const fileRef = useRef(null);
  const sorted = [...items].sort((a, b) => (b.updated || 0) - (a.updated || 0));
  return (
    <div className="space-y-8">
      <section className="space-y-3 pt-4">
        <p className="font-mono text-sm text-cyan-300">&lt;bracket /&gt;</p>
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">Brackets de torneo, sin cuentas.</h1>
        <p className="max-w-2xl text-slate-300">
          Eliminación simple y doble, round robin y suizo. Pega la lista de jugadores, ajusta el seeding, simula cómo quedaría y reporta marcadores.
          Todo se guarda en tu navegador: nadie tiene que registrarse en ninguna plataforma.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" className="btn btn-primary !px-5 !py-2.5 text-base" onClick={onNew}>+ Nuevo torneo</button>
          <button type="button" className="btn !py-2.5" onClick={() => fileRef.current?.click()}>Importar archivo</button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}
          />
        </div>
      </section>

      <section aria-label="Mis torneos" className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Mis torneos {sorted.length ? `(${sorted.length})` : ''}</h2>
        {sorted.length === 0 ? (
          <div className="card text-sm text-slate-400">Aún no tienes torneos guardados. Se guardan solos en este navegador.</div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((it) => {
              const p = progress(it.t);
              return (
                <li key={it.id} className="card flex flex-col gap-3 transition-colors hover:border-cyan-400/50">
                  <button type="button" className="text-left" onClick={() => onOpen(it.id)}>
                    <p className="truncate text-lg font-semibold">{it.t.name}</p>
                    <p className="text-xs text-slate-400">{FORMAT_LABEL[it.t.format]} · {it.t.players.length} jugadores</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full bg-cyan-400" style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} />
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-slate-500">{p.done}/{p.total} partidos</p>
                  </button>
                  <div className="mt-auto flex gap-1">
                    <button type="button" className="btn btn-ghost !px-2 text-xs" onClick={() => onDuplicate(it.id)}>Duplicar</button>
                    <button type="button" className="btn btn-ghost !px-2 text-xs text-red-300" onClick={() => window.confirm(`¿Borrar "${it.t.name}"?`) && onDelete(it.id)}>Borrar</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
