// Solmar Heat — the entry program (Node 22, standard library only). It hands
// the game in: copies game/ and screenshots/ from beside this file to /output
// and writes /output/dossier.json with the vendored make.fun library, exactly
// as the grader expects. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for
// /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly instead of handing in an entry with no screenshots: the gate
// refuses an entry whose screenshots/ holds fewer than 3 images.
const shotsDir = join(here, 'screenshots');
const shots = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((n) => !n.startsWith('.') && /\.(png|jpe?g)$/i.test(n))
  : [];
if (shots.length < 3) {
  throw new Error(`screenshots/ holds ${shots.length} image(s); the gate needs 3 or 4`);
}
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing');
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

console.log(
  `Solmar Heat handed in: ${shots.length} screenshot(s), dossier ${dossier.length} bytes -> ${out}`,
);
