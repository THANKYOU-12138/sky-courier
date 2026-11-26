// terrain.js — the valley Sky Courier flies over: patchwork fields, a wandering river, one
// straight road, a small town and the home runway, all placed by coordinate hash.
// Design intent: the ground must read at a glance from 200 metres — bold field colours, a
// river that snakes so the pilot can navigate by it, a road that points home — and it must
// be identical on every visit, so nothing here is placed by a random stream: every feature
// is a pure function of where it stands.

import { PALETTE, RUNWAY } from './config.js';
import { hash2, hash3 } from './random.js';

const CELL = 200; // the field grid, in metres

/** The x of the river's centre at a given z: two slow sine bends stacked. */
export function riverCenterX(z) {
  return 1050 + 480 * Math.sin(z * 0.00035) + 160 * Math.sin(z * 0.0011);
}

const TOWN = { x: 1500, z: -5300, r: 250 };

/** True when a point stands in the town's ground, where houses replace fields. */
function inTown(x, z) {
  const dx = x - TOWN.x;
  const dz = z - TOWN.z;
  return dx * dx + dz * dz < TOWN.r * TOWN.r;
}

/**
 * The ground colour at a world point, as [r, g, b]. Features are tested in the order a
 * pilot notices them: runway first, then water, road, town, and the field underneath.
 */
export function groundColorAt(x, z) {
  if (Math.abs(x - RUNWAY.x) <= RUNWAY.width / 2 && z >= RUNWAY.zNorth && z <= RUNWAY.zSouth) {
    return PALETTE.runway;
  }
  const riverDx = Math.abs(x - riverCenterX(z));
  if (riverDx < 62) return PALETTE.water;
  if (riverDx < 84) return PALETTE.bank;
  if (Math.abs(x + 720) < 13 || Math.abs(z + 4600) < 13) return PALETTE.road;
  if (inTown(x, z)) return PALETTE.plaza;

  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  const h = hash2(cx, cz);
  if (h > 0.86) return PALETTE.forest;
  return PALETTE.fields[Math.floor(h * 41) % PALETTE.fields.length];
}

/** Whether a tree or house may stand at a point: not on water, road, runway or plaza. */
function clearOfFeatures(x, z) {
  if (Math.abs(x - riverCenterX(z)) < 100) return false;
  if (Math.abs(x + 720) < 40 || Math.abs(z + 4600) < 40) return false;
  if (Math.abs(x - RUNWAY.x) < 90 && z > RUNWAY.zNorth - 160 && z < RUNWAY.zSouth + 160) return false;
  return true;
}

/**
 * The still objects of the valley — trees and town houses — inside a rectangle, placed by
 * hash so the list is the same whoever asks. Each is { kind, x, z, size, tone }.
 */
export function scatterObjects(x0, z0, x1, z1) {
  const out = [];
  const cx0 = Math.floor(x0 / CELL);
  const cx1 = Math.floor(x1 / CELL);
  const cz0 = Math.floor(z0 / CELL);
  const cz1 = Math.floor(z1 / CELL);
  for (let cx = cx0; cx <= cx1; cx += 1) {
    for (let cz = cz0; cz <= cz1; cz += 1) {
      for (let k = 0; k < 3; k += 1) {
        if (hash3(cx, cz, k) > 0.42) continue;
        const x = cx * CELL + hash3(cx, cz, k + 11) * CELL;
        const z = cz * CELL + hash3(cx, cz, k + 23) * CELL;
        if (!clearOfFeatures(x, z) || inTown(x, z)) continue;
        out.push({ kind: 'tree', x, z, size: 7 + hash3(cx, cz, k + 37) * 5, tone: hash3(cx, cz, k + 41) });
      }
    }
  }
  // The town: a loose grid of houses around its plaza.
  for (let i = 0; i < 26; i += 1) {
    const a = hash2(i, 771) * Math.PI * 2;
    const r = 60 + hash2(i, 773) * (TOWN.r - 70);
    const x = TOWN.x + Math.cos(a) * r;
    const z = TOWN.z + Math.sin(a) * r * 0.8;
    out.push({ kind: 'house', x, z, size: 9 + hash2(i, 775) * 5, tone: hash2(i, 777) });
  }
  return out;
}

/** The clouds: a fixed, hashed scatter of flat-bottomed puffs at cruising height. */
export function cloudField() {
  const out = [];
  for (let i = 0; i < 42; i += 1) {
    out.push({
      x: (hash2(i, 911) - 0.5) * 9000,
      z: 1200 - hash2(i, 913) * 12500,
      alt: 430 + hash2(i, 917) * 260,
      size: 130 + hash2(i, 919) * 240,
    });
  }
  return out;
}

/** The ridge line on the horizon: a height in [0, 1] for any compass bearing. */
export function ridgeHeight(bearing) {
  return (
    0.45 +
    0.3 * Math.sin(bearing * 3 + 1.2) +
    0.18 * Math.sin(bearing * 7 + 4.1) +
    0.07 * Math.sin(bearing * 13 + 0.4)
  );
}
