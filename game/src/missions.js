// missions.js — the sortie: three legs flown as one story. Carry the mail north through a
// course of rings, drop supply crates on three marked fields, then bring the aeroplane home
// and land it on the runway it left. Design intent: each leg asks for a different kind of
// flying — precision at height, nerve down low, judgement on the way back down — and fuel
// and damage carry through all three, so every leg is flown with the next one in mind.

import {
  CRATES_CARRIED, DROP_MAX_ALT, DROP_RADIUS, DROP_ZONES, RING_RADIUS, RINGS, SCORE,
} from './config.js';
import { crashCause } from './flight-model.js';
import { headingDelta } from './random.js';

export const STAGE_RINGS = 'rings';
export const STAGE_DROPS = 'drops';
export const STAGE_RETURN = 'return';
export const STAGE_DONE = 'done';

/** A fresh sortie: full crates, no score, the first ring waiting. */
export function createSortie() {
  return {
    stage: STAGE_RINGS,
    ringIndex: 0,
    ringsFlown: 0,
    dropIndex: 0,
    dropsMade: 0,
    cratesLeft: CRATES_CARRIED,
    fallingCrates: [], // { x, z, alt, zoneIndex } — crates on their way down
    score: 0,
    message: '',
    messageUntil: 0,
    finished: false,
    crashed: false,
    cause: '',
    landingGrade: '',
    elapsed: 0,
  };
}

function say(sortie, text, now, seconds = 3.2) {
  sortie.message = text;
  sortie.messageUntil = now + seconds;
}

/** The thing the pilot should be flying toward now, or null when the sortie is over. */
export function currentTarget(sortie) {
  if (sortie.stage === STAGE_RINGS) {
    const ring = RINGS[sortie.ringIndex];
    return { kind: 'ring', x: ring.x, z: ring.z, alt: ring.alt, label: `Ring ${sortie.ringIndex + 1} of ${RINGS.length}` };
  }
  if (sortie.stage === STAGE_DROPS) {
    const zone = DROP_ZONES[sortie.dropIndex];
    return { kind: 'drop', x: zone.x, z: zone.z, alt: 40, label: `Drop zone ${sortie.dropIndex + 1} of ${DROP_ZONES.length}` };
  }
  if (sortie.stage === STAGE_RETURN) {
    return { kind: 'runway', x: 0, z: -1500, alt: 0, label: 'Home runway — land on it' };
  }
  return null;
}

/** A headline for the current leg, for the mission line of the HUD. */
export function stageTitle(sortie) {
  if (sortie.stage === STAGE_RINGS) return 'LEG 1 · THE RING RUN';
  if (sortie.stage === STAGE_DROPS) return 'LEG 2 · SUPPLY DROPS';
  if (sortie.stage === STAGE_RETURN) return 'LEG 3 · BRING HER HOME';
  return 'SORTIE COMPLETE';
}

/** A one-line brief for the current leg, shown under the mission title. */
export function stageBrief(sortie) {
  if (sortie.stage === STAGE_RINGS) return 'Fly each ring in order. Bank to turn, mind your speed.';
  if (sortie.stage === STAGE_DROPS) return `Below ${DROP_MAX_ALT} m over a marked field, press SPACE to drop.`;
  if (sortie.stage === STAGE_RETURN) return 'Land on the runway: gentle sink, wings level, slow.';
  return '';
}

/**
 * Release a crate, if the pilot pressed the button and one remains. The crate falls at the
 * aeroplane's ground position and is judged when it lands, in updateSortie.
 */
export function releaseCrate(sortie, plane) {
  if (sortie.stage !== STAGE_DROPS || sortie.cratesLeft <= 0 || plane.onGround) return false;
  sortie.cratesLeft -= 1;
  sortie.fallingCrates.push({ x: plane.x, z: plane.z, alt: plane.alt, fall: 0 });
  return true;
}

function judgeCrate(sortie, crate, now) {
  const zone = DROP_ZONES[sortie.dropIndex];
  const dist = Math.hypot(crate.x - zone.x, crate.z - zone.z);
  if (sortie.stage === STAGE_DROPS && dist <= DROP_RADIUS) {
    sortie.dropsMade += 1;
    sortie.score += SCORE.drop;
    say(sortie, `SUPPLY AWAY — drop ${sortie.dropsMade} of ${DROP_ZONES.length} delivered!`, now);
    sortie.dropIndex += 1;
    if (sortie.dropIndex >= DROP_ZONES.length) {
      sortie.stage = STAGE_RETURN;
      say(sortie, 'All supplies delivered. Bring her home and land.', now, 4.5);
    }
  } else {
    say(sortie, dist <= DROP_RADIUS * 2.4 ? 'Crate down — just wide of the marked field.' : 'Crate down in the wild. The farmers will find it by spring.', now);
  }
}

/** Grade a touchdown on the runway; returns a grade word or null when it was a wreck. */
function gradeLanding(td) {
  const alignment = Math.abs(headingDelta(td.heading, 0)) < 0.35 || Math.abs(headingDelta(td.heading, Math.PI)) < 0.35;
  if (!alignment) return null;
  if (td.vspeed < -8 || Math.abs(td.roll) > 0.32 || td.speed > 56) return null;
  if (td.vspeed >= -2.6 && td.speed <= 41 && Math.abs(td.x) <= 11) return 'PERFECT';
  if (td.vspeed >= -4.2 && td.speed <= 47) return 'SMOOTH';
  if (td.vspeed >= -5.8 && td.speed <= 52) return 'FIRM';
  return null;
}

/**
 * Advance the sortie one step: watch for ring crossings and falling crates, and take the
 * flight model's events (takeoff, touchdown) as they come. `actions` is { drop: boolean }.
 */
export function updateSortie(sortie, plane, events, actions, dt) {
  if (sortie.finished) return;
  sortie.elapsed += dt;
  const now = plane.time;

  if (actions.drop && releaseCrate(sortie, plane)) {
    // a soft clunk is the audio module's business; here we only count the crate
  }

  // Crates fall at a parachute's pace and are judged where they land.
  for (let i = sortie.fallingCrates.length - 1; i >= 0; i -= 1) {
    const crate = sortie.fallingCrates[i];
    crate.fall += dt * 9;
    if (crate.fall >= crate.alt) {
      sortie.fallingCrates.splice(i, 1);
      judgeCrate(sortie, crate, now);
    }
  }

  // Rings are crossed, not touched: watch the plane pass the ring's plane of sky.
  if (sortie.stage === STAGE_RINGS && !plane.onGround) {
    const ring = RINGS[sortie.ringIndex];
    const dz = plane.z - ring.z;
    if (sortie.prevDz !== undefined && Math.sign(dz) !== Math.sign(sortie.prevDz) && Math.abs(dz) < 60) {
      const dx = plane.x - ring.x;
      const dy = plane.alt - ring.alt;
      if (Math.hypot(dx, dy) <= RING_RADIUS * 0.98) {
        sortie.ringsFlown += 1;
        sortie.score += SCORE.ring;
        say(sortie, `THROUGH — ring ${sortie.ringsFlown} of ${RINGS.length}!`, now);
        sortie.ringIndex += 1;
        if (sortie.ringIndex >= RINGS.length) {
          sortie.stage = STAGE_DROPS;
          say(sortie, 'Ring run complete! Now the supply drops — get low, get slow.', now, 4.5);
        }
      } else if (Math.abs(dz) < 12) {
        say(sortie, 'Missed the ring — circle back and line it up again.', now);
      }
    }
    sortie.prevDz = dz;
  }

  // A touchdown ends the story one way or the other.
  if (events.touchdown && plane.airborne) {
    const td = events.touchdown;
    if (td.onRunway && sortie.stage === STAGE_RETURN) {
      const grade = gradeLanding(td);
      if (grade) {
        sortie.landingGrade = grade;
        sortie.score += grade === 'PERFECT' ? SCORE.landingPerfect : grade === 'SMOOTH' ? SCORE.landingSmooth : SCORE.landingFirm;
        sortie.stage = STAGE_DONE;
        sortie.finished = true;
      } else {
        sortie.crashed = true;
        sortie.finished = true;
        sortie.cause = crashCause(td, plane);
      }
    } else if (td.onRunway && plane.speed <= 52 && td.vspeed >= -5.8 && Math.abs(td.roll) <= 0.32) {
      // A touch-and-go or a precautionary landing mid-sortie: allowed, but the leg stands.
      say(sortie, 'Wheels down on the runway. Take off again when ready — the sortie goes on.', now, 4);
    } else {
      sortie.crashed = true;
      sortie.finished = true;
      sortie.cause = crashCause(td, plane);
      if (td.onRunway && sortie.stage !== STAGE_RETURN) {
        sortie.cause = 'Came back to earth on the runway before the sortie was done — and too hard to fly away from.';
      }
    }
    if (sortie.finished) {
      // Settle the accounts: a safe arrival earns its fuel and time back; damage always costs.
      if (!sortie.crashed) {
        sortie.score += Math.round(plane.fuel) * SCORE.fuelPoint;
        const under = Math.max(0, SCORE.parSeconds - sortie.elapsed);
        sortie.score += Math.min(SCORE.parBonusCap, Math.round(under));
      }
      sortie.score = Math.max(0, sortie.score - Math.round(plane.damage) * SCORE.damagePoint);
      if (sortie.crashed) sortie.score = Math.round(sortie.score * 0.4);
    }
  }

  // Running out of sky in other ways.
  if (!sortie.finished && plane.damage >= 100) {
    sortie.crashed = true;
    sortie.finished = true;
    sortie.cause = crashCause(null, plane);
  }
  if (!sortie.finished && plane.fuel <= 0 && plane.onGround && plane.speed <= 0.5) {
    sortie.crashed = true;
    sortie.finished = true;
    sortie.cause = 'Out of fuel on the ground. The mail walks from here.';
  }
  sortie.messageVisible = now < sortie.messageUntil;
  return sortie;
}

/** The pilot's rank for a finished sortie, from the score alone. */
export function rankTitle(sortie) {
  if (sortie.crashed) return 'GROUNDED — PENDING PAPERWORK';
  if (sortie.score >= 2100) return 'ACE COURIER';
  if (sortie.score >= 1700) return 'FIRST-CLASS COURIER';
  if (sortie.score >= 1300) return 'COURIER, SECOND CLASS';
  return 'COURIER, THIRD CLASS';
}
