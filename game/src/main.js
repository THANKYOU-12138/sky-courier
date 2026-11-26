// main.js — Sky Courier itself: the game loop and the three screens (title, the sortie,
// the debrief) wired over the flight model, the missions, the renderer and the instruments.
// Design intent: this file owns no rules of its own. It samples the controls, steps the
// model in fixed steps so the flying is the same on every machine, lets the missions judge
// what the model reports, plays the sounds those judgements call for, and draws the world
// and the cockpit. Everything a player can argue with lives in the module that owns it.

import { STAGE } from './config.js';
import { createAudio } from './audio.js';
import { createPlane, stepPlane } from './flight-model.js';
import { createInput } from './input.js';
import { drawCockpit } from './instruments.js';
import {
  createSortie, currentTarget, rankTitle, stageBrief, stageTitle, updateSortie,
} from './missions.js';
import { headingDelta } from './random.js';
import { drawWorld, project } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const W = STAGE.width;
const H = STAGE.height;

const audio = createAudio();
const input = createInput(window);

let plane = createPlane();
let sortie = createSortie();
let screen = 'title'; // 'title' | 'play' | 'debrief'
let frozen = false;
let titleTime = 0;

function setScreen(next) {
  screen = next;
  input.flush();
}

/** One fixed step of the whole game: model, missions, and the sounds their events earn. */
function step(control, dt, actions) {
  const before = {
    rings: sortie.ringsFlown,
    drops: sortie.dropsMade,
    finished: sortie.finished,
    message: sortie.message,
  };
  const events = stepPlane(plane, control, dt);
  if (events.tookOff) audio.takeoff();
  updateSortie(sortie, plane, events, actions, dt);
  if (sortie.ringsFlown > before.rings) audio.ring();
  if (sortie.dropsMade > before.drops) audio.crateLanded(true);
  if (events.touchdown && !sortie.finished) audio.touchdown(events.touchdown.vspeed < -4);
  if (sortie.finished && !before.finished) {
    if (sortie.crashed) audio.crash();
    else audio.touchdown(sortie.landingGrade === 'FIRM');
    setScreen('debrief');
    status.textContent = sortie.crashed ? `Crashed. ${sortie.cause}` : `Landed ${sortie.landingGrade}. Score ${sortie.score}.`;
  }
}

function resetSortie() {
  plane = createPlane();
  sortie = createSortie();
}

/** The HUD block the instruments draw from: titles, progress and the target marker. */
function buildHud() {
  const target = currentTarget(sortie);
  let marker = null;
  if (target && screen === 'play') {
    const dist = Math.hypot(target.x - plane.x, target.z - plane.z);
    const distText = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`;
    const p = project(plane, target.x, target.z, target.alt);
    if (p && p.x > -30 && p.x < W + 30 && p.y > 0 && p.y < H - 150) {
      marker = { onScreen: true, x: p.x, y: p.y, distText };
    } else {
      const bearing = Math.atan2(target.x - plane.x, -(target.z - plane.z));
      marker = { onScreen: false, edgeAngle: headingDelta(plane.heading, bearing), distText };
    }
  }
  const progress = sortie.stage === 'rings'
    ? `Rings ${sortie.ringsFlown}/6 flown · Score ${sortie.score}`
    : sortie.stage === 'drops'
      ? `Drops ${sortie.dropsMade}/3 made · ${sortie.cratesLeft} crates left`
      : sortie.stage === 'return'
        ? 'The runway is home. Set her down gently.'
        : `Rings ${sortie.ringsFlown}/6 · Drops ${sortie.dropsMade}/3`;
  return { title: stageTitle(sortie), brief: stageBrief(sortie), progress, target: marker };
}

function drawTitle() {
  drawWorld(ctx, plane, sortie, 0);
  ctx.save();
  ctx.fillStyle = 'rgba(8,14,20,0.45)';
  ctx.fillRect(0, 0, W, H);
  const x = 84;
  let y = 148;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd98a';
  ctx.font = '800 76px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 14;
  ctx.fillText('SKY COURIER', x, y);
  ctx.shadowBlur = 0;
  y += 44;
  ctx.fillStyle = '#f3ead8';
  ctx.font = '600 21px system-ui, sans-serif';
  ctx.fillText('Mail, medicine and spare parts — flown the hard way, in one small red aeroplane.', x, y);
  y += 58;
  ctx.font = '600 18px system-ui, sans-serif';
  const legs = [
    'LEG 1 — THE RING RUN: thread six glowing rings over the valley.',
    'LEG 2 — SUPPLY DROPS: get low, get slow, drop crates on three marked fields.',
    'LEG 3 — BRING HER HOME: land on the runway you left. Gently.',
  ];
  for (const line of legs) {
    ctx.fillText(line, x, y);
    y += 30;
  }
  y += 22;
  ctx.fillStyle = 'rgba(243,234,216,0.85)';
  ctx.font = '600 16.5px system-ui, sans-serif';
  const controls = [
    '↑ / ↓ — pitch      ← / → — bank and turn      W / S — throttle',
    'SPACE — drop a crate      M — sound on/off      R — start over',
    'Mind the stall, mind the fuel gauge, and land like the mail matters.',
  ];
  for (const line of controls) {
    ctx.fillText(line, x, y);
    y += 27;
  }
  y += 30;
  ctx.fillStyle = '#ffb454';
  ctx.font = '800 24px system-ui, sans-serif';
  ctx.fillText('Press ENTER or click to take off', x, y);
  ctx.restore();
}

function drawDebrief() {
  drawWorld(ctx, plane, sortie, 0);
  ctx.save();
  ctx.fillStyle = 'rgba(8,14,20,0.55)';
  ctx.fillRect(0, 0, W, H);
  const x = W / 2 - 330;
  const y = 120;
  ctx.fillStyle = 'rgba(13,20,27,0.92)';
  ctx.beginPath();
  ctx.roundRect(x, y, 660, 520, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,180,84,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  let ty = y + 66;
  ctx.textAlign = 'center';
  ctx.fillStyle = sortie.crashed ? '#ff7a5c' : '#ffd98a';
  ctx.font = '800 40px system-ui, sans-serif';
  ctx.fillText(sortie.crashed ? 'SHE CAME DOWN' : 'DELIVERED.', W / 2, ty);
  ty += 34;
  ctx.fillStyle = '#f3ead8';
  ctx.font = '600 16.5px system-ui, sans-serif';
  const verdict = sortie.crashed ? sortie.cause : `Landing graded ${sortie.landingGrade}. The valley post is on its way.`;
  wrapText(ctx, verdict, W / 2, ty, 580, 22);
  ty += 58;
  ctx.font = '600 17px ui-monospace, monospace';
  const rows = [
    ['Rings threaded', `${sortie.ringsFlown} / 6`],
    ['Supplies delivered', `${sortie.dropsMade} / 3`],
    ['Landing', sortie.crashed ? '—' : sortie.landingGrade],
    ['Time', `${Math.floor(sortie.elapsed / 60)}:${String(Math.floor(sortie.elapsed % 60)).padStart(2, '0')}`],
    ['Fuel brought home', `${Math.round(plane.fuel)}%`],
    ['Damage taken', `${Math.round(plane.damage)}%`],
  ];
  for (const [label, value] of rows) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(243,234,216,0.8)';
    ctx.fillText(label, x + 70, ty);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f3ead8';
    ctx.fillText(value, x + 590, ty);
    ty += 31;
  }
  ty += 8;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd98a';
  ctx.font = '800 31px ui-monospace, monospace';
  ctx.fillText(`SCORE ${sortie.score}`, W / 2, ty);
  ty += 34;
  ctx.fillStyle = '#ffb454';
  ctx.font = '700 19px system-ui, sans-serif';
  ctx.fillText(rankTitle(sortie), W / 2, ty);
  ty += 52;
  ctx.fillStyle = 'rgba(243,234,216,0.85)';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText('Press ENTER or click to fly again', W / 2, ty);
  ctx.restore();
}

function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      ctx.fillText(line, cx, yy);
      yy += lineHeight;
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) ctx.fillText(line, cx, yy);
  return yy;
}

let last = performance.now();
let accumulator = 0;
const FIXED = 1 / 60;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (input.consume('KeyM')) audio.toggleMute();

  if (screen === 'title') {
    titleTime += dt;
    plane.time += dt;
    plane.propPhase += dt * 3.2;
    plane.heading = Math.sin(titleTime * 0.11) * 0.05;
    if (input.consume('Enter') || input.consume('MouseConfirm')) {
      audio.start();
      resetSortie();
      setScreen('play');
      status.textContent = 'Take off: hold W to open the throttle, then pull up with the up arrow.';
    }
    drawTitle();
    return;
  }

  if (screen === 'debrief') {
    plane.time += dt;
    if (input.consume('Enter') || input.consume('MouseConfirm') || input.consume('KeyR')) {
      audio.start();
      resetSortie();
      setScreen('play');
    }
    drawDebrief();
    return;
  }

  // The sortie itself.
  if (input.consume('KeyR')) {
    resetSortie();
    return;
  }
  const control = { pitch: input.pitch(), roll: input.roll(), throttleDir: input.throttleDir() };
  const actions = { drop: input.consume('Space') };
  if (!frozen) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED && steps < 4) {
      step(control, FIXED, actions);
      actions.drop = false; // one press, one crate, however many steps the frame holds
      accumulator -= FIXED;
      steps += 1;
      if (screen !== 'play') break;
    }
  }
  audio.update(plane, dt);
  drawWorld(ctx, plane, sortie, dt);
  drawCockpit(ctx, W, H, plane, sortie, buildHud());
}

// Fit the fixed stage into the window without distortion.
function fit() {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = `${Math.floor(W * scale)}px`;
  canvas.style.height = `${Math.floor(H * scale)}px`;
}
window.addEventListener('resize', fit);
fit();

// Screenshot mode: ?shot=<scene>&seed=<n> stages a deterministic frame and freezes the sim.
const params = new URLSearchParams(window.location.search);
if (params.has('shot')) {
  const api = {
    get plane() { return plane; },
    get sortie() { return sortie; },
    step,
    setScreen,
  };
  stageShot(params.get('shot') || 'cover', api);
  frozen = true;
}

requestAnimationFrame(frame);
