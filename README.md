# 100 Doors: Brain Escape

A 100-level mobile brain/escape-room game.

## Gameplay
Every door uses a different reasoning pattern: observation, logic, sequence, memory, cipher, lateral thinking and multi-step deduction. Chapters (10 levels each) escalate in difficulty and shift visual theme; wrong answers give progressively stronger hints instead of just failing you.

## Audio
`www/audio.js` synthesizes all music and sound effects live with the Web Audio API — there are no `.mp3`/`.ogg` files to manage. Ambient background music shifts key per chapter; short chimes/buzzes/fanfares layer on top for taps, correct/wrong answers, hints, chapter completion and the final door. A mute toggle (top-right, 🔊/🔇) persists across sessions via `localStorage`. Since mobile browsers require a user gesture before audio can play, music starts on the first tap.

## Run as web app
```bash
python3 -m http.server 8080 -d www
```

## Android
```bash
npm install
npx cap add android
npx cap sync android
```

GitHub Actions builds a debug APK on every push to `main`.

## Premium layer
- Chapter door map with jump to unlocked doors
- 1-3 stars per door (clean solve / few attempts / hint used)
- Keys from stars, spent on extra hints or wood/metal/glass door skins
- Daily door seeded by the date
- Achievements, vibration toggle, EN/BN UI chrome
- Visual clue chips and chapter story line on every door

## Levels (v2 rewrite)
100 hand-built puzzles, 10 types x 10 difficulty steps, one of each type per chapter (level 10 of every chapter is a "Master Lock"). Every answer is verified by script; logic puzzles are brute-force checked for a single valid solution. Optional per-level fields: `time` (star window), `memTime`/`ask`/`text` (memory), `alt` (accepted alternate answers), `choices`.
Run `npm run validate:levels` after editing `www/levels.json`.

## Hint system
Three hint steps per door, shown in a persistent box under the puzzle:
1. Method hint (free) - caps the door at 2 stars
2. Near-answer (costs 1 hint) - crosses out a wrong option, or gives length and parity/first letter - caps at 1 star
3. Last resort (costs 1 hint) - crosses out another option, or shows a pattern like `S _ _ _ T`
Hints are earned by a first-time 3-star clear (+1) and the daily door (+1); 🔑 keys also buy hints. Max 9 stored.


## Visual Image Puzzles
The game includes 100 built-in visual brain puzzles in `www/image-puzzles.json`. The 🧩 Image button opens the puzzle for the current level in a lightweight modal. Visuals are generated as inline SVG at runtime, so no image assets or external libraries are required. Solving each image puzzle once awards one key.
