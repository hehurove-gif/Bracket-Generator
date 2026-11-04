export const FORMAT_LABEL = {
  single: 'Eliminación simple',
  double: 'Doble eliminación',
  roundrobin: 'Round robin',
  swiss: 'Suizo',
};

export const FORMAT_DESC = {
  single: 'Pierdes y quedas fuera. Rápido, ideal para muchos jugadores.',
  double: 'Necesitas perder dos veces para quedar fuera, como en Start.gg.',
  roundrobin: 'Todos contra todos con tabla de posiciones.',
  swiss: 'Rondas por puntos sin eliminar a nadie; empareja parecidos.',
};

export function maps(t) {
  return {
    names: new Map(t.players.map((p) => [p.id, p.name])),
    seeds: new Map(t.players.map((p, i) => [p.id, i + 1])),
  };
}

export const isElimination = (t) => t.format === 'single' || t.format === 'double';

export function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
