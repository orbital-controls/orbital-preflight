# Orbital Preflight

Load the keybinds file from your space sim, connect your controllers, test every bind against a mock flight, rebind anything and export a new preset. It runs entirely in the browser tab: files are read with `FileReader`, nothing is uploaded, and there is no account and no analytics.

It's also a framework. Fork this repo onto GitHub Pages to show off your own binds: visitors test them with their own stick and keyboard, and download them as they are or after changing them.

Elite Dangerous `.binds` files work today. Star Citizen and X4 are listed as coming soon; DCS comes later.

Desktop only: below 1280 px wide the page shows a short notice, with your presets still downloadable from it.

## Fork it

1. **Fork** this repository on GitHub.
2. **Edit `orbital-preflight.config.ts`** at the repo root: your title, description, name, where Leave goes, and your presets. It's the only file you need to change.
3. **Drop your `.binds` files into `static/binds/`** and list them under `presets`. In Elite Dangerous they live in `%LOCALAPPDATA%\Frontier Developments\Elite Dangerous\Options\Bindings\`.
4. **Enable Pages**: Settings → Pages → Source: _GitHub Actions_.
5. **Done.** Every push to `main` deploys to `https://<you>.github.io/<repo>/`. The workflow sets the base path from the repo name.

Optionally replace `static/og.png` (1200 × 630) with your own share image.

### The config

```ts
import { defineConfig } from './src/lib/orbital-preflight/config.ts';

export default defineConfig({
	title: 'CMDR Vex’s binds: test them in your browser',
	description:
		'My Elite Dangerous HOTAS binds. Test every one with your own gear and download them.',
	siteName: 'CMDR Vex',
	siteUrl: 'https://vex.github.io/my-binds',
	homeUrl: 'https://github.com/vex',
	sim: 'elite-dangerous',
	presets: [
		{ file: 'hotas.binds', label: 'My HOTAS setup' },
		{ file: 'keyboard.binds', label: 'Keyboard only' }
	],
	brand: { wordmark: 'Vex Preflight' },
	theme: { '--color-trail': '#ff6a00' },
	poweredBy: true
});
```

| Field         | Required | What it does                                                                                                                                                                                                                                                                                                                   |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `title`       | yes      | The page title, in the head and on the share card. Name what people search for.                                                                                                                                                                                                                                                |
| `description` | yes      | One plain sentence for the meta description and the share card.                                                                                                                                                                                                                                                                |
| `siteName`    | yes      | You or your site. Used in the hidden page heading ("‹siteName› Preflight"), the share card and "Back to ‹siteName›".                                                                                                                                                                                                           |
| `siteUrl`     | no       | The absolute URL the app is served from. With it, the head gets a canonical link and Open Graph `og:url` and `og:image` tags.                                                                                                                                                                                                  |
| `homeUrl`     | yes      | Where Leave goes: your page or your GitHub profile. Leave asks first if there are unsaved changes.                                                                                                                                                                                                                             |
| `sim`         | no       | The sim your presets are for. Default `'elite-dangerous'`, the only one that loads today.                                                                                                                                                                                                                                      |
| `presets`     | no       | Binds files in `static/binds/`, each with a `label`. With one or more, a first visit opens with the first one loaded and the top bar reads "Pilot's binds · ‹label›". Visitors can still load their own file, and download each preset as it is from the Game & binds drawer. With none, a first visit shows the upload state. |
| `brand`       | no       | The top bar's `wordmark` (default "Orbital Preflight"), an optional `mark` (an inline SVG string, drawn at 28 px), an optional heavier `markSmall` for the favicon, and an accessible `label`.                                                                                                                                 |
| `theme`       | no       | CSS variable overrides, applied after the theme package. Use the package's own names (`--color-trail`, `--color-course`, `--font-display`…); its README lists them.                                                                                                                                                            |
| `poweredBy`   | no       | A small "Powered by Orbital Preflight" link in the drawers and the desktop-only notice. On unless set to `false`.                                                                                                                                                                                                              |

The look comes from [`@orbital-controls/theme`](https://www.npmjs.com/package/@orbital-controls/theme), installed from npm: Tailwind v4 tokens, the motif utilities and three self-hosted font families. Re-theme through `theme`, not by copying its values.

## Phil's instance: Preflight on orbitalcontrols.com

Phil's instance lives in `instances/orbitalcontrols/`: its own config (title, `homeUrl: https://orbitalcontrols.com`, the Orbital Controls mark copied from the site's `Mark.svelte`). It builds with:

```sh
ORBITAL_PREFLIGHT_CONFIG=instances/orbitalcontrols/orbital-preflight.config.ts pnpm build
```

and deploys with the same GitHub Pages workflow as a fork, served at `preflight.orbitalcontrols.com`. To set it up in Phil's repository:

1. Set the repository variable `ORBITAL_PREFLIGHT_CONFIG` to `instances/orbitalcontrols/orbital-preflight.config.ts` (Settings → Secrets and variables → Actions → Variables). The Pages workflow builds with it.
2. Settings → Pages: Source _GitHub Actions_, custom domain `preflight.orbitalcontrols.com`, then tick _Enforce HTTPS_ once the certificate is issued.
3. At the DNS host for orbitalcontrols.com, add a `CNAME` record from `preflight` to `orbital-controls.github.io`. Verifying the domain for the `orbital-controls` organisation (Settings → Pages → Verified domains) stops anyone else claiming it.
4. Push to `main`. With a custom domain the base path is empty, so the app is served at the root.

The build output is plain static files, so any static host works too.

## Develop

Node 24 and pnpm.

```sh
pnpm install
pnpm dev            # http://localhost:5173
pnpm check          # svelte-check and TypeScript
pnpm lint           # Prettier and ESLint
pnpm test:unit      # Vitest
pnpm test:e2e       # builds root, base-path and theme variants, then Playwright
pnpm build          # static output in build/
```

`pnpm test:e2e` uses Playwright's Chromium (`pnpm exec playwright install chromium`). To use a Chromium you already have, set `PW_CHROMIUM_PATH`.

### Where things are

| Path                                        | What                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| `orbital-preflight.config.ts`               | The fork's config.                                                              |
| `src/lib/orbital-preflight/sims/`           | Sim adapters: parse and write. `elite/` is the Elite Dangerous one.             |
| `src/lib/orbital-preflight/xml.ts`          | An XML scanner that keeps offsets, so the writer splices instead of rebuilding. |
| `src/lib/orbital-preflight/bindings.ts`     | Clashes, Move / Swap / Keep both, filter counts. Pure.                          |
| `src/lib/orbital-preflight/binds.svelte.ts` | The bind store: the file, the edits, undo per action, reset per mode, export.   |
| `src/lib/orbital-preflight/flight.ts`       | The mock flight state machine and the HUD values. Pure.                         |
| `src/lib/orbital-preflight/inputs/`         | Keyboard, mouse and Gamepad API input, and controller pairing.                  |
| `src/lib/components/`                       | One component per UI piece.                                                     |

### Plugging in the 3D scene

`Viewport.svelte` takes an optional `scene` snippet. It receives `SceneProps` from `flight.ts`, `{ flight, mode }`, renders, and reports nothing back. The HUD is DOM on top and reads the same state, so it doesn't depend on the scene. Until a scene is passed, the boards' 2D placeholder draws.

### Exports

Export new preset writes a new file: the original text with the changed slots and the `PresetName` replaced, and every other byte left as it was. The file you loaded is never modified. The new preset is named "‹original name› rebound", and the file "‹name›.‹major›.‹minor›.binds".

## Unverified

These were written from memory, not checked against real files or devices, and are marked `UNVERIFIED` in the code:

- **The `.binds` format details**: action ids, the `_Buggy` and `Humanoid` naming, key names (`Key_LeftShift`, `Key_Numpad_7`…), `Joy_POV1Up`, `Pos_`/`Neg_` axis halves, mouse wheel keys, and DirectInput mouse numbering. The test fixtures in `tests/fixtures/` and the demo preset are **synthetic**.
- **Device names and USB ids** used to pair browser controllers with the devices in a file (`T16000M` → `044f:b10a`, and so on).
- **The "Where's my file?" paths** for all four sims.
- **Export file naming** (`‹name›.4.0.binds`) and whether the game accepts any `PresetName`.
- **Browser HOTAS limits**: how many buttons and axes Chrome and Firefox expose for a stick with 32+ buttons, axis order, and how each reports POV hats.
- **Throttle axis direction**: full forward is taken as −1.

## Licence

MIT, see [LICENSE](./LICENSE). The fonts that come with the theme package are under the SIL Open Font License 1.1.
