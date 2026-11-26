# sky-courier

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/THANKYOU-12138/sky-courier/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/THANKYOU-12138/sky-courier/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Sky Courier is an original canvas flight game with no engine and no assets: one small red aeroplane, one valley, and a day's mail to move. A sortie is three legs flown as one continuous flight — thread six glowing rings over the valley, get low and slow to drop supply crates on three marked fields, then bring her home and land on the runway you left, graded by how gently you arrive. The flight model keeps honest books: throttle, bank-to-turn, a stall that drops the nose, overspeed that shakes the airframe, fuel that burns and damage that costs score, so every sortie is a set of decisions rather than a joyride. Everything is drawn and sounded by code — pseudo-3D patchwork terrain with a river, a road and a town, a lit instrument panel (airspeed, attitude, altimeter, heading tape), and WebAudio-synthesised engine, wind and touchdown sounds.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in a desktop browser

# to hand it in the way the scorer does:
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Fly with the arrow keys (pitch and bank), W/S for throttle, SPACE to drop a crate, M for sound, R to start over.

---

<sub>Entered on [make.fun](https://make.fun/?ref=eager-gecko-95-5223&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
