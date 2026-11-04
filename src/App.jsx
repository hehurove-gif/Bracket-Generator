import { useEffect, useRef, useState } from 'react';
import { decodeShare, fromCompact, loadAll, newId, saveAll } from './lib/storage.js';
import Home from './components/Home.jsx';
import Setup from './components/Setup.jsx';
import TournamentView from './components/TournamentView.jsx';

export default function App() {
  const [items, setItems] = useState(() => loadAll());
  const [route, setRoute] = useState({ view: 'home', id: null });
  const [toast, setToast] = useState('');
  const loaded = useRef(false);

  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    saveAll(items);
  }, [items]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  // Enlace compartido: #t=<código>. Se importa como copia propia y se limpia el hash.
  useEffect(() => {
    const m = location.hash.match(/^#t=(.+)$/);
    if (!m) return;
    decodeShare(m[1])
      .then((t) => {
        const id = newId();
        setItems((prev) => [{ id, updated: Date.now(), t }, ...prev]);
        setRoute({ view: 'view', id });
        setToast('Torneo cargado desde el enlace. Es tu copia: tus cambios no afectan a quien lo compartió.');
      })
      .catch(() => setToast('El enlace no es válido o está incompleto.'))
      .finally(() => history.replaceState(null, '', location.pathname + location.search));
  }, []);

  const current = route.view === 'view' ? items.find((i) => i.id === route.id) : null;
  useEffect(() => {
    if (route.view === 'view' && !current) setRoute({ view: 'home', id: null });
  }, [route, current]);

  const create = (t) => {
    const id = newId();
    setItems((prev) => [{ id, updated: Date.now(), t }, ...prev]);
    setRoute({ view: 'view', id });
  };
  const change = (next) => setItems((prev) => prev.map((i) => (i.id === next.id ? next : i)));
  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id));
  const duplicate = (id) => {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    setItems((prev) => [{ id: newId(), updated: Date.now(), t: { ...it.t, name: `${it.t.name} (copia)` } }, ...prev]);
  };
  const importFile = async (file) => {
    try {
      if (file.size > 2_000_000) throw new Error('grande');
      const t = fromCompact(JSON.parse(await file.text()));
      create(t);
    } catch {
      setToast('No se pudo importar: el archivo no es un torneo válido de esta herramienta.');
    }
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1500px] px-4 py-5 sm:px-6">
      {toast && (
        <p role="status" className="fixed left-1/2 top-4 z-[60] w-[min(92vw,560px)] -translate-x-1/2 rounded-xl border border-cyan-400/40 bg-slate-900 px-4 py-3 text-sm shadow-xl">
          {toast}
        </p>
      )}
      {route.view === 'home' && (
        <Home
          items={items}
          onNew={() => setRoute({ view: 'setup', id: null })}
          onOpen={(id) => setRoute({ view: 'view', id })}
          onDelete={remove}
          onDuplicate={duplicate}
          onImport={importFile}
        />
      )}
      {route.view === 'setup' && <Setup onCreate={create} onCancel={() => setRoute({ view: 'home', id: null })} />}
      {current && <TournamentView item={current} onChange={change} onBack={() => setRoute({ view: 'home', id: null })} />}
      <footer className="mt-12 border-t border-slate-800 pt-4 text-xs text-slate-500">
        Tus torneos se guardan solo en este navegador. Para llevarlos a otro dispositivo usa «Compartir enlace» o «Exportar».
      </footer>
    </div>
  );
}
