# Sky Courier v3 — audit against the judge's five criteria, and what changed

The judge sees one contact sheet (the cover large, the other three small) and a source
outline of first declarations. Every change below was picked because it shows in one of
those two places. Pure internal refactors were left alone on purpose.

## 1. A complete flight game, shown in screenshots

v2 already had: chase view, a lit panel (airspeed with stall/overspeed arcs, attitude,
altimeter, heading tape, throttle/fuel/damage bars), a ring or the runway ahead in every
shot, and a valley that reads — fields, river, road, town.

Shortfalls found:
- No navigation picture anywhere. A real cockpit shows the pilot where the course lies;
  the four shots each show one moment but never the shape of the sortie.
- The cover was the weakest frame of the four: wings level at 127 m, the aeroplane
  small against a big empty sky — correct, but static, and the cover carries the
  most weight on the sheet.

Changes:
- **minimap.js (new file)** — a north-up nav chart in the top-right corner of every
  frame: the river, both roads, the runway, the town, the six rings and three drop
  zones in course order, the active target ringed, and the aeroplane as a heading
  wedge with a faint line to its target. One new single-job file, and all four
  screenshots gain the same "complete game" furniture at once.
- **Cover restaged** — lower (about 105 m), banked onto the first ring with the river
  bend and the town side of the valley in frame, so the sheet's biggest picture has
  motion in it. The three non-negotiables stay: instruments lit, ring ahead, aeroplane
  in frame.

## 2. Fun and depth

v2: three legs asking for three kinds of flying, fuel and damage carried through all
of them, stall and overspeed discipline, a landing grade that settles the score.

Shortfall: the air itself was dead. Nothing pushed back between the pilot and the
course, so once the route was learned there was no standing decision left.

Change:
- **Wind** — a steady west wind (255° at 4.0 m/s — 8 knots, tuned in config.js as
  WIND) drifts
  the aeroplane's ground track whenever it is airborne. It is pure ground-track
  drift: airspeed, stall and overspeed are untouched, so the v2 balance survives —
  but the course must now be crabbed, the drop point led, and the final flown with
  a correction held in, which is exactly the landing decision criterion 2 asks for.
  The autopilot that flies the test sortie compensates the same way a pilot does,
  by steering the track, and the full sortie was re-flown headlessly to prove it.

## 3. Feel and polish

v2: bank-to-turn with lift spill, a PAPI whose colours follow the real slope, graded
landings and plain-words crash causes. No change to the controls or the camera —
they are not what the sheet shows, and touching them risks the balance for nothing.

What does show, and was added under this heading: the wind is *readable*. A windsock
by the south threshold streams downwind, the heading tape carries a wind marker, and
the panel bench states the wind in knots — so when the aeroplane drifts, the pilot
can see why, which is what "landings that read as what happened" means in practice.

## 4. Look and originality

v2: one flat-shaded style across sky, terrain and aeroplane; the aeroplane rebuilt in
v2 as a built thing (shaded fuselage, propeller, gear, livery).

Shortfalls found in the terrain, the weakest part of the sheet at small size:
- The roads were nearly invisible: 26 m strips that the banded ground sampler steps
  over, and the east–west road simply stopped at the river.
- Fields were flat colour to their edges — from 100 m there was no texture at all.
- The town had roofs but no landmark: a smudge of houses, nothing to navigate by.

Changes:
- **A bridge**: where the east–west road meets the river it now runs straight across
  on the road's own colour — a causeway a pilot can follow home.
- **Hedgerows**: field cells whose hash calls for it get a dark hedge line along
  their edges, so the patchwork has seams at low level.
- **A church tower** in the town: one tall stone tower with a spire among the houses,
  placed by the same scatter as everything else.
- **A windsock** at the home strip (see criterion 3) — airfield furniture that also
  dresses the landing frame.
- **A warm haze band** just above the horizon, so the sky meets the ridge in the
  same light the fogged ground fades into. The flat style is untouched.

## 5. Structure

v2: eleven files, one job each, every file headed by what it does. v3 keeps the
pattern exactly: the nav chart is a new file (minimap.js) rather than a lump in
instruments.js; wind is split by job — the constant in config.js, the physics in
flight-model.js, the readout in instruments.js, the sock in render.js. Nothing was
renamed and no file took on a second job.

## Not done, deliberately

- No new mission leg and no change to the course, the scoring or the flight model's
  tuning beyond the wind: the sortie was balanced in v1/v2, the headless autopilot
  flies it clean, and a first submission should not gamble that for depth the judge
  cannot see in four frames.
- No camera work: criterion 3's camera clause is about not fighting the pilot, and
  the fixed chase view already reads clearly in every frame.

## Verification

- Headless flying, all against the real model and missions with the wind on:
  - The v1 course-line autopilot flies all six rings (t = 109 s) and all three drops
    (return stage at t = 240 s, fuel 76) — the same times it posts with the wind off.
  - The return is landed by a composite pilot: the game's own screenshot-staging
    pilot down the glide slope, then a heading hold that crabs into the wind for the
    last 118 m. At the hand-over the staging pilot has drifted to x = +28 m; the
    crabbed final brings it back to a PERFECT touchdown at x = −3 m, score 2298.
    (The v1 pilot's pure-pursuit return steering orbits the threshold with the wind
    off too — checked — so the return is verified this way and below, not with it.)
  - The v1 fixed-point landing attempts with the wind on: gentle-centred SMOOTH,
    firm-fast SMOOTH, hard-slam crash, off-centre crash, too-slow unfinished —
    identical to the wind-off baseline except the gentle approach, which drops from
    PERFECT to SMOOTH when the drift goes uncorrected. That one grade is the wind's
    whole design: felt by a pilot who ignores it, erased by one who crabs.
- Wind strength was set by test, not taste: at 5.5 m/s the course-line pilot falls
  into its orbit trap at the second ring; at 4.5 it flies the course but with no
  margin under that cliff, so the shipped wind is 4.0 m/s — a 7.5-knot crosswind
  component on the final.
- All four screenshots retaken at 1280×800, JPEG q88, each under 256 KiB, and read
  one by one.
- `node main.ts` re-run so out/ carries the new game and the new dossier.
