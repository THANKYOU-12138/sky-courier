// config.js — every shared constant of Sky Courier in one place: the canvas stage, the flight
// model's tuning, the world layout (runway, ring course, drop zones) and the terrain palette.
// Design intent: the game is tuned from this file alone, so the feel of the aeroplane and the
// shape of the sortie can be balanced without hunting through the code that uses them.

/** The stage the whole game is composed on; the canvas is scaled to the window from this. */
export const STAGE = { width: 1280, height: 800 };

/** Focal length of the chase camera, in stage pixels: the one number the projection hangs on. */
export const FOCAL = 620;

/** Flight-model tuning: speeds in metres a second, angles in radians, fuel in percent. */
export const FLIGHT = {
  stallSpeed: 30, // below this the wing stops holding the nose up
  rotateSpeed: 33, // ground speed at which a takeoff pull lifts the wheels
  overspeed: 95, // past this the airframe complains, then breaks
  maxPitch: 0.46,
  minPitch: -0.52,
  maxRoll: 1.05,
  pitchRate: 0.9, // how fast the nose answers the stick, a second
  rollRate: 2.1, // how fast the wings answer, a second
  gravity: 9.8,
  thrust: 15.5, // full-throttle acceleration before drag
  dragQuad: 0.0021, // drag grows with the square of speed; cruise settles near 65 m/s
  dragBase: 0.55,
  fuelBurnIdle: 0.04, // percent a second at idle
  fuelBurnFull: 0.11, // extra percent a second at full throttle (a clean sortie lands near half a tank)
};

/** The home runway: centre x, the z of its north and south ends, and its width, in metres. */
export const RUNWAY = { x: 0, zNorth: -1500, zSouth: -900, width: 46 };

/** Mission 1: the six rings of the ring run, in the order they must be flown through. */
export const RINGS = [
  { x: 0, z: -2400, alt: 130 },
  { x: -360, z: -3050, alt: 190 },
  { x: 320, z: -3750, alt: 150 },
  { x: 800, z: -4450, alt: 230 },
  { x: -130, z: -5150, alt: 170 },
  { x: -680, z: -5800, alt: 210 },
];
export const RING_RADIUS = 26;

/** Mission 2: the three supply drop zones, and how low and close a drop must be to count. */
export const DROP_ZONES = [
  { x: 1050, z: -6250 },
  { x: -1150, z: -6800 },
  { x: 200, z: -7400 },
];
export const DROP_RADIUS = 95;
export const DROP_MAX_ALT = 75;
export const CRATES_CARRIED = 5;

/** Scoring: what each part of a sortie is worth, before fuel and damage are settled. */
export const SCORE = {
  ring: 150,
  drop: 200,
  landingPerfect: 500,
  landingSmooth: 350,
  landingFirm: 200,
  fuelPoint: 2, // score for each percent of fuel brought home
  damagePoint: 3, // score lost for each percent of damage taken
  parSeconds: 380, // a sortie inside this time earns a small bonus a second
  parBonusCap: 150,
};

/** Terrain palette as [r, g, b] so the renderer can fog-mix colours without parsing strings. */
export const PALETTE = {
  fields: [
    [106, 148, 62],
    [122, 160, 70],
    [148, 168, 84],
    [168, 152, 84],
    [140, 116, 72],
    [92, 134, 58],
    [178, 164, 102],
  ],
  forest: [70, 106, 50],
  water: [56, 108, 148],
  bank: [180, 166, 122],
  road: [98, 98, 102],
  runway: [50, 52, 56],
  plaza: [170, 162, 150],
  fog: [198, 218, 230],
};
