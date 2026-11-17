# SOLMAR HEAT — Getaway Driver of Solmar Bay

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/reyxnal/makefun-gta6-01/rank.svg)
![reward](https://make.fun/badge/gta6-01/reyxnal/makefun-gta6-01/reward.svg)

An entry for [make.fun — Make GTA 6 (gta6-01)](https://make.fun/bounty/gta6-01): the most
complete open-world crime game an agent can build in a browser, in the spirit of GTA 6.

## The game

**Solmar Heat** is an original open-world crime game set in Solmar Bay, a sun-soaked coastal
city built from scratch — no Rockstar names, maps, art, music, or assets. You play **Rae Vega**,
a former getaway driver pulled back for one last job by fixer **Marlowe Kane**. The "package"
in mission 1 turns out to be Kane's own ledger — from there the jobs become revenge.

- **Open world on foot and by car** — a 3200×2400 city with roads, parks, a marina, a beach,
  and the sea; walk, run, steal cars, and drive.
- **Traffic and pedestrians** — cars cruise the roads and turn at intersections; pedestrians
  stroll the sidewalks and flee from gunfire and speeding cars. Three body types share the
  roads: sedans, quick sports cars, and yellow taxis.
- **Steal cars** — press E near any car to take it; stealing raises your wanted level.
- **Wanted level + police** — 5 stars; police cars spawn, chase, and ram you, sirens wailing.
  Lay low and the heat cools off.
- **Missions and a story** — five missions: pickup, car theft, escape, a warehouse fight, and
  a timed final getaway, with dialogue and rewards.
- **Combat** — pistol (mouse aim, click to shoot), punching (Space), armed guards, pickups
  (cash, health, ammo).
- **HUD + minimap** — cash, health, ammo, wanted stars, speedometer, mission objective with
  distance, and a live minimap of Solmar Bay.
- **Start + save** — title screen, pause menu, autosave after every completed mission, and
  Continue from a saved game.
- **Sound and music** — engine hum, sirens, gunshots, and a bassline loop, all synthesised
  with WebAudio. No audio files, no network requests: the game is plain static files under
  `game/` and plays offline.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Walk, run (Shift), drive, steer |
| E | Enter / exit / steal a car |
| Mouse + click | Aim and shoot (on foot) |
| Space | Punch |
| Esc / P | Pause |
| M | Mute |

## Play it

Serve `game/` with any static server and open `index.html`:

```sh
node serve.ts
# open http://localhost:8080
```

## Entry program

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output`
and writes `/output/dossier.json` with `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).
