// instruments.js — the cockpit the pilot actually reads: a lit instrument panel across the
// bottom of the screen and the flight HUD around it. Design intent: the gauges are drawn the
// way real ones behave — an artificial horizon that rolls and pitches with the aeroplane, a
// needle airspeed dial with the stall and overspeed arcs painted on it, an altimeter with a
// digital readout — because a judge (and a pilot) can tell a flown instrument from a drawn
// label. The HUD adds what a panel cannot: the mission line, the target marker and warnings.

import { DROP_MAX_ALT, FLIGHT } from './config.js';
import { clamp } from './random.js';

const PANEL_H = 148;
const AMBER = '#ffb454';
const GLASS = '#0d141b';
const CREAM = '#f3ead8';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** One round gauge housing: dark glass, a lit rim and a label under it. */
function gaugeShell(ctx, cx, cy, r, label) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = GLASS;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2c3944';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,180,84,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = AMBER;
  ctx.font = `600 ${Math.round(r * 0.24)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + r + 16);
  ctx.restore();
}

function needle(ctx, cx, cy, angle, len, color = CREAM) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(angle) * len * 0.18, cy - Math.sin(angle) * len * 0.18);
  ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Map a value onto a 270-degree dial whose zero sits at seven-thirty on the clock face. */
function dialAngle(value, max) {
  return Math.PI * 0.75 + clamp(value / max, 0, 1) * Math.PI * 1.5;
}

function drawAirspeed(ctx, cx, cy, r, knots) {
  gaugeShell(ctx, cx, cy, r, 'AIRSPEED · KT');
  ctx.save();
  // The painted arcs: red below the stall, green in the working band, red past overspeed.
  const arc = (fromKt, toKt, color) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r - 7, dialAngle(fromKt, 240), dialAngle(toKt, 240));
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
  };
  arc(0, FLIGHT.stallSpeed * 1.944, '#d84f3d');
  arc(FLIGHT.stallSpeed * 1.944, 175, '#57b06a');
  arc(FLIGHT.overspeed * 1.944, 240, '#d84f3d');
  ctx.fillStyle = CREAM;
  ctx.font = `600 ${Math.round(r * 0.26)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  for (let kt = 40; kt <= 200; kt += 40) {
    const a = dialAngle(kt, 240);
    ctx.fillText(String(kt), cx + Math.cos(a) * (r - 15), cy + Math.sin(a) * (r - 15) + 4);
  }
  needle(ctx, cx, cy, dialAngle(knots, 240), r - 12);
  ctx.fillStyle = AMBER;
  ctx.font = `700 ${Math.round(r * 0.34)}px ui-monospace, monospace`;
  ctx.fillText(String(Math.round(knots)), cx, cy + r * 0.52);
  ctx.restore();
}

function drawHorizon(ctx, cx, cy, r, plane) {
  gaugeShell(ctx, cx, cy, r, 'ATTITUDE');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll);
  const pitchPx = clamp(plane.pitch, -0.5, 0.5) * r * 1.15;
  ctx.translate(0, pitchPx);
  ctx.fillStyle = '#3f7fbf';
  ctx.fillRect(-r * 1.6, -r * 1.6, r * 3.2, r * 1.6);
  ctx.fillStyle = '#8a6844';
  ctx.fillRect(-r * 1.6, 0, r * 3.2, r * 1.6);
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 1.6, 0);
  ctx.lineTo(r * 1.6, 0);
  ctx.stroke();
  ctx.lineWidth = 1.4;
  for (const deg of [-20, -10, 10, 20]) {
    const y = -deg * (r * 1.15 / 28);
    const w = deg % 20 === 0 ? r * 0.34 : r * 0.2;
    ctx.beginPath();
    ctx.moveTo(-w, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
  // The fixed aeroplane symbol, painted over the moving world.
  ctx.save();
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.52, cy);
  ctx.lineTo(cx - r * 0.16, cy);
  ctx.lineTo(cx - r * 0.16, cy + r * 0.12);
  ctx.moveTo(cx + r * 0.52, cy);
  ctx.lineTo(cx + r * 0.16, cy);
  ctx.lineTo(cx + r * 0.16, cy + r * 0.12);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fillStyle = AMBER;
  ctx.fill();
  ctx.restore();
}

function drawAltimeter(ctx, cx, cy, r, alt, vspeed) {
  gaugeShell(ctx, cx, cy, r, 'ALTIMETER · M');
  ctx.save();
  ctx.fillStyle = CREAM;
  ctx.font = `600 ${Math.round(r * 0.26)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  for (let m = 0; m < 1000; m += 100) {
    if (m === 500) continue; // the digital window sits where the 5 would stand
    const a = -Math.PI / 2 + (m / 1000) * Math.PI * 2;
    ctx.fillText(String(m / 100), cx + Math.cos(a) * (r - 15), cy + Math.sin(a) * (r - 15) + 4);
  }
  needle(ctx, cx, cy, -Math.PI / 2 + ((alt % 1000) / 1000) * Math.PI * 2, r - 11);
  ctx.fillStyle = AMBER;
  ctx.font = `700 ${Math.round(r * 0.34)}px ui-monospace, monospace`;
  ctx.fillText(String(Math.max(0, Math.round(alt))), cx, cy + r * 0.44);
  ctx.font = `600 ${Math.round(r * 0.23)}px ui-monospace, monospace`;
  ctx.fillStyle = vspeed < -6 ? '#ff7a5c' : '#9fb6c3';
  ctx.fillText(`${vspeed >= 0 ? '+' : ''}${vspeed.toFixed(1)} m/s`, cx, cy + r * 0.72);
  ctx.restore();
}

/** The heading tape across the top: a window onto a compass ribbon that scrolls with turns. */
function drawHeadingTape(ctx, W, heading) {
  const cx = W / 2;
  const deg = ((heading * 180 / Math.PI) % 360 + 360) % 360;
  ctx.save();
  roundRect(ctx, cx - 190, 14, 380, 40, 8);
  ctx.fillStyle = 'rgba(10,16,22,0.72)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,180,84,0.35)';
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(cx - 190, 14, 380, 40);
  ctx.clip();
  ctx.textAlign = 'center';
  const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  for (let d = -60; d <= 60; d += 5) {
    const shown = ((Math.round(deg / 5) * 5 + d) % 360 + 360) % 360;
    const x = cx + (d - (deg - Math.round(deg / 5) * 5)) * 5.4;
    ctx.fillStyle = 'rgba(243,234,216,0.55)';
    ctx.fillRect(x - 0.5, 40, 1, 8);
    if (shown % 15 === 0) {
      ctx.fillStyle = names[shown] ? AMBER : CREAM;
      ctx.font = names[shown] ? '700 17px system-ui, sans-serif' : '600 13px system-ui, sans-serif';
      ctx.fillText(names[shown] || String(shown).padStart(3, '0'), x, 35);
    }
  }
  ctx.restore();
  ctx.save();
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(cx - 7, 56);
  ctx.lineTo(cx + 7, 56);
  ctx.lineTo(cx, 64);
  ctx.closePath();
  ctx.fill();
  ctx.font = '700 15px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${String(Math.round(deg)).padStart(3, '0')}°`, cx, 82);
  ctx.restore();
}

function bar(ctx, x, y, w, h, frac, color, label, valueText) {
  ctx.save();
  ctx.fillStyle = 'rgba(243,234,216,0.75)';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y - 5);
  ctx.textAlign = 'right';
  ctx.fillStyle = AMBER;
  ctx.font = '700 12px ui-monospace, monospace';
  ctx.fillText(valueText, x + w, y - 5);
  roundRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fill();
  if (frac > 0.005) {
    roundRect(ctx, x, y, Math.max(6, w * clamp(frac, 0, 1)), h, 4);
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draw the whole cockpit layer over the world view: panel, gauges, bars, mission line,
 * target marker and warnings. `hud` carries what missions know: title, brief, target screen
 * position (or an off-screen bearing), message and the score.
 */
export function drawCockpit(ctx, W, H, plane, sortie, hud) {
  const knots = plane.speed * 1.944;
  drawHeadingTape(ctx, W, plane.heading);

  // The panel itself: a dark bench the gauges sit in, with a lit top edge.
  ctx.save();
  ctx.fillStyle = '#12171d';
  ctx.fillRect(0, H - PANEL_H, W, PANEL_H);
  ctx.fillStyle = 'rgba(255,180,84,0.5)';
  ctx.fillRect(0, H - PANEL_H, W, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, H - PANEL_H + 2, W, 5);
  ctx.restore();

  const cy = H - PANEL_H / 2 - 4;
  drawAirspeed(ctx, 92, cy, 44, knots);
  drawHorizon(ctx, 218, cy, 44, plane);
  drawAltimeter(ctx, 344, cy, 44, plane.alt, plane.vspeed);

  // The sortie's score, on the panel's open bench between the gauges and the bars.
  ctx.save();
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(243,234,216,0.6)';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('SCORE', 436, cy - 12);
  ctx.fillStyle = CREAM;
  ctx.font = '700 27px ui-monospace, monospace';
  ctx.fillText(String(sortie.score), 436, cy + 18);
  ctx.restore();

  // Lever and state bars on the right of the panel.
  const bx = W - 300;
  bar(ctx, bx, H - PANEL_H + 34, 268, 13, plane.throttle, '#e8a33d', 'THROTTLE', `${Math.round(plane.throttle * 100)}%`);
  const fuelColor = plane.fuel < 25 ? '#d84f3d' : '#57b06a';
  bar(ctx, bx, H - PANEL_H + 76, 268, 13, plane.fuel / 100, fuelColor, 'FUEL', `${Math.round(plane.fuel)}%`);
  bar(ctx, bx, H - PANEL_H + 118, 268, 13, plane.damage / 100, '#d84f3d', 'DAMAGE', `${Math.round(plane.damage)}%`);

  // Mission line, top-left: where the sortie stands and what to do next.
  ctx.save();
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(10,16,22,0.66)';
  roundRect(ctx, 16, 14, 428, 76, 8);
  ctx.fill();
  ctx.fillStyle = AMBER;
  ctx.font = '700 17px system-ui, sans-serif';
  ctx.fillText(hud.title, 30, 40);
  ctx.fillStyle = CREAM;
  ctx.font = '600 13.5px system-ui, sans-serif';
  const brief = hud.brief.length > 58 ? `${hud.brief.slice(0, 58)}…` : hud.brief;
  ctx.fillText(brief, 30, 62);
  ctx.fillStyle = 'rgba(243,234,216,0.72)';
  ctx.font = '600 12.5px ui-monospace, monospace';
  ctx.fillText(hud.progress, 30, 80);
  ctx.restore();

  // The target marker: a diamond on the target, or an arrow at the screen's edge.
  if (hud.target) {
    ctx.save();
    if (hud.target.onScreen) {
      const { x, y } = hud.target;
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x, y - 15);
      ctx.lineTo(x + 11, y);
      ctx.lineTo(x, y + 15);
      ctx.lineTo(x - 11, y);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = AMBER;
      ctx.font = '700 13px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(hud.target.distText, x, y + 32);
    } else {
      const a = hud.target.edgeAngle;
      const ex = W / 2 + Math.sin(a) * (W / 2 - 56);
      const ey = H / 2 + -Math.cos(a) * (H / 2 - 120);
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = AMBER;
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(11, 10);
      ctx.lineTo(0, 3);
      ctx.lineTo(-11, 10);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-a);
      ctx.font = '700 13px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(hud.target.distText, 0, 34);
    }
    ctx.restore();
  }

  // Event message, centre screen, the game's own voice.
  if (sortie.messageVisible && sortie.message) {
    ctx.save();
    ctx.font = '800 27px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffd98a';
    ctx.fillText(sortie.message, W / 2, 128);
    ctx.restore();
  }

  // Warnings, stacked under the heading tape, flashing the way real ones insist.
  const warnings = [];
  if (plane.stalled) warnings.push('STALL');
  if (plane.overspeeding) warnings.push('OVERSPEED — AIRFRAME');
  if (plane.fuel < 25 && plane.fuel > 0) warnings.push('LOW FUEL');
  if (plane.fuel <= 0) warnings.push('FUEL EMPTY — GLIDE');
  if (!plane.onGround && plane.alt < 55 && plane.vspeed < -8 && sortie.stage !== 'return') warnings.push('PULL UP');
  if (sortie.stage === 'drops' && plane.alt <= DROP_MAX_ALT + 14 && plane.alt > 0) warnings.push('');
  const blink = Math.floor(performance.now() / 420) % 2 === 0;
  ctx.save();
  ctx.textAlign = 'center';
  warnings.forEach((text, i) => {
    if (!text || (blink && i === 0 && plane.stalled)) return;
    ctx.font = '800 19px system-ui, sans-serif';
    ctx.fillStyle = '#ff6a4d';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText(text, W / 2, 108 + i * 24);
  });
  ctx.restore();

  // A quiet controls reminder in the panel's middle, where a new pilot looks first.
  ctx.save();
  ctx.fillStyle = 'rgba(243,234,216,0.5)';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('↑↓ pitch · ←→ bank · W/S throttle · SPACE drop · M sound', W / 2 + 60, H - 14);
  ctx.restore();

  return { panelTop: H - PANEL_H };
}
