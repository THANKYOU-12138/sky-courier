// Sky Courier's hand-in program (Node 22, standard library only). The game itself is the
// game/ folder beside this file — plain static files a desktop browser plays offline — and
// this program's whole job is to hand it in: copy game/ and screenshots/ to the output
// directory and write dossier.json there with the vendored make.fun library, so the sealed
// scorer can rebuild the same dossier from the same files and compare them byte for byte.
//
// Run it outside the grader with an output directory of your own:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps are the scorer's own (reference/gate.json): only text_max_bytes shapes the
// dossier's bytes; the rest make this program refuse, here and now, an entry the scorer
// would refuse anyway — too many screenshots or one too heavy, a game folder too big or
// too numerous, a path under game/ too long for the output cap it shares with them.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
