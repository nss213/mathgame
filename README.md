# Free the X!

A mobile-first puzzle game for students learning to **solve for x**. Each level
is an equation. The student drags (or taps) a move tile, such as `− 5`, `÷ 3`
or `− 2x`, and that move is applied to **both sides**. The goal is to get the
variable by itself.

The game teaches one skill: **choosing the next move**.

- **48 levels in 6 worlds:** Add & Subtract → Multiply & Divide → Two Steps →
  Negatives → Both Sides → Parentheses.
- **Every tray has a right answer** next to the classic mistakes: the wrong
  sign, subtracting a coefficient instead of dividing, and subtracting a
  number that is stuck inside parentheses.
- **Wrong moves are allowed.** They're mathematically valid and the scale
  stays balanced, so the student sees the equation get messier. The owl coach
  then suggests **Undo**.
- **Hints come in two steps.** The first tap explains what is stuck to x and
  highlights it. The second tap makes the right tile glow.
- **Stars** are based on how many moves you took compared with the fewest
  possible. Par is computed by a built-in solver. The stars at the top drop
  live as soon as a move costs one.
- **Juice:** the move is written onto both sides before the equation
  simplifies, the balance scale wobbles, there's confetti, sound effects
  (synthesized, so there are no audio files) and haptics.
- **Win screen** substitutes the answer back into the original equation to
  check it (`2·(5) + 3 = 13 → 13 = 13 ✓`).
- A world intro card explains each new idea, with a worked example.

There's no server, no accounts and no build step. Progress is saved in
`localStorage`. The game works offline after the first visit (service worker)
and can be added to the home screen.

## Run locally

ES modules need to be served over HTTP. Opening `index.html` from disk won't work.

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. On a phone on the same Wi-Fi, use your computer's IP address.

## Tests

```bash
npm test
```

The tests check the math engine and every level: each one is solvable, the
hints lead to the stated answer, and every tray contains a correct move.

## Deploy to GitHub Pages

1. Merge to `main`.
2. In the repo go to **Settings → Pages → Build and deployment → Source**
   and choose **GitHub Actions**.
3. The `Deploy to GitHub Pages` workflow runs the tests and publishes the
   site to `https://<user>.github.io/<repo>/`.

Any other static host (Netlify, Cloudflare Pages, Vercel) also works.
Publish the repo root as-is.

## Code map

| File | What it does |
| --- | --- |
| `js/fraction.js` | Exact rational numbers |
| `js/engine.js` | Equation model `o·(a·x + b) + c`, moves, solver (BFS for par and hints), tile tray generation |
| `js/levels.js` | Worlds, intro lessons, seeded level generators |
| `js/render.js` | Equation → HTML (stacked fractions, highlighting, pending moves) |
| `js/main.js` | Screens, drag & drop, game loop, hints, win flow |
| `js/audio.js`, `js/fx.js` | Sound, haptics, confetti |
| `js/storage.js` | `localStorage` progress |

To add or change levels, edit a world's `gen` function in `js/levels.js`.
Then run `npm test` to confirm that every level is still solvable.
