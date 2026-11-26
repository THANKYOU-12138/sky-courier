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
    const s = Math.max(3, (6 * FOCAL) / p.f);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(p.x, p.y - s * 1.5, s * 0.85, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.85, p.y - s * 1.5);
    ctx.lineTo(p.x, p.y - s * 0.3);
    ctx.lineTo(p.x + s * 0.85, p.y - s * 1.5);
    ctx.stroke();
    ctx.fillStyle = '#9c7748';
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
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

/** The aeroplane, from behind and above: built shapes, lit tips, a blurred prop at the nose. */
function drawPlane(ctx, plane) {
  const cx = CX;
  const cy = H * 0.585 + Math.sin(plane.time * 2.1) * (plane.onGround ? 0 : 1.6) - plane.pitch * 26;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.roll * 0.88);
  const s = 1; // the sprite's own scale: it is the camera's subject, always the same size
  // Tailplane and fin (nearest the camera).
  ctx.fillStyle = '#c8452c';
  ctx.beginPath();
  ctx.moveTo(-52 * s, 30 * s);
  ctx.lineTo(52 * s, 30 * s);
  ctx.lineTo(38 * s, 42 * s);
  ctx.lineTo(-38 * s, 42 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#a8361f';
  ctx.beginPath();
  ctx.moveTo(-5 * s, 34 * s);
  ctx.lineTo(5 * s, 34 * s);
  ctx.lineTo(3 * s, 8 * s);
  ctx.lineTo(-3 * s, 8 * s);
  ctx.closePath();
  ctx.fill();
  // Main wing.
  const wingGrad = ctx.createLinearGradient(0, -6, 0, 26);
  wingGrad.addColorStop(0, '#e2573a');
  wingGrad.addColorStop(1, '#b23a22');
  ctx.fillStyle = wingGrad;
  ctx.beginPath();
  ctx.moveTo(-104 * s, 8 * s);
  ctx.lineTo(-16 * s, -4 * s);
  ctx.lineTo(16 * s, -4 * s);
  ctx.lineTo(104 * s, 8 * s);
  ctx.lineTo(92 * s, 20 * s);
  ctx.lineTo(-92 * s, 20 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,20,8,0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-88 * s, 10 * s);
  ctx.lineTo(88 * s, 10 * s);
  ctx.stroke();
  // Fuselage: a tapered body running away from the camera, lit from above.
  const bodyGrad = ctx.createLinearGradient(0, -64, 0, 44);
  bodyGrad.addColorStop(0, '#f0664a');
  bodyGrad.addColorStop(0.5, '#d84f30');
  bodyGrad.addColorStop(1, '#a8361f');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(0, -66 * s);
  ctx.bezierCurveTo(13 * s, -60 * s, 16 * s, -30 * s, 15 * s, 2 * s);
  ctx.bezierCurveTo(14 * s, 26 * s, 10 * s, 40 * s, 0, 44 * s);
  ctx.bezierCurveTo(-10 * s, 40 * s, -14 * s, 26 * s, -15 * s, 2 * s);
  ctx.bezierCurveTo(-16 * s, -30 * s, -13 * s, -60 * s, 0, -66 * s);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,20,8,0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-13 * s, -18 * s);
  ctx.bezierCurveTo(-6 * s, -14 * s, 6 * s, -14 * s, 13 * s, -18 * s);
  ctx.stroke();
  // The canopy: glass with a sky reflection and a frame.
  const glass = ctx.createLinearGradient(0, -52, 0, -24);
  glass.addColorStop(0, '#cfe8f7');
  glass.addColorStop(0.45, '#6fa8c9');
  glass.addColorStop(1, '#33566e');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.ellipse(0, -38 * s, 9.5 * s, 15 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,30,20,0.65)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // The propeller at the nose: a blurred disc and two blade streaks turning with the phase.
  ctx.save();
  ctx.translate(0, -68 * s);
  ctx.fillStyle = 'rgba(230,230,225,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 30 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(Math.sin(plane.propPhase) * 0.9);
  ctx.fillStyle = 'rgba(40,36,32,0.55)';
  ctx.fillRect(-28 * s, -2.2 * s, 56 * s, 4.4 * s);
  ctx.restore();
  ctx.fillStyle = '#5d5648';
  ctx.beginPath();
  ctx.arc(0, -68 * s, 4.4 * s, 0, Math.PI * 2);
  ctx.fill();
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
