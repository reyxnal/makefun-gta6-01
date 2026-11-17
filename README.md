# Verdeluz: Witness City

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/reyxnal/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/reyxnal/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world action game built for the [Make GTA 6](https://make.fun/bounty/gta6-01) competition on [make.fun](https://make.fun).

## The idea

Mara Voss came home to Verdeluz to bury the past. The city had other plans.

**The witness rule — the game's signature mechanic:** in Verdeluz, a crime only
counts if someone *sees* it. A pedestrian with line of sight, a cop on patrol,
or a CCTV camera will call it in after a short delay — the witness flashes red
so you can see exactly who saw you. Break line of sight, wait for the street
to empty, disable cameras, or hit Rosa's Garage for a respray, and you stay a
ghost. Get witnessed, and the VPD responds with a six-star wanted system.

Around that core: a full drivable city with traffic and pedestrians, stealable
cars, six story missions against Councilman Vane and his crew "The Gulls", a
live social feed (Chatter) that reacts to everything you do, a Criminal Profile
tracking violence vs. kindness, taxi fares, hidden packages, stunt jumps, good
deeds, a day/night cycle with dynamic lighting, and three procedural radio
stations — all synthesized live with WebAudio. No external assets, no network
requests, fully offline.

## How to play

Open `game/index.html` in a desktop browser (serve the folder over HTTP, e.g.
`python3 -m http.server`, since ES modules need a server), or just play the
built entry. No install, no dependencies.

| Key | Action |
| --- | --- |
| W A S D / Arrows | Move / drive |
| Mouse | Aim (on foot) |
| Left click | Shoot / punch |
| F | Enter / exit car |
| E | Interact / talk / help |
| Q / Wheel / 1–4 | Switch weapon |
| R | Reload |
| Space | Handbrake |
| H | Horn |
| Shift | Run |
| Tab | Chatter feed |
| N | Next radio station |
| M | Mute |
| Esc / P | Pause |

## Structure

- `game/index.html` — page shell, HUD, overlays
- `game/styles.css` — all styling
- `game/src/main.js` — orchestration, player, interactions, overlays
- `game/src/config.js` — world constants, tuning, palettes, names
- `game/src/rng.js` — seeded RNG
- `game/src/input.js` — keyboard / mouse
- `game/src/audio.js` — WebAudio synth: engine, sirens, SFX, radio
- `game/src/city.js` — procedural city, collision, line of sight
- `game/src/vehicles.js` — driving physics, traffic AI, police pursuit
- `game/src/actors.js` — pedestrians, cops, Gulls, witness sight checks
- `game/src/combat.js` — bullets, melee, explosions, damage
- `game/src/wanted.js` — witness-based wanted system
- `game/src/feed.js` — Chatter social feed
- `game/src/missions.js` — 6 story missions + taxi, packages, jumps, deeds
- `game/src/save.js` — localStorage saves + settings
- `game/src/hud.js` — DOM HUD, minimap, overlays
- `game/src/render.js` — Canvas 2D renderer, lighting, shadows
- `game/src/shots.js` — screenshot scenes + built-in self-test
- `main.ts` — entry point: copies `game/` + `screenshots/` to the output dir and writes `dossier.json`
- `vendor/makefun-game.ts` — make.fun dossier builder (from the starter kit)

## Self-test

Open `game/index.html?selftest=1&autostart=1` to run the built-in checks
(driving, witness logic, combat, missions, feed, save/load, render) in the
browser. Screenshot scenes: `?scene=chase|plaza|marina|night&autostart=1`.

## Originality

Everything in Verdeluz is original: the city, the characters, the story, the
art (drawn in code), and the music (synthesized in code). No Rockstar names,
characters, maps, art, music, or assets are used anywhere.

## License

MIT — see `LICENSE`.
