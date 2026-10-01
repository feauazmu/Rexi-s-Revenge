# Rexi's Revenge

A comedic pixel-art arena shooter in the style of Heli Attack 3, played in the browser.
Play it at <https://feauazmu.github.io/Rexi-s-Revenge/>.

## Controls (desktop)

- Move: A/D or ←/→
- Jump: W, ↑ or Space
- Aim: mouse; fire: hold the left button

## Development

Requires Node 24+.

```sh
npm install
npx playwright install chromium   # once, for the smoke test
npm run dev                       # http://localhost:5173/Rexi-s-Revenge/
npm run check                     # typecheck, lint, test, build, smoke (what CI runs)
npm run golden:update             # re-render golden images after an intended visual change
```

See [docs/architecture.md](docs/architecture.md) for the module layout, seams and how to add
Enemies, Weapons and golden tests, and [CONTEXT.md](CONTEXT.md) for the domain vocabulary.
