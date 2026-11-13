# ShipStruct Academy mini-games

Open `games.html`, or choose **Mini-games** from the original dashboard navigation or the new dashboard card. The feature is buildless and uses the existing Vercel static deployment.

## Included games

| Game | Interaction | Content |
| --- | --- | --- |
| Name That Ship Part | Four choices or typed recall | Six sampled structural members and two real dry-dock photo questions |
| Find the Part | Tap a diagram zone | Six sampled members in a bulk-carrier section |
| Match Part & Function | Select a part, then a function | Five sampled pairs |
| Build the Cross-Section | Tap to place, keyboard or desktop drag and drop | Eight structural pieces |
| Spot the Defect | Select an inspection region | One real corrosion photo and four authored defect illustrations |
| Hogging or Sagging? | Read an animated hull shape | Six bending / deck and bottom stress questions |
| Loading Puzzle | Place cargo blocks on a 3 × 3 plan | Three solvable cargo-moment puzzles |
| Stability Predictor | Predict and calculate | Six questions on moving weights, G, GM and free surface |
| Guess the Ship Type | Identify real photos and a schematic | Bulk carrier, oil tanker, container ship, cruise ship, LNG carrier and ro-ro vehicle carrier |
| Watertight Boundary Hunt | Tap every compromised detail | Three layouts with open doors, unsealed penetrations and through-cracks |

Practice has no time limit and offers hints. Challenge has a two-minute deadline and no hints. The full-game score counts correct first attempts; retries are allowed for learning. Unfinished items remain part of the total when the deadline expires. Restarting or leaving an unfinished game does not record a result.

## Progress and existing app

- Scores use browser local storage under `shipstruct-minigames-v1`, with separate best scores and run counts for each mode.
- They do not modify `shipstruct-academy-progress-v1`, Supabase profiles, course notes, lecturer exams or classroom results.
- No new database tables, storage buckets, credentials or backend migration are required.
- The original self-contained dashboard is retained; its only changes are the mini-games navigation link and feature card.
- Real photos load from bundled local JPEG files. Attribution and license links appear beside photographs and on the credits page. See `GAME_IMAGE_CREDITS.md`.
- Diagrams and moment calculations are simplified educational models. They do not establish a real vessel’s loading, structural condition or full stability compliance.

## Maintenance and checks

`games-data.mjs` contains questions and accepted recall aliases. `games-visuals.mjs` contains original SVG diagrams. `games-core.mjs` contains grading, progress validation and cargo moments. `games.js` controls the interface.

Run the meaningful data / scoring / persistence / balance checks with:

```sh
node --test games-core.test.mjs
node --check games.js
```

The release was also checked through full browser play-throughs of all ten games, retries, typed recall, keyboard controls, score persistence and phone-width layouts. Keep development-only responsive harnesses out of the repository and deployment.
