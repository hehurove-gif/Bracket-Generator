# Bracket

Generador de brackets de torneo **sin cuentas**: pega la lista de jugadores, ajusta el seeding, simula cómo quedaría y reporta marcadores. Todo se guarda en el navegador; nada se sube a ningún servidor.

Hecho con React, Vite y Tailwind CSS. Parte de las herramientas gratuitas de Hetor (`hetor.dev/tools/bracket`).

## Qué hace

- **4 formatos** que se eligen al crear el torneo: eliminación simple (con BYEs y 3er lugar opcional), doble eliminación (winners/losers, gran final con reset opcional), round robin (ida y vuelta opcional) y suizo (rondas automáticas, sin revanchas, Buchholz de desempate).
- **Seeding**: orden manual (arrastrar o flechas), aleatorio, A–Z o invertido, con vista previa en vivo del bracket.
- **Simular**: prueba cómo terminaría el torneo con tu seeding (con control de "sorpresas") antes de crearlo, o simula lo que falta de un torneo en curso y decide si conservarlo o descartarlo.
- **Marcadores**: partido único o al mejor de 3/5/7, empates en round robin/suizo. Si corriges un resultado, lo que dependía de él se reinicia solo.
- **Arrastrar nombres**: en eliminación simple/doble puedes arrastrar a un jugador sobre otro (o sobre un lugar de BYE) para intercambiarlos y adaptar el bracket a mano. Con ratón empieza al mover; en táctil, con pulsación larga. Si el cambio borra resultados pide confirmación y se puede deshacer. En la vista previa de la configuración intercambia los seeds. Los cambios se conservan al compartir/exportar.
- **Bracket movible**: arrastrar, zoom con rueda o pellizco, ajustar a pantalla, pantalla completa y resaltado del camino de un jugador.
- **Compartir**: enlace (el torneo viaja dentro del `#`, comprimido) o archivo `.json`.

## Desarrollo

```bash
npm install
npm run dev
npm test      # motor de torneos, enlaces y layout
npm run build
```

La lógica vive en `src/lib/engine.js` (sin UI, con pruebas en `tests/`).

## Deploy en Cloudflare

Hoy se sirve en la raíz con `wrangler.jsonc` (`npx wrangler deploy`, Build command `npm run build`).

### Cuando `hetor.dev` esté en Cloudflare (hetor.dev/tools/bracket)

1. Worker `bracket` → Settings → Build: variable `VITE_BASE_PATH=/tools/bracket/` y Deploy command `npx wrangler deploy -c wrangler.domain.jsonc`.
2. Despliega de nuevo. La ruta `hetor.dev/tools/bracket*` tiene prioridad sobre el Worker de Hetor.

Probar en local: `VITE_BASE_PATH=/tools/bracket/ npm run build`.
