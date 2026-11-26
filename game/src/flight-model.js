// flight-model.js — the aeroplane itself: one state object and the step that flies it.
// Design intent: an arcade model with real discipline. The throttle sets how much power is
// available, the stick sets pitch and bank, and speed is earned or spent — climb bleeds it,
// dive gains it, and below the stall the wing gives up and the nose drops whether the pilot
// likes it or not. Turns come from bank, not from a yaw key, so flying well means managing
// energy: that is the game inside the game. Touchdown is reported, never judged here; the
// missions module decides whether a arrival was a landing or an accident. The valley's
// wind is in the model too: it moves the ground track, never the airspeed, so the wing
// feels nothing and the course feels everything.

import { FLIGHT, RUNWAY, WIND } from './config.js';
import { clamp } from './random.js';

/**
 * The wind as a ground-drift vector in metres a second: the direction it blows TOWARD,
 * as { x, z } in world axes. Every readout (tape marker, windsock, nav chart) draws
 * from this one vector, so the instruments can never disagree with the physics.
 */
export function windVector() {
  const toward = ((WIND.fromDeg + 180) * Math.PI) / 180;
  return { x: Math.sin(toward) * WIND.speed, z: -Math.cos(toward) * WIND.speed };
}

/** A fresh aeroplane, parked at the south end of the home runway, engine idling. */
export function createPlane() {
  return {
    x: RUNWAY.x,
    z: RUNWAY.zSouth + 40, // just inside the south threshold, facing north
    alt: 0,
    heading: 0, // north
    pitch: 0,
    roll: 0,
    speed: 0,
    vspeed: 0,
    throttle: 0,
    fuel: 100,
    damage: 0,
    onGround: true,
    airborne: false, // has left the ground at least once this sortie
    stalled: false,
    overspeeding: false,
    propPhase: 0,
    time: 0,
  };
}

/** True while the aeroplane is over the runway strip, for touchdown judgement. */
export function overRunway(state) {
  return (
    Math.abs(state.x - RUNWAY.x) <= RUNWAY.width / 2 &&
    state.z >= RUNWAY.zNorth &&
    state.z <= RUNWAY.zSouth
  );
}

/**
 * Fly the aeroplane one step. `control` is { pitch, roll, throttleDir } in [-1, 1].
 * Returns an events object: { tookOff, touchdown } where touchdown, when the wheels meet the
 * ground after a flight, carries everything the landing judge needs.
 */
export function stepPlane(state, control, dt) {
  const events = { tookOff: false, touchdown: null };
  state.time += dt;
  state.propPhase += dt * (4 + state.throttle * 46 + state.speed * 0.12);

  // The lever moves at a human pace; the engine answers at once.
  state.throttle = clamp(state.throttle + control.throttleDir * dt * 0.55, 0, 1);
  state.fuel = Math.max(0, state.fuel - (FLIGHT.fuelBurnIdle + FLIGHT.fuelBurnFull * state.throttle) * dt);
  const flameout = state.fuel <= 0;

  // How much the controls can do depends on the air over the wing.
  const authority = state.onGround ? 1 : clamp(state.speed / 34, 0.22, 1);

  // Pitch: the stick asks, the stall overrides.
  const wasStalled = state.stalled;
  state.stalled = !state.onGround && state.speed < FLIGHT.stallSpeed;
  if (state.stalled) {
    state.pitch -= (state.pitch + 0.34) * Math.min(1, dt * 1.7); // the nose falls away
  } else if (state.onGround) {
    const wantsRotate = control.pitch > 0 && state.speed >= FLIGHT.rotateSpeed;
    const target = wantsRotate ? 0.2 : 0;
    state.pitch += (target - state.pitch) * Math.min(1, dt * 5);
  } else {
    state.pitch = clamp(
      state.pitch + control.pitch * FLIGHT.pitchRate * authority * dt,
      FLIGHT.minPitch,
      FLIGHT.maxPitch,
    );
    state.pitch -= state.pitch * 0.12 * dt; // a gentle return toward level
  }
  if (state.stalled && !wasStalled) events.stallBegan = true;

  // Roll: bank is asked for directly; with no ask, the wings level themselves.
  if (control.roll !== 0) {
    state.roll = clamp(state.roll + control.roll * FLIGHT.rollRate * authority * dt, -FLIGHT.maxRoll, FLIGHT.maxRoll);
  } else {
    state.roll -= state.roll * Math.min(1, dt * 2.1);
  }

  // Heading follows bank, faster when slow and steep, as a real turn does — with an arcade
  // generosity in the rate, because a valley this size is flown in minutes, not hours.
  if (!state.onGround) {
    const turnRate = (FLIGHT.gravity * Math.tan(state.roll)) / Math.max(state.speed, 16);
    state.heading += turnRate * dt * 1.3;
  }

  // Speed: thrust against drag, with gravity taking or giving along the flight path.
  const thrust = flameout ? 0 : state.throttle * FLIGHT.thrust;
  const drag = FLIGHT.dragQuad * state.speed * state.speed + FLIGHT.dragBase;
  const alongSlope = state.onGround ? 0 : -FLIGHT.gravity * Math.sin(state.pitch);
  state.speed = Math.max(0, state.speed + (thrust - drag + alongSlope) * dt);
  if (state.onGround) state.speed = Math.max(0, state.speed - (control.throttleDir < 0 ? 6 * dt : 0));

  // Vertical: the wing lifts what the speed allows; a steep bank spills lift.
  if (state.onGround) {
    state.vspeed = 0;
    if (state.pitch > 0.1 && state.speed >= FLIGHT.rotateSpeed) {
      state.onGround = false;
      state.airborne = true;
      state.alt = 0.4;
      events.tookOff = true;
    }
  } else {
    let vspeed = state.speed * Math.sin(state.pitch) * 0.94;
    if (state.speed < FLIGHT.stallSpeed) vspeed -= (FLIGHT.stallSpeed - state.speed) * 0.5;
    vspeed -= (1 - Math.cos(state.roll)) * 5.2; // banked flight sinks
    state.vspeed = vspeed;
    state.alt += vspeed * dt;
  }

  // Travel over the ground. Airborne, the wind rides along: the aeroplane's track is
  // its heading's motion plus the drift, which is why a crosswind final must be
  // crabbed and a drop must be led. On the ground the wheels hold it straight.
  const groundSpeed = state.speed * Math.cos(state.pitch);
  state.x += Math.sin(state.heading) * groundSpeed * dt;
  state.z += -Math.cos(state.heading) * groundSpeed * dt;
  if (!state.onGround) {
    const wind = windVector();
    state.x += wind.x * dt;
    state.z += wind.z * dt;
  }

  // Overspeed hurts, slowly and then all at once.
  state.overspeeding = state.speed > FLIGHT.overspeed;
  if (state.overspeeding && !state.onGround) state.damage = Math.min(100, state.damage + 5.5 * dt);

  // Meeting the ground.
  if (!state.onGround && state.alt <= 0) {
    state.alt = 0;
    events.touchdown = {
      x: state.x,
      z: state.z,
      vspeed: state.vspeed,
      speed: state.speed,
      roll: state.roll,
      heading: state.heading,
      onRunway: overRunway(state),
    };
    state.onGround = true;
    state.pitch = 0;
    state.vspeed = 0;
  }
  if (state.onGround && state.speed < 0.4 && state.throttle === 0) state.speed = 0;

  return events;
}

/** A plain-words cause for a wreck, from the numbers at the moment it happened. */
export function crashCause(td, state) {
  if (!td) return 'The aeroplane came down before the sortie was done.';
  if (state.damage >= 100) return 'The airframe, already battered, gave up in the air.';
  if (!td.onRunway && td.speed > 60) return `Came down in a field at ${Math.round(td.speed * 1.944)} knots — far too fast to walk away from.`;
  if (!td.onRunway) return 'Put down in a field short of the runway. The courier service sends its regards to the farmer.';
  if (td.vspeed < -8) return `Hit the runway sinking at ${Math.abs(td.vspeed).toFixed(1)} m/s. The gear folded and the prop struck.`;
  if (Math.abs(td.roll) > 0.32) return 'Touched down with a wing low and cartwheeled off the strip.';
  if (td.speed > 56) return `Arrived at ${Math.round(td.speed * 1.944)} knots — too hot to stop on 600 metres of runway.`;
  return 'The landing was beyond what the aeroplane could forgive.';
}
