// Vela Mar — Countdown Getaway: entry program for make.fun gta6-01.
// Node 22, standard library only. It takes no arguments and finds its own
// inputs: the game/ and screenshots/ folders beside this file. It copies
// both into the output directory and writes the dossier with the kit's
// vendored library, exactly as the grader expects.
//
// Local check (MAKEFUN_OUTPUT_DIR stands in for /output outside the grader):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail fast on a bad checkout instead of writing a partial dossier: the
// grader runs this program with no arguments and no second chance.
if (!existsSync(join(repoRoot, 'game', 'index.html'))) {
  throw new Error('Vela Mar entry is incomplete: game/index.html is missing beside main.ts');
}

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
