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

/* Un color por jugador (según su posición de seeding). Los primeros 12 son tonos bien separados;
   después se desplazan el tono y la luminosidad para no repetirse. Se usa siempre junto al nombre,
   nunca como único identificador. */
const HUES = [190, 265, 330, 40, 150, 15, 215, 95, 290, 60, 175, 345];
export function playerColor(i) {
  const round = Math.floor(i / HUES.length);
  const hue = (HUES[i % HUES.length] + round * 23) % 360;
  const light = 70 + (round % 3) * 4;
  return `hsl(${hue} 85% ${light}%)`;
}

export function maps(t) {
  return {
    names: new Map(t.players.map((p) => [p.id, p.name])),
    seeds: new Map(t.players.map((p, i) => [p.id, i + 1])),
    colors: new Map(t.players.map((p, i) => [p.id, playerColor(i)])),
  };
}

export const isElimination = (t) => t.format === 'single' || t.format === 'double';

/* "Bo3", "Bo3 → Bo5" (iniciales → avanzadas) o '' en torneos viejos de partido único. */
export function boLabel(t) {
  const e = t.settings.bestOfEarly ?? t.settings.bestOf;
  const l = t.settings.bestOfLate ?? e;
  if (!e || e === 1) return '';
  return !isElimination(t) || e === l ? `Bo${e}` : `Bo${e} → Bo${l}`;
}

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
