// render.js — the world as the pilot sees it: a chase view over a patchwork valley, drawn
// with a banded ground projection (the classic strip-by-strip landscape) and projected
// objects, all in flat colours with distance fog so the whole scene holds one style.
// Design intent: the screenshots are the game as far as a first glance is concerned, so this
// module spends its effort on what reads at a glance — a recognisable valley (fields, a
// snaking river, a road, a town), the runway with its markings, rings that glow against the
// sky, and an aeroplane drawn like a built thing, with a canopy, panel lines and wingtip
// lights, sitting in the lower centre of the frame with its shadow on the ground below.

import { DROP_ZONES, FOCAL, PALETTE, RING_RADIUS, RINGS, RUNWAY, STAGE } from './config.js';
import { clamp, headingDelta, mixCss } from './random.js';
import { cloudField, groundColorAt, ridgeHeight, scatterObjects } from './terrain.js';

const W = STAGE.width;
const H = STAGE.height;
const CX = W / 2;

/** The whole valley's still objects and clouds, placed once: the world never changes. */
export const WORLD_OBJECTS = scatterObjects(-3400, -11400, 3400, 2000);
export const CLOUDS = cloudField();

/** Where the horizon sits for a given pitch: nose up, and the world sinks in the frame. */
export function horizonFor(plane) {
  return H * 0.44 + plane.pitch * 300;
}

/** The chase camera's ground position and height, trailing behind and above the aeroplane. */
function cameraFor(plane) {
  return {
    x: plane.x - Math.sin(plane.heading) * 16,
    z: plane.z + Math.cos(plane.heading) * 16,
    alt: plane.alt + 6.5,
  };
}

/**
 * Project a world point to the stage. Returns { x, y, f } with f the forward distance, or
 * null when the point is behind the camera. Used for objects, decals and the HUD marker.
 */
export function project(plane, x, z, y) {
  const cam = cameraFor(plane);
  const dx = x - cam.x;
  const dz = z - cam.z;
  const f = dx * Math.sin(plane.heading) + dz * -Math.cos(plane.heading);
  if (f <= 2) return null;
  const l = dx * Math.cos(plane.heading) + dz * Math.sin(plane.heading);
  return {
    x: CX + (l * FOCAL) / f,
    y: horizonFor(plane) + ((cam.alt - y) * FOCAL) / f,
    f,
  };
}

function drawSky(ctx, plane) {
  const horizon = horizonFor(plane);
  const grad = ctx.createLinearGradient(0, -400, 0, horizon + 30);
  grad.addColorStop(0, '#2f62a4');
  grad.addColorStop(0.55, '#7fb0d6');
  grad.addColorStop(1, '#dfeef5');
  ctx.fillStyle = grad;
  ctx.fillRect(-520, -520, W + 1040, horizon + 560);

  // The sun, fixed in the southwest: a glow and a disc where its bearing puts it.
  const sunBearing = headingDelta(plane.heading, (235 * Math.PI) / 180);
  if (Math.abs(sunBearing) < 1.25) {
    const sx = CX + Math.tan(sunBearing) * FOCAL;
    const sy = horizon - 0.52 * FOCAL;
    const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 150);
    glow.addColorStop(0, 'rgba(255,236,170,0.85)');
    glow.addColorStop(0.25, 'rgba(255,224,140,0.35)');
    glow.addColorStop(1, 'rgba(255,224,140,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 160, sy - 160, 320, 320);
    ctx.beginPath();
    ctx.arc(sx, sy, 21, 0, Math.PI * 2);
    ctx.fillStyle = '#fff3c4';
    ctx.fill();
  }

  // Two ridge lines on the horizon, near and far, so the valley has an edge.
  for (const [amp, base, phase, color] of [
    [30, 4, 1.7, 'rgb(150,176,200)'],
    [44, 8, 0, 'rgb(128,160,184)'],
  ]) {
    ctx.beginPath();
    ctx.moveTo(-520, horizon + 2);
    for (let sx = -520; sx <= W + 520; sx += 22) {
      const bearing = plane.heading + Math.atan((sx - CX) / FOCAL) + phase;
      ctx.lineTo(sx, horizon - ridgeHeight(bearing) * amp - base);
    }
    ctx.lineTo(W + 520, horizon + 2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function drawClouds(ctx, plane) {
  ctx.save();
  for (const cloud of CLOUDS) {
    const p = project(plane, cloud.x, cloud.z, cloud.alt);
    if (!p || p.f > 8000) continue;
    const s = (cloud.size * FOCAL) / p.f;
    if (s < 6) continue;
    const alpha = clamp(0.92 - p.f / 9000, 0.25, 0.9);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    for (const [ox, oy, r] of [[-0.42, 0.08, 0.34], [0, -0.06, 0.46], [0.44, 0.08, 0.32], [0.05, 0.14, 0.4]]) {
      ctx.beginPath();
      ctx.ellipse(p.x + ox * s, p.y + oy * s * 0.4, r * s, r * s * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = `rgba(214,228,238,${alpha * 0.8})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + s * 0.13, s * 0.52, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// The ground, band by band from the horizon to the camera's feet.
const BANDS = (() => {
  const out = [];
  let f = 7;
  while (f < 7600) {
    const next = f * 1.145;
    out.push([f, next]);
    f = next;
  }
  return out;
})();

function drawGround(ctx, plane) {
  const cam = cameraFor(plane);
  const horizon = horizonFor(plane);
  const sinH = Math.sin(plane.heading);
  const cosH = Math.cos(plane.heading);
  const SEGMENTS = 26;
  ctx.save();
  for (let b = BANDS.length - 1; b >= 0; b -= 1) {
    const [f0, f1] = BANDS[b];
    const fc = (f0 + f1) / 2;
    const halfWidth = (f1 * (CX + 90)) / FOCAL;
    const y0 = horizon + (cam.alt * FOCAL) / f0;
    const y1 = horizon + (cam.alt * FOCAL) / f1;
    const fog = clamp(1 - Math.exp(-fc / 2300), 0, 0.82);
    for (let s = 0; s < SEGMENTS; s += 1) {
      const l0 = -halfWidth + (2 * halfWidth * s) / SEGMENTS;
      const l1 = -halfWidth + (2 * halfWidth * (s + 1)) / SEGMENTS;
      const lc = (l0 + l1) / 2;
      const wx = cam.x + sinH * fc + cosH * lc;
      const wz = cam.z - cosH * fc + sinH * lc;
      const color = groundColorAt(wx, wz);
      ctx.fillStyle = fog > 0.02 ? mixCss(color, PALETTE.fog, fog) : `rgb(${color[0]},${color[1]},${color[2]})`;
      ctx.beginPath();
      ctx.moveTo(CX + (l0 * FOCAL) / f0, y0);
      ctx.lineTo(CX + (l1 * FOCAL) / f0, y0);
      ctx.lineTo(CX + (l1 * FOCAL) / f1, y1);
      ctx.lineTo(CX + (l0 * FOCAL) / f1, y1);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/** A flat quad on the ground: four world corners, one colour — runway paint and markings. */
function groundQuad(ctx, plane, corners, color) {
  const pts = corners.map(([x, z]) => project(plane, x, z, 0));
  if (pts.some((p) => !p)) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < 4; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawRunwayMarkings(ctx, plane) {
  const hw = RUNWAY.width / 2;
  // Threshold bars at both ends.
  for (const endZ of [RUNWAY.zNorth + 14, RUNWAY.zSouth - 14]) {
    for (let i = 0; i < 4; i += 1) {
      const x0 = -hw + 4 + i * ((hw * 2 - 8) / 4);
      groundQuad(ctx, plane, [[x0, endZ - 7], [x0 + 6.5, endZ - 7], [x0 + 6.5, endZ + 7], [x0, endZ + 7]], 'rgba(240,240,235,0.9)');
    }
  }
  // The centreline dashes a pilot lines up on.
  for (let z = RUNWAY.zNorth + 46; z < RUNWAY.zSouth - 30; z += 62) {
    groundQuad(ctx, plane, [[-1.1, z], [1.1, z], [1.1, z + 26], [-1.1, z + 26]], 'rgba(240,240,235,0.75)');
  }
  // Edge lines.
  for (const ex of [-hw + 1.2, hw - 1.2]) {
    for (let z = RUNWAY.zNorth; z < RUNWAY.zSouth - 90; z += 92) {
      groundQuad(ctx, plane, [[ex - 0.7, z], [ex + 0.7, z], [ex + 0.7, z + 92], [ex - 0.7, z + 92]], 'rgba(240,240,235,0.5)');
    }
  }
}

/** One airfield light: a soft glow and a hard core, sized by its distance. */
function lightDot(ctx, plane, x, z, rgb, core = 1.05) {
  const p = project(plane, x, z, 0.9);
  if (!p || p.f > 2600) return;
  const r = Math.max(1.1, (core * FOCAL) / p.f);
  ctx.fillStyle = `rgba(${rgb},0.26)`;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * 2.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(${rgb},0.95)`;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * The airfield's lights — pure dressing, no rules attached: warm edge lights down both
 * sides of the strip, green across both thresholds, and a four-unit PAPI beside the
 * touchdown zone whose white-over-red count follows the aeroplane's actual slope to
 * the threshold it is approaching (two white, two red on the game's own glide slope).
 */
function drawRunwayLights(ctx, plane) {
  const hw = RUNWAY.width / 2;
  ctx.save();
  for (const ex of [-hw - 2.5, hw + 2.5]) {
    for (let z = RUNWAY.zNorth + 30; z <= RUNWAY.zSouth - 20; z += 60) {
      lightDot(ctx, plane, ex, z, '255,238,190');
    }
  }
  for (const endZ of [RUNWAY.zNorth + 3, RUNWAY.zSouth - 3]) {
    for (let x = -hw + 5; x <= hw - 5; x += 8) lightDot(ctx, plane, x, endZ, '80,255,140');
  }
  const fromNorth = plane.z < RUNWAY.zNorth;
  const fromSouth = plane.z > RUNWAY.zSouth;
  if ((fromNorth || fromSouth) && !plane.onGround && plane.alt > 2) {
    const endZ = fromNorth ? RUNWAY.zNorth : RUNWAY.zSouth;
    const dist = Math.max(30, Math.abs(endZ - plane.z));
    const slope = plane.alt / dist;
    const whites = clamp(2 + Math.round((slope - 0.085) / 0.014), 0, 4);
    const papiZ = endZ + (fromNorth ? 95 : -95);
    for (let i = 0; i < 4; i += 1) {
      const p = project(plane, -(hw + 9 + i * 3.4), papiZ, 0.6);
      if (!p || p.f > 2200) continue;
      const bs = Math.max(1.8, (1.7 * FOCAL) / p.f);
      const white = i >= 4 - whites;
      ctx.fillStyle = white ? 'rgba(255,246,225,0.3)' : 'rgba(255,70,55,0.3)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, bs * 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = white ? '#fff6e1' : '#ff4637';
      ctx.fillRect(p.x - bs * 0.85, p.y - bs * 0.55, bs * 1.7, bs * 1.1);
    }
  }
  ctx.restore();
}

function drawTree(ctx, p, sizePx, tone) {
  const h = sizePx;
  ctx.fillStyle = '#6d5136';
  ctx.fillRect(p.x - h * 0.035, p.y - h * 0.3, h * 0.07, h * 0.3);
  const greens = ['#3f7031', '#4c7d38', '#356529'];
  ctx.fillStyle = greens[Math.floor(tone * 3) % 3];
  for (const [oy, r] of [[0.42, 0.3], [0.68, 0.23], [0.92, 0.15]]) {
    ctx.beginPath();
    ctx.moveTo(p.x - r * h, p.y - oy * h + r * h * 0.4);
    ctx.lineTo(p.x + r * h, p.y - oy * h + r * h * 0.4);
    ctx.lineTo(p.x, p.y - (oy + r * 1.5) * h + r * h * 0.4);
    ctx.closePath();
    ctx.fill();
  }
}

function drawHouse(ctx, p, sizePx, tone) {
  const w = sizePx * 1.15;
  const h = sizePx * 0.62;
  const walls = ['#e8dcc4', '#d9b48f', '#cfd6d4', '#e3c9c9'][Math.floor(tone * 4) % 4];
  const roofs = ['#a8542f', '#5d6a72', '#7a4a3a'][Math.floor(tone * 7) % 3];
  ctx.fillStyle = walls;
  ctx.fillRect(p.x - w / 2, p.y - h, w, h);
  ctx.fillStyle = roofs;
  ctx.beginPath();
  ctx.moveTo(p.x - w * 0.62, p.y - h);
  ctx.lineTo(p.x + w * 0.62, p.y - h);
  ctx.lineTo(p.x, p.y - h - sizePx * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,214,120,0.9)';
  ctx.fillRect(p.x - w * 0.18, p.y - h * 0.62, w * 0.13, h * 0.2);
}

function drawRing(ctx, plane, ring, index, sortie) {
  const p = project(plane, ring.x, ring.z, ring.alt);
  if (!p || p.f > 7000) return;
  const R = (RING_RADIUS * FOCAL) / p.f;
  if (R < 3) return;
  const isActive = sortie.stage === 'rings' && sortie.ringIndex === index;
  const isDone = sortie.stage !== 'rings' || index < sortie.ringIndex;
  ctx.save();
  if (isActive) {
    // A light pillar under the active ring, so its height can be judged at a glance.
    const g = project(plane, ring.x, ring.z, 0);
    if (g) {
      const grad = ctx.createLinearGradient(0, p.y, 0, g.y);
      grad.addColorStop(0, 'rgba(255,180,84,0.30)');
      grad.addColorStop(1, 'rgba(255,180,84,0.02)');
      ctx.fillStyle = grad;
      ctx.fillRect(p.x - 2, p.y, 4, g.y - p.y);
    }
    const pulse = 1 + Math.sin(plane.time * 4) * 0.05;
    ctx.strokeStyle = 'rgba(255,180,84,0.35)';
    ctx.lineWidth = (2.6 * FOCAL) / p.f + 7;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, R * pulse, R * 0.94 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffb454';
  } else if (isDone) {
    ctx.strokeStyle = 'rgba(110,220,130,0.5)';
  } else {
    ctx.strokeStyle = 'rgba(255,214,140,0.55)';
  }
  ctx.lineWidth = Math.max(2, (2.6 * FOCAL) / p.f);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, R, R * 0.94, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (isActive || !isDone) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(1, (0.7 * FOCAL) / p.f);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, R, R * 0.94, 0, Math.PI * 1.15, Math.PI * 1.55);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDropZone(ctx, plane, zone, index, sortie) {
  const p = project(plane, zone.x, zone.z, 0);
  if (!p || p.f > 7000) return;
  const R = (95 * FOCAL) / p.f;
  const isActive = sortie.stage === 'drops' && sortie.dropIndex === index;
  const isDone = (sortie.stage !== 'drops' && sortie.stage !== 'rings') || index < sortie.dropIndex;
  ctx.save();
  ctx.strokeStyle = isDone ? 'rgba(110,220,130,0.55)' : isActive ? 'rgba(255,140,60,0.95)' : 'rgba(255,140,60,0.45)';
  ctx.lineWidth = Math.max(2, (2.2 * FOCAL) / p.f);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, R, R * 0.3, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (isActive) {
    const top = project(plane, zone.x, zone.z, 120);
    if (top) {
      const grad = ctx.createLinearGradient(0, top.y, 0, p.y);
      grad.addColorStop(0, 'rgba(255,140,60,0)');
      grad.addColorStop(1, 'rgba(255,140,60,0.28)');
      ctx.fillStyle = grad;
      ctx.fillRect(p.x - 2.5, top.y, 5, p.y - top.y);
    }
  }
  // The crates already waiting on the field, and the marker cross.
  ctx.fillStyle = '#8a6844';
  const cs = Math.max(2, (7 * FOCAL) / p.f);
  ctx.fillRect(p.x - cs / 2, p.y - cs, cs, cs);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(p.x - R * 0.16, p.y - 1, R * 0.32, 2);
  ctx.restore();
}

function drawFallingCrates(ctx, plane, sortie) {
  for (const crate of sortie.fallingCrates) {
    const y = Math.max(0, crate.alt - crate.fall);
    const p = project(plane, crate.x, crate.z, y);
    if (!p) continue;
    // The assembly is drawn big and contrasty on purpose: a supply drop is the second
    // leg's whole point, and a crate under its canopy must read at a glance, in the game
    // as much as in a screenshot — filled gores, rigging lines, a strapped wooden box.
    const s = Math.max(4, (8.5 * FOCAL) / p.f);
    const cr = s * 1.04; // the canopy's radius
    const rimY = p.y - s * 1.72; // where the canopy's rim sits above the crate
    ctx.save();
    // Rigging lines from the rim down to the crate's top corners.
    ctx.strokeStyle = 'rgba(40,32,22,0.75)';
    ctx.lineWidth = Math.max(1, s * 0.045);
    ctx.beginPath();
    for (const fx of [-0.92, -0.34, 0.34, 0.92]) {
      ctx.moveTo(p.x + fx * cr, rimY + s * 0.05);
      ctx.lineTo(p.x + fx * s * 0.5, p.y - s * 0.42);
    }
    ctx.stroke();
    // The canopy: an orange dome with a white centre gore and a darker rim stroke.
    ctx.beginPath();
    ctx.ellipse(p.x, rimY, cr, cr * 0.6, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = '#ff9040';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(p.x - cr * 0.36, rimY);
    ctx.quadraticCurveTo(p.x - cr * 0.3, rimY - cr * 0.62, p.x, rimY - cr * 0.6);
    ctx.quadraticCurveTo(p.x + cr * 0.3, rimY - cr * 0.62, p.x + cr * 0.36, rimY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(250,246,238,0.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(146,66,16,0.85)';
    ctx.lineWidth = Math.max(1.2, s * 0.06);
    ctx.beginPath();
    ctx.ellipse(p.x, rimY, cr, cr * 0.6, 0, Math.PI, 0);
    ctx.stroke();
    // The crate: a wooden box with a lit top face, dark straps and a stencilled square.
    const top = p.y - s * 0.46;
    ctx.fillStyle = '#8a5a28';
    ctx.fillRect(p.x - s / 2, top, s, s * 0.92);
    ctx.fillStyle = '#c49a58';
    ctx.beginPath();
    ctx.moveTo(p.x - s / 2, top);
    ctx.lineTo(p.x - s * 0.32, top - s * 0.2);
    ctx.lineTo(p.x + s * 0.68, top - s * 0.2);
    ctx.lineTo(p.x + s / 2, top);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(56,36,14,0.85)';
    ctx.fillRect(p.x - s * 0.3, top, s * 0.13, s * 0.92);
    ctx.fillRect(p.x + s * 0.17, top, s * 0.13, s * 0.92);
    ctx.fillRect(p.x - s / 2, top + s * 0.4, s, s * 0.13);
    ctx.strokeStyle = 'rgba(250,246,238,0.9)';
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.strokeRect(p.x - s * 0.11, top + s * 0.58, s * 0.22, s * 0.22);
    ctx.restore();
  }
}

function drawShadow(ctx, plane) {
  const p = project(plane, plane.x, plane.z, 0);
  if (!p || p.y > H + 40) return;
  const fade = clamp(46 / (plane.alt + 22), 0, 1);
  if (fade <= 0.02) return;
  const w = 120 * clamp(26 / (plane.alt + 20), 0.3, 1);
  ctx.save();
  ctx.fillStyle = `rgba(20,30,20,${0.34 * fade})`;
  ctx.beginPath();
  ctx.ellipse(p.x, Math.min(p.y, H - 4), w, w * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Smoke puffs for a damaged aeroplane, kept between frames in module state.
const smoke = [];
function drawSmoke(ctx, plane, dt) {
  if (plane.damage > 35 && !plane.onGround && Math.random() < 0.5) {
    smoke.push({ x: CX + (Math.random() - 0.5) * 16, y: H * 0.585, r: 5, life: 1 });
  }
  ctx.save();
  for (let i = smoke.length - 1; i >= 0; i -= 1) {
    const puff = smoke[i];
    puff.life -= dt * 0.7;
    puff.r += dt * 26;
    puff.x -= dt * 30;
    puff.y -= dt * 12;
    if (puff.life <= 0) {
      smoke.splice(i, 1);
      continue;
    }
    ctx.fillStyle = `rgba(60,58,55,${0.3 * puff.life})`;
    ctx.beginPath();
    ctx.arc(puff.x, puff.y, puff.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * The aeroplane, from behind and above, drawn like a built thing rather than a cut-out:
 * a fuselage shaded round its section (bright spine, dark flanks, shaded tail cone), an
 * engine cowling with cooling slots and an exhaust, a three-blade propeller turning on
 * its phase over a faint disc, a framed canopy with the sun caught on it, fixed gear,
 * and the courier's livery carried on the fin and the cream wingtips.
 */
function drawPlane(ctx, plane) {
  const cx = CX;
  const cy = H * 0.585 + Math.sin(plane.time * 2.1) * (plane.onGround ? 0 : 1.6) - plane.pitch * 26;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.roll * 0.88);
  const s = 1; // the sprite's own scale: it is the camera's subject, always the same size

  // Fixed undercarriage first, so the fuselage overlaps the strut tops: two legs angling
  // down and out to the main wheels, and a small tailwheel under the tail cone.
  ctx.strokeStyle = '#7c2d18';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(-10 * s, 14 * s);
  ctx.lineTo(-21 * s, 44 * s);
  ctx.moveTo(10 * s, 14 * s);
  ctx.lineTo(21 * s, 44 * s);
  ctx.stroke();
  for (const wx of [-22, 22]) {
    ctx.fillStyle = '#26221e';
    ctx.beginPath();
    ctx.ellipse(wx * s, 49 * s, 6.4 * s, 8.6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9a948a';
    ctx.beginPath();
    ctx.arc(wx * s, 49 * s, 2.4 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#26221e';
  ctx.beginPath();
  ctx.arc(0, 48 * s, 3.4 * s, 0, Math.PI * 2);
  ctx.fill();

  // Tailplane in two halves — port lit, starboard shaded — with its elevator line.
  ctx.fillStyle = '#d84f30';
  ctx.beginPath();
  ctx.moveTo(-52 * s, 30 * s);
  ctx.lineTo(0, 27 * s);
  ctx.lineTo(0, 40 * s);
  ctx.lineTo(-38 * s, 42 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#a8361f';
  ctx.beginPath();
  ctx.moveTo(0, 27 * s);
  ctx.lineTo(52 * s, 30 * s);
  ctx.lineTo(38 * s, 42 * s);
  ctx.lineTo(0, 40 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,20,8,0.4)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-46 * s, 36 * s);
  ctx.lineTo(46 * s, 36 * s);
  ctx.stroke();

  // The fin carries the livery: a cream tip and the courier's orange band.
  ctx.fillStyle = '#b23a22';
  ctx.beginPath();
  ctx.moveTo(-5 * s, 34 * s);
  ctx.lineTo(5 * s, 34 * s);
  ctx.lineTo(3 * s, 8 * s);
  ctx.lineTo(-3 * s, 8 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffb454';
  ctx.fillRect(-3.8 * s, 20 * s, 7.6 * s, 4.6 * s);
  ctx.fillStyle = '#f3ead8';
  ctx.fillRect(-3.1 * s, 8.4 * s, 6.2 * s, 4 * s);

  // The main wing in two halves, port lit and starboard shaded, with cream tip bands,
  // a flap line on each side and the darker trailing edge a built wing shows from behind.
  const wingL = ctx.createLinearGradient(-104, 0, 0, 0);
  wingL.addColorStop(0, '#e2573a');
  wingL.addColorStop(1, '#ef6a4c');
  ctx.fillStyle = wingL;
  ctx.beginPath();
  ctx.moveTo(-104 * s, 8 * s);
  ctx.lineTo(-16 * s, -4 * s);
  ctx.lineTo(0, -4 * s);
  ctx.lineTo(0, 20 * s);
  ctx.lineTo(-92 * s, 20 * s);
  ctx.closePath();
  ctx.fill();
  const wingR = ctx.createLinearGradient(0, 0, 104, 0);
  wingR.addColorStop(0, '#c2401f');
  wingR.addColorStop(1, '#a8361f');
  ctx.fillStyle = wingR;
  ctx.beginPath();
  ctx.moveTo(0, -4 * s);
  ctx.lineTo(16 * s, -4 * s);
  ctx.lineTo(104 * s, 8 * s);
  ctx.lineTo(92 * s, 20 * s);
  ctx.lineTo(0, 20 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(243,234,216,0.92)';
  ctx.beginPath();
  ctx.moveTo(-104 * s, 8 * s);
  ctx.lineTo(-88 * s, 5.6 * s);
  ctx.lineTo(-85 * s, 19 * s);
  ctx.lineTo(-92 * s, 20 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(104 * s, 8 * s);
  ctx.lineTo(88 * s, 5.6 * s);
  ctx.lineTo(85 * s, 19 * s);
  ctx.lineTo(92 * s, 20 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(90,20,8,0.20)';
  ctx.fillRect(-92 * s, 15.5 * s, 184 * s, 4.5 * s);
  ctx.strokeStyle = 'rgba(90,20,8,0.45)';
  ctx.lineWidth = 1.3;
  for (const fx of [-58, 58]) {
    ctx.beginPath();
    ctx.moveTo(fx * s, 2.5 * s);
    ctx.lineTo(fx * s, 18 * s);
    ctx.stroke();
  }

  // Fuselage: a tapered body running away from the camera, shaded round its section —
  // bright along the spine, dark at the flanks — so it reads as a tube, not a cut-out.
  const bodyGrad = ctx.createLinearGradient(-16, 0, 16, 0);
  bodyGrad.addColorStop(0, '#9c3018');
  bodyGrad.addColorStop(0.3, '#d84f30');
  bodyGrad.addColorStop(0.5, '#f2765a');
  bodyGrad.addColorStop(0.72, '#cf4527');
  bodyGrad.addColorStop(1, '#8f2a14');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(0, -66 * s);
  ctx.bezierCurveTo(13 * s, -60 * s, 16 * s, -30 * s, 15 * s, 2 * s);
  ctx.bezierCurveTo(14 * s, 26 * s, 10 * s, 40 * s, 0, 44 * s);
  ctx.bezierCurveTo(-10 * s, 40 * s, -14 * s, 26 * s, -15 * s, 2 * s);
  ctx.bezierCurveTo(-16 * s, -30 * s, -13 * s, -60 * s, 0, -66 * s);
  ctx.fill();
  // The shaded underside of the tail cone.
  ctx.fillStyle = 'rgba(70,15,5,0.22)';
  ctx.beginPath();
  ctx.moveTo(-13.5 * s, 16 * s);
  ctx.bezierCurveTo(-12 * s, 32 * s, -8 * s, 41 * s, 0, 44 * s);
  ctx.bezierCurveTo(8 * s, 41 * s, 12 * s, 32 * s, 13.5 * s, 16 * s);
  ctx.bezierCurveTo(6 * s, 22 * s, -6 * s, 22 * s, -13.5 * s, 16 * s);
  ctx.closePath();
  ctx.fill();
  // The engine cowling: a darker metal band at the nose, cooling slots and an exhaust.
  ctx.fillStyle = 'rgba(52,34,28,0.5)';
  ctx.beginPath();
  ctx.moveTo(-12.2 * s, -61 * s);
  ctx.lineTo(12.2 * s, -61 * s);
  ctx.bezierCurveTo(14.6 * s, -55 * s, 15 * s, -51 * s, 15.1 * s, -47 * s);
  ctx.lineTo(-15.1 * s, -47 * s);
  ctx.bezierCurveTo(-15 * s, -51 * s, -14.6 * s, -55 * s, -12.2 * s, -61 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(18,10,6,0.65)';
  ctx.lineWidth = 2;
  for (const sx of [-7, 0, 7]) {
    ctx.beginPath();
    ctx.moveTo(sx * s, -58.5 * s);
    ctx.lineTo(sx * s, -50.5 * s);
    ctx.stroke();
  }
  ctx.fillStyle = '#3a2a20';
  ctx.save();
  ctx.translate(12.5 * s, -45 * s);
  ctx.rotate(0.6);
  ctx.fillRect(-1.6 * s, 0, 3.2 * s, 9 * s);
  ctx.restore();
  // Panel lines across the body, and the highlight running down the spine.
  ctx.strokeStyle = 'rgba(90,20,8,0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-14.8 * s, -18 * s);
  ctx.bezierCurveTo(-6 * s, -14 * s, 6 * s, -14 * s, 14.8 * s, -18 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-15 * s, 4 * s);
  ctx.bezierCurveTo(-6 * s, 8 * s, 6 * s, 8 * s, 15 * s, 4 * s);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,205,175,0.30)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -20 * s);
  ctx.lineTo(0, 30 * s);
  ctx.stroke();
  // Aerial mast behind the canopy, and a pitot tube under the port wing.
  ctx.fillStyle = '#4a3a2c';
  ctx.fillRect(-0.9 * s, -19 * s, 1.8 * s, 4.5 * s);
  ctx.strokeStyle = 'rgba(24,18,12,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-70 * s, 15 * s);
  ctx.lineTo(-70 * s, 23 * s);
  ctx.stroke();

  // The canopy: glass with a sky reflection, a frame and a centre post, and the sun
  // caught on its shoulder.
  const glass = ctx.createLinearGradient(0, -52, 0, -24);
  glass.addColorStop(0, '#dceef9');
  glass.addColorStop(0.45, '#6fa8c9');
  glass.addColorStop(1, '#2c4f66');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.ellipse(0, -38 * s, 9.5 * s, 15 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.ellipse(-3.4 * s, -45 * s, 2.8 * s, 6.2 * s, -0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.ellipse(3.4 * s, -31 * s, 1.7 * s, 4.2 * s, -0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(32,24,16,0.8)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(0, -38 * s, 9.5 * s, 15 * s, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(32,24,16,0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, -52.5 * s);
  ctx.lineTo(0, -23.5 * s);
  ctx.stroke();

  // The propeller: three tapered blades turning on the phase over a faint disc, with a
  // shaded spinner at the hub.
  ctx.save();
  ctx.translate(0, -68 * s);
  ctx.fillStyle = 'rgba(232,232,226,0.13)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 31 * s, 7.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(240,240,235,0.20)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 31 * s, 7.6 * s, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (let k = 0; k < 3; k += 1) {
    const a = plane.propPhase + (k * Math.PI * 2) / 3;
    const dx = Math.cos(a);
    const dy = Math.sin(a) * 0.245; // the disc's squash, so the blades stay on the ellipse
    const px = -Math.sin(a);
    const py = Math.cos(a) * 0.245;
    ctx.fillStyle = 'rgba(38,32,28,0.55)';
    ctx.beginPath();
    ctx.moveTo(px * 2.6 * s, py * 2.6 * s);
    ctx.lineTo(dx * 29 * s - px * 1.1 * s, dy * 29 * s - py * 1.1 * s);
    ctx.lineTo(dx * 29 * s + px * 1.1 * s, dy * 29 * s + py * 1.1 * s);
    ctx.lineTo(-px * 2.6 * s, -py * 2.6 * s);
    ctx.closePath();
    ctx.fill();
  }
  const spinner = ctx.createLinearGradient(-5, -4, 5, 4);
  spinner.addColorStop(0, '#8d8578');
  spinner.addColorStop(1, '#4c463c');
  ctx.fillStyle = spinner;
  ctx.beginPath();
  ctx.ellipse(0, 0, 5 * s, 4.2 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Wingtip lights: port red, starboard green, and a tail strobe that blinks.
  ctx.fillStyle = '#ff4b3a';
  ctx.beginPath();
  ctx.arc(-102 * s, 12 * s, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3aff7a';
  ctx.beginPath();
  ctx.arc(102 * s, 12 * s, 3.4, 0, Math.PI * 2);
  ctx.fill();
  if (Math.floor(plane.time * 1.4) % 2 === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(0, 43 * s, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draw the whole world view for one frame: sky, clouds, ground, markings, the mission's
 * furniture, the shadow, the aeroplane and its smoke. The cockpit layer is instruments.js.
 */
export function drawWorld(ctx, plane, sortie, dt) {
  ctx.save();
  ctx.translate(CX, horizonFor(plane));
  ctx.rotate(-plane.roll * 0.42);
  ctx.translate(-CX, -horizonFor(plane));
  drawSky(ctx, plane);
  drawClouds(ctx, plane);
  drawGround(ctx, plane);
  drawRunwayMarkings(ctx, plane);
  drawRunwayLights(ctx, plane);
  drawShadow(ctx, plane);

  // Projected furniture, far to near, so nearer things stand in front as they should.
  const drawables = [];
  for (const obj of WORLD_OBJECTS) {
    const p = project(plane, obj.x, obj.z, 0);
    if (p && p.f > 8 && p.f < 6200) drawables.push({ p, obj });
  }
  drawables.sort((a, b) => b.p.f - a.p.f);
  for (const { p, obj } of drawables) {
    const sizePx = (obj.size * FOCAL) / p.f;
    if (sizePx < 2.2) continue;
    if (obj.kind === 'tree') drawTree(ctx, p, sizePx * 1.9, obj.tone);
    else drawHouse(ctx, p, sizePx * 1.5, obj.tone);
  }
  RINGS.forEach((ring, i) => drawRing(ctx, plane, ring, i, sortie));
  DROP_ZONES.forEach((zone, i) => drawDropZone(ctx, plane, zone, i, sortie));
  drawFallingCrates(ctx, plane, sortie);
  ctx.restore();

  drawPlane(ctx, plane);
  drawSmoke(ctx, plane, dt);
}
