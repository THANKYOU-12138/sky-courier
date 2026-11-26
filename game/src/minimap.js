// minimap.js — the nav chart in the corner of the cockpit: the whole valley drawn
// north-up on one small card — the river, both roads, the town, the home runway, the
// ring course and the drop zones in the order they are flown, and the aeroplane as a
// wedge on its heading with a faint line to the target it is flying for.
// Design intent: the panel gauges say how the aeroplane is flying; the chart says
// where the sortie stands. It is drawn from the same layout constants and the same
// wind vector as the world and the model, so it can never show a different valley
// from the one outside the canopy — and it gives every frame, screenshots included,
// the shape of the whole game at a glance.

import { DROP_ZONES, RINGS, RUNWAY, WIND } from './config.js';
import { windVector } from './flight-model.js';
import { currentTarget } from './missions.js';
import { riverCenterX } from './terrain.js';

// The chart's window on the world: centred on the course, wide enough to hold the
// home runway at its south edge and the last drop zone at its north.
const VIEW = { cx: 100, cz: -3300, half: 4700 };
const CHART = 168; // the chart square, in stage pixels
const PANEL_W = CHART + 16;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Draw the nav chart with its panel's top-left corner at (x, y). `plane` and `sortie`
 * are the live game state; the chart reads them and draws nothing else.
 */
export function drawNavChart(ctx, x, y, plane, sortie) {
  const s = CHART / (VIEW.half * 2);
  const cx0 = x + 8 + CHART / 2;
  const cy0 = y + 30 + CHART / 2;
  const px = (wx) => cx0 + (wx - VIEW.cx) * s;
  const py = (wz) => cy0 + (wz - VIEW.cz) * s;

  ctx.save();
  roundRect(ctx, x, y, PANEL_W, CHART + 62, 8);
  ctx.fillStyle = 'rgba(10,16,22,0.72)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,180,84,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#ffb454';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('NAV CHART', x + 10, y + 20);
  ctx.fillStyle = 'rgba(243,234,216,0.75)';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('N', x + PANEL_W - 10, y + 20);

  // The chart itself, clipped so the river can wander without leaving the card.
  ctx.beginPath();
  ctx.rect(x + 8, y + 30, CHART, CHART);
  ctx.fillStyle = '#18242e';
  ctx.fill();
  ctx.clip();

  // The river, walked down its own centre line.
  ctx.strokeStyle = 'rgba(94,164,214,0.85)';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  for (let z = 1200; z >= -8000; z -= 260) {
    const rx = px(riverCenterX(z));
    const ry = py(z);
    if (z === 1200) ctx.moveTo(rx, ry);
    else ctx.lineTo(rx, ry);
  }
  ctx.stroke();

  // The two roads, and the town as a tan disc under its houses.
  ctx.strokeStyle = 'rgba(243,234,216,0.4)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(px(-720), py(1200));
  ctx.lineTo(px(-720), py(-8000));
  ctx.moveTo(px(-4500), py(-4600));
  ctx.lineTo(px(4700), py(-4600));
  ctx.stroke();
  ctx.fillStyle = 'rgba(216,185,138,0.55)';
  ctx.beginPath();
  ctx.arc(px(1500), py(-5300), Math.max(3, 250 * s), 0, Math.PI * 2);
  ctx.fill();

  // The home runway: a pale strip on the centreline.
  ctx.fillStyle = '#f3ead8';
  ctx.fillRect(px(RUNWAY.x) - 1.4, py(RUNWAY.zSouth), 2.8, (RUNWAY.zSouth - RUNWAY.zNorth) * s);

  // The course in order: rings as dots that turn green behind the aeroplane, the
  // active one ringed; drop zones as orange squares on the same terms.
  RINGS.forEach((ring, i) => {
    const done = sortie.stage !== 'rings' || i < sortie.ringIndex;
    const active = sortie.stage === 'rings' && i === sortie.ringIndex;
    ctx.fillStyle = done ? '#6edc82' : active ? '#ffb454' : 'rgba(255,214,140,0.55)';
    ctx.beginPath();
    ctx.arc(px(ring.x), py(ring.z), active ? 3.4 : 2.4, 0, Math.PI * 2);
    ctx.fill();
    if (active) {
      ctx.strokeStyle = 'rgba(255,180,84,0.8)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(px(ring.x), py(ring.z), 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  DROP_ZONES.forEach((zone, i) => {
    const done = (sortie.stage !== 'drops' && sortie.stage !== 'rings') || i < sortie.dropIndex;
    const active = sortie.stage === 'drops' && i === sortie.dropIndex;
    ctx.fillStyle = done ? '#6edc82' : active ? '#ff8c3c' : 'rgba(255,140,60,0.5)';
    const zx = px(zone.x);
    const zy = py(zone.z);
    ctx.fillRect(zx - 2.6, zy - 2.6, 5.2, 5.2);
    if (active) {
      ctx.strokeStyle = 'rgba(255,140,60,0.85)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(zx - 5.4, zy - 5.4, 10.8, 10.8);
    }
  });

  // The faint line to the target, then the aeroplane itself: a wedge on its heading.
  const target = currentTarget(sortie);
  if (target) {
    ctx.strokeStyle = 'rgba(255,180,84,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px(plane.x), py(plane.z));
    ctx.lineTo(px(target.x), py(target.z));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.save();
  ctx.translate(px(plane.x), py(plane.z));
  ctx.rotate(plane.heading);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffb454';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(0, -6.4);
  ctx.lineTo(4.4, 5);
  ctx.lineTo(0, 2.4);
  ctx.lineTo(-4.4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  // The wind line under the chart: the met report, and an arrow blown the way the
  // model blows — toward, not from, so it matches the drift the pilot feels.
  const wind = windVector();
  const wy = y + CHART + 48;
  ctx.save();
  ctx.fillStyle = 'rgba(243,234,216,0.75)';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`WIND ${WIND.fromDeg}° · ${Math.round(WIND.speed * 1.944)} KT`, x + 10, wy);
  const ax = x + PANEL_W - 26;
  const ay = wy - 4;
  const alen = 13;
  const dx = (wind.x / WIND.speed) * alen;
  const dy = (wind.z / WIND.speed) * alen;
  ctx.strokeStyle = '#ffb454';
  ctx.fillStyle = '#ffb454';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(ax - dx, ay - dy);
  ctx.lineTo(ax + dx, ay + dy);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ax + dx, ay + dy, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
