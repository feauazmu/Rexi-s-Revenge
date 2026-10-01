# Rexi's Revenge

A comedic pixel-art arena shooter in the style of Heli Attack 3, played in the browser.
Play it at <https://feauazmu.github.io/Rexi-s-Revenge/>.

## Controls (desktop)

- Move: A/D or ←/→
- Jump: W, ↑ or Space
- Aim: mouse; fire: hold the left button

## Controls (touch, landscape)

- Move: left stick (pull it down to drop through a platform)
- Aim and fire: right stick
- Jump: the red button; switch Weapon: tap the Weapon icon; pause: the button at the top right
- Menus: the d-pad (or swipe), ✓ to confirm, ✕ to go back

Try them in a desktop browser with `?device=touch`.

## Development

Requires Node 24+.

```sh
npm install
npx playwright install chromium   # once, for the smoke test
npm run dev                       # http://localhost:5173/Rexi-s-Revenge/
npm run check                     # typecheck, lint, test, build, smoke (what CI runs)
npm run golden:update             # re-render golden images after an intended visual change
npm run share-preview             # re-render the favicons, app icons and link preview in public/
```

See [docs/architecture.md](docs/architecture.md) for the module layout, seams and how to add
Enemies, Weapons and golden tests, and [CONTEXT.md](CONTEXT.md) for the domain vocabulary.
