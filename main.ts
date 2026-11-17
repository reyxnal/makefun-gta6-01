// Verdeluz: Witness City — entry point.
//
// The grader runs this file with no arguments, from an arbitrary clean
// working directory, under Node 22 with only the standard library. It
// locates its own repository root from this file's URL (never from the
// working directory), copies game/ and screenshots/ into the output
// directory, and writes dossier.json via the vendored buildDossier.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function fail(message) {
  console.error('main.ts: ' + message);
  process.exit(1);
}

function countEntries(root) {
  let files = 0;
  let bytes = 0;
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else {
        files += 1;
        bytes += st.size;
      }
    }
  };
  walk(root);
  return { files, bytes };
}

function main() {
  const repoRoot = dirname(fileURLToPath(import.meta.url));
  const gameDir = join(repoRoot, 'game');
  const shotsDir = join(repoRoot, 'screenshots');
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

  if (!existsSync(join(gameDir, 'index.html'))) {
    fail('game/index.html not found under ' + repoRoot);
  }
  if (!existsSync(shotsDir)) {
    fail('screenshots/ not found under ' + repoRoot);
  }
  const shots = readdirSync(shotsDir).filter((n) => /\.(png|jpe?g)$/i.test(n));
  if (shots.length < 3 || shots.length > 4) {
    fail('expected 3-4 screenshots, found ' + shots.length);
  }

  mkdirSync(outDir, { recursive: true });
  // Clear any stale output from an earlier run so a re-run can never
  // hand in files this entry no longer has.
  rmSync(join(outDir, 'game'), { recursive: true, force: true });
  rmSync(join(outDir, 'screenshots'), { recursive: true, force: true });
  rmSync(join(outDir, 'dossier.json'), { force: true });
  cpSync(gameDir, join(outDir, 'game'), { recursive: true });
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outDir, CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);

  // Verify the written dossier round-trips and names every screenshot.
  const parsed = JSON.parse(readFileSync(join(outDir, 'dossier.json'), 'utf8'));
  if (parsed.schema !== 'makefun/dossier/v1') {
    fail('dossier schema mismatch: ' + parsed.schema);
  }
  if (!Array.isArray(parsed.images) || parsed.images.length !== shots.length) {
    fail('dossier holds ' + (parsed.images ? parsed.images.length : 0) + ' images, expected ' + shots.length);
  }

  const game = countEntries(join(outDir, 'game'));
  const shotsOut = countEntries(join(outDir, 'screenshots'));
  console.log('Verdeluz entry written to ' + outDir);
  console.log('game/: ' + game.files + ' files, ' + game.bytes + ' bytes');
  console.log('screenshots/: ' + shotsOut.files + ' files, ' + shotsOut.bytes + ' bytes');
  console.log('dossier.json: ' + dossier.length + ' bytes');
}

main();
