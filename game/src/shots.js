// shots.js — the screenshot scenes behind ?shot=cover|rings|drop|landing|end. Each one
// places the aeroplane in a real sortie state and flies it with a small autopilot for a
// fixed number of fixed steps, so the frame is a moment the game itself can reach and the
// same seed always gives the same frame. Design intent: the cover must sell the whole game
// in one glance — chase view, lit instruments, a ring ahead over a recognisable valley —
// and the other scenes each prove one leg of the sortie is really in there.

import { DROP_ZONES, RINGS } from './config.js';
import { STAGE_DROPS, STAGE_RETURN } from './missions.js';
import { clamp, headingDelta } from './random.js';

const STEP = 1 / 30;

/** Steer toward a point at a height: the autopilot every flight scene shares. */
function autopilot(plane, tx, tz, talt, throttle) {
  const bearing = Math.atan2(tx - plane.x, -(tz - plane.z));
  const turn = headingDelta(plane.heading, bearing);
  const desiredRoll = clamp(turn * 1.15, -0.52, 0.52);
  const desiredPitch = clamp((talt - plane.alt) * 0.004, -0.22, 0.3);
  return {
    roll: clamp((desiredRoll - plane.roll) * 3.2, -1, 1),
    pitch: clamp((desiredPitch - plane.pitch) * 3.2, -1, 1),
    throttleDir: 0,
    throttleSet: throttle,
  };
}

function flySteps(game, steps, tx, tz, talt, throttle) {
  for (let i = 0; i < steps; i += 1) {
    const control = autopilot(game.plane, tx, tz, talt, throttle);
    game.plane.throttle = throttle;
    game.step(control, STEP, {});
  }
}

function placeAeroplane(game, values) {
  Object.assign(game.plane, {
    onGround: false,
    airborne: true,
    stalled: false,
    fuel: 88,
    damage: 0,
    ...values,
  });
}

/**
 * Stage the named scene on `game` (which exposes plane, sortie, step and setScreen).
 * Any name not recognised stages the cover.
 */
export function stageShot(name, game) {
  const { plane, sortie } = game;
  if (name === 'end') {
    // A finished sortie: parked on the home runway, the debrief on screen.
    Object.assign(plane, { x: 4, z: -1130, alt: 0, heading: 0.2, speed: 0, throttle: 0, fuel: 34, damage: 6, onGround: true, airborne: true });
    Object.assign(sortie, {
      stage: 'done', finished: true, crashed: false, ringsFlown: 6, dropsMade: 3,
      cratesLeft: 2, landingGrade: 'SMOOTH', elapsed: 342, score: 1875,
    });
    game.setScreen('debrief');
    return;
  }
  game.setScreen('play');
  if (name === 'rings') {
    const ring = RINGS[2];
    placeAeroplane(game, { x: 120, z: -3520, alt: 158, heading: 0.35, roll: -0.3, pitch: 0.02, speed: 57, throttle: 0.74 });
    sortie.ringIndex = 2;
    sortie.ringsFlown = 2;
    sortie.score = 300;
    flySteps(game, 90, ring.x, ring.z, ring.alt, 0.74);
    return;
  }
  if (name === 'drop') {
    const zone = DROP_ZONES[0];
    placeAeroplane(game, { x: 960, z: -5920, alt: 57, heading: 0.15, roll: 0.06, pitch: -0.02, speed: 49, throttle: 0.52 });
    sortie.stage = STAGE_DROPS;
    sortie.ringIndex = 6;
    sortie.ringsFlown = 6;
    sortie.score = 900;
    flySteps(game, 46, zone.x, zone.z, 44, 0.52);
    // A crate released a breath ago, placed off the aeroplane's final position so the
    // whole assembly hangs in open frame: ahead of the nose, below the fuselage and
    // drifted to the right of the flight path, clear of the aeroplane above and the
    // cockpit panel below. (V1 staged it in world coordinates and it ended up a speck
    // behind the marker; a first pass at this staging put it dead ahead and so low
    // that the panel cut the crate in half.)
    const aheadX = Math.sin(plane.heading);
    const aheadZ = -Math.cos(plane.heading);
    sortie.fallingCrates.length = 0;
    sortie.fallingCrates.push({
      x: plane.x + aheadX * 80 + Math.cos(plane.heading) * 36,
      z: plane.z + aheadZ * 80 + Math.sin(plane.heading) * 36,
      alt: Math.max(14, plane.alt - 27),
      fall: 0,
    });
    return;
  }
  if (name === 'landing') {
    placeAeroplane(game, { x: 14, z: -2050, alt: 47, heading: Math.PI, roll: 0.02, pitch: -0.05, speed: 43, throttle: 0.3 });
    sortie.stage = STAGE_RETURN;
    sortie.ringIndex = 6;
    sortie.ringsFlown = 6;
    sortie.dropsMade = 3;
    sortie.dropIndex = 3;
    sortie.score = 1500;
    // Fly a real glide slope all the way in: the target height shrinks with the distance
    // to the threshold, and the frame is taken on short final — the strip big in the
    // frame with its lights lit, the altimeter low, the sink rate showing. (V1 stopped
    // nearly 300 m out and the runway read as a postage stamp.) The aim line sits below
    // the geometric slope because the shared autopilot holds its nose down with a
    // persistent height error: aiming low puts the aeroplane itself on the slope, so
    // the altimeter and the PAPI agree with the picture.
    for (let i = 0; i < 460; i += 1) {
      const distToThreshold = Math.max(0, -1500 - game.plane.z);
      if (distToThreshold <= 118) break;
      const control = autopilot(game.plane, 0, -1500, Math.max(2, distToThreshold * 0.085 - 16), 0.3);
      game.plane.throttle = 0.3;
      game.step(control, STEP, {});
    }
    return;
  }
  // The cover: outbound over the valley, banked onto the first ring at a hundred
  // metres with the river bend under the wing and the town across the valley — the
  // sheet's biggest picture should have motion in it. (V2 flew it wings-level at
  // 127 m: correct, but static.) The aeroplane starts wide of the ring line and the
  // shared autopilot is still turning it onto the gate when the frame is taken, so
  // the bank is real flying, not a pose; the ring stays ahead, the instruments lit.
  const ring = RINGS[0];
  placeAeroplane(game, { x: 330, z: -1980, alt: 104, heading: -0.38, roll: -0.3, pitch: 0.03, speed: 58, throttle: 0.75 });
  flySteps(game, 62, ring.x, ring.z, ring.alt, 0.75);
}
