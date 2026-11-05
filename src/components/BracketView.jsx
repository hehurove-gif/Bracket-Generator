import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CARD_H, CARD_W, computeLayout } from '../lib/layout.js';
import MatchCard from './MatchCard.jsx';

const MIN_K = 0.15;
const MAX_K = 2.2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* Lienzo del bracket: se arrastra para moverlo, rueda / pellizco / botones para el zoom,
   y se puede pasar a pantalla completa (útil para proyectarlo o para stream). */
export default function BracketView({ t, names, seeds, colors, hl, setHl, onOpen, readOnly, height = '70vh' }) {
  const layout = useMemo(() => computeLayout(t), [t]);
  const byId = useMemo(() => new Map(t.matches.map((m) => [m.id, m])), [t]);
  const wrapRef = useRef(null);
  const viewRef = useRef(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [full, setFull] = useState(false);
  const ptrs = useRef(new Map());
  const travel = useRef(0);
  const pinch = useRef(0);
  const fitted = useRef('');

  const fit = useCallback(() => {
    const el = viewRef.current;
    if (!el) return;
    const { clientWidth: vw, clientHeight: vh } = el;
    const k = clamp(Math.min(vw / layout.width, vh / layout.height, 1), MIN_K, 1);
    setView({ k, x: Math.max(8, (vw - layout.width * k) / 2), y: 8 });
  }, [layout.width, layout.height]);

  // Ajuste automático solo cuando cambia la estructura (no en cada marcador).
  const structureKey = `${t.format}|${t.players.length}|${layout.width}x${layout.height}`;
  useLayoutEffect(() => {
    if (fitted.current !== structureKey) {
      fitted.current = structureKey;
      fit();
    }
  }, [structureKey, fit]);

  useEffect(() => {
    const el = viewRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      setView((v) => {
        const k = clamp(v.k * Math.exp(-e.deltaY * 0.0015), MIN_K, MAX_K);
        const f = k / v.k;
        return { k, x: px - (px - v.x) * f, y: py - (py - v.y) * f };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    if (full) fit();
  }, [full, fit]);

  const zoomBy = (f) =>
    setView((v) => {
      const el = viewRef.current;
      const cx = el.clientWidth / 2;
      const cy = el.clientHeight / 2;
      const k = clamp(v.k * f, MIN_K, MAX_K);
      const g = k / v.k;
      return { k, x: cx - (cx - v.x) * g, y: cy - (cy - v.y) * g };
    });

  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await wrapRef.current.requestFullscreen();
    } catch {
      /* algunos navegadores móviles no lo permiten */
    }
  };

  const onPointerDown = (e) => {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    travel.current = 0;
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onPointerMove = (e) => {
    const prev = ptrs.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    ptrs.current.set(e.pointerId, cur);
    if (ptrs.current.size === 1) {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      travel.current += Math.abs(dx) + Math.abs(dy);
      if (travel.current > 6) setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    } else if (ptrs.current.size === 2) {
      travel.current = 99;
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current) {
        const r = viewRef.current.getBoundingClientRect();
        const cx = (a.x + b.x) / 2 - r.left;
        const cy = (a.y + b.y) / 2 - r.top;
        const f = d / pinch.current;
        setView((v) => {
          const k = clamp(v.k * f, MIN_K, MAX_K);
          const g = k / v.k;
          return { k, x: cx - (cx - v.x) * g, y: cy - (cy - v.y) * g };
        });
      }
      pinch.current = d;
    }
  };
  const onPointerUp = (e) => {
    ptrs.current.delete(e.pointerId);
    pinch.current = 0;
  };

  // Referencia estable para que las tarjetas memorizadas no se repinten en cada render.
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const open = useCallback((m) => {
    if (travel.current > 6) return; // fue un arrastre, no un clic
    onOpenRef.current?.(m);
  }, []);

  return (
    <div ref={wrapRef} className={`relative flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60 ${full ? 'bg-slate-950' : ''}`}>
      <div className="order-first flex items-center justify-end gap-1 border-b border-slate-800 bg-slate-900/60 p-1">
        <button type="button" className="btn btn-ghost !px-2.5" onClick={() => zoomBy(1 / 1.25)} aria-label="Alejar">−</button>
        <span className="w-11 text-center font-mono text-xs text-slate-400">{Math.round(view.k * 100)}%</span>
        <button type="button" className="btn btn-ghost !px-2.5" onClick={() => zoomBy(1.25)} aria-label="Acercar">+</button>
        <button type="button" className="btn btn-ghost" onClick={fit}>Ajustar</button>
        <button type="button" className="btn btn-ghost" onClick={toggleFull} aria-label={full ? 'Salir de pantalla completa' : 'Pantalla completa'}>
          <span aria-hidden="true">⛶</span>
          <span className="hidden sm:inline">{full ? 'Salir' : 'Pantalla completa'}</span>
        </button>
      </div>
      <div
        ref={viewRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        className="relative cursor-grab touch-none overflow-hidden active:cursor-grabbing"
        style={{ height: full ? 'calc(100vh - 44px)' : height, minHeight: 320 }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: layout.width, height: layout.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
        >
          <svg className="pointer-events-none absolute left-0 top-0" width={layout.width} height={layout.height} aria-hidden="true">
            {layout.lines.map((l) => {
              const mid = l.mid ?? l.x1 + (l.x2 - l.x1) / 2;
              const hot = hl && [l.from, l.to].some((id) => {
                const m = byId.get(id);
                return m && (m.a === hl || m.b === hl);
              });
              return (
                <path
                  key={l.id}
                  d={`M${l.x1} ${l.y1} H${mid} V${l.y2} H${l.x2}`}
                  fill="none"
                  stroke={hot ? '#22d3ee' : '#334155'}
                  strokeWidth={hot ? 2 : 1.5}
                  strokeDasharray={l.dashed ? '5 4' : undefined}
                />
              );
            })}
          </svg>

          {layout.titles.map((s) => (
            <div key={s.key} className="absolute font-mono text-xs uppercase tracking-widest text-violet-300" style={{ left: 24, top: s.y }}>
              {s.title}
            </div>
          ))}
          {layout.headers.map((h) => (
            <div key={h.key} className="absolute text-xs font-medium text-slate-400" style={{ left: h.x, top: h.y, width: CARD_W }}>
              {h.label}
            </div>
          ))}
          {layout.nodes.map(({ m, x, y }) => (
            <MatchCard
              key={m.id}
              m={m}
              names={names}
              seeds={seeds}
              colors={colors}
              hlA={!!hl && m.a === hl}
              hlB={!!hl && m.b === hl}
              setHl={setHl}
              onOpen={open}
              readOnly={readOnly}
              x={x}
              y={y}
            />
          ))}
        </div>
      </div>

      {!full && (
        <p className="border-t border-slate-800 px-3 py-1.5 text-[11px] text-slate-500">
          Arrastra para mover · rueda o pellizco para el zoom · pasa el cursor sobre un jugador para seguir su camino
        </p>
      )}
    </div>
  );
}
