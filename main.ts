// Frostpeak Drift — main.ts
//
// The entry point the grader runs with Node. It gathers this repository's
// game and screenshots into the output directory, then asks the vendored
// make.fun library to describe that output as a dossier.
//
// Usage: node main.ts
// The output directory comes from MAKEFUN_OUTPUT_DIR, or "/output" when
// that variable is not set.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Where this file lives is where the repository lives: the game and the
// screenshots sit beside it.
const here = dirname(fileURLToPath(import.meta.url));

// The grader tells us where to put the result; without that hint we use
// the conventional "/output" directory.
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
mkdirSync(outDir, { recursive: true });

// Copy the playable game and its screenshots into the output directory,
// creating each destination first. A missing screenshots folder is fine
// here — buildDossier will say so itself if it needs one.
for (const name of ['game', 'screenshots']) {
  const from = join(here, name);
  if (!existsSync(from)) continue;
  cpSync(from, join(outDir, name), { recursive: true });
}

// The caps for this bounty, exactly as the gate states them.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`dossier.json written to ${join(outDir, 'dossier.json')}`);
