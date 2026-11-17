# Vela Mar — Countdown Getaway

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/reyxnal/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/reyxnal/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game built for the [Make GTA 6 competition on make.fun](https://make.fun/bounty/gta6-01): **5 jobs before sunrise across a 4-district sun-soaked port city**, playable offline in a desktop browser with keyboard and mouse.

Ria Calloway came to Vela Mar to work the festival lights. One borrowed car later, fixer Delia Voss owns her night: steal cars, outrun the Vela Mar police, settle the dockside score, and make the last getaway to the marina yacht before sunrise.

## What is in the game

- **Open city on foot and by car** — grid streets, traffic, pedestrians, a marina with yachts, container docks, a night market, and a festival plaza with a stage and Ferris wheel.
- **Steal and drive** — 6 vehicle types with distinct handling, nitro, a stunt ramp, and a garage unlock.
- **Wanted level + police** — 5 stars, pursuing interceptors with flashing light bars, sirens, busts, and a lay-low lockup that clears the heat.
- **Missions and story** — 5 chained jobs with briefings, objective beacons, a checkpoint race against the clock, a crew fight, an escape, and a finale chase.
- **Combat** — pistol with reload, punches, rival crews that chase and shoot, health, and cash/ammo pickups.
- **HUD + minimap** — cash, reputation, wanted stars, countdown-to-sunrise clock, health, ammo, speed, zone names, and a live minimap.
- **Start, pause and save** — title screen, pause menu, quality toggle, and save/continue in the browser.
- **Polish** — day-to-night lighting that follows the countdown, particles, camera shake, and fully synthesized WebAudio music and sound effects. No audio files, no network requests.
- **Side play** — 8 hidden festival tokens, stunt jumps, and free roam after the finale.

Everything is original: the city, characters, vehicles, names, story, art, sounds and music. Nothing from any commercial game.

## Play it

Serve `game/` with any static file server and open `game/index.html` in desktop Chrome, for example:

```sh
cd game && python3 -m http.server 8080
```

Then open http://localhost:8080 — no build step, no network needed.

Controls: WASD move/drive, mouse camera (click to lock), E enter/steal/exit cars, click shoot, F punch, R reload, Shift sprint/nitro, Space jump/handbrake, H horn, M sound, P save, Esc pause.

## Layout

- `game/index.html` + `game/styles.css` — page and HUD styling.
- `game/src/` — one job per file: `config.js` (world data + missions), `city.js` (procedural city + lighting + particles), `vehicles.js` (driving + traffic + police + wanted), `actors.js` (player + pedestrians + combat), `missions.js` (mission chain + saves), `hud.js` (HUD + minimap + menus), `audio.js` (synthesized sound), `input.js`, `main.js` (camera + loop + staging).
- `game/vendor/three.module.min.js` — vendored three.js (MIT), the only library.
- `screenshots/` — 4 real renders of the game running.
- `main.ts` — the entry program: copies `game/` + `screenshots/` to the output directory and writes `dossier.json` with `vendor/makefun-game.ts`.

## License

MIT — see [LICENSE](LICENSE).
