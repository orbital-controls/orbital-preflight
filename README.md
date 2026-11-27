# Orbital Preflight

Load the keybinds file from your space sim, connect your controllers, test every bind against a mock flight, rebind anything and export a new preset. It runs entirely in the browser tab: files are read with `FileReader`, nothing is uploaded, and there is no account. Analytics are off unless the deploy turns them on (see [Analytics](#analytics)), and never see your binds.

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
	brand: { wordmark: 'Vex Preflight', mark: false },
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
| `brand`       | no       | The top bar's `wordmark` (default "Preflight") and `mark`, an inline SVG string drawn at 28 px (default: the Orbital Controls mark; `false` for the wordmark alone). Also an optional heavier `markSmall` for the favicon, and an accessible `label`.                                                                          |
| `theme`       | no       | CSS variable overrides, applied after the theme package. Use the package's own names (`--color-trail`, `--color-course`, `--font-display`…); its README lists them.                                                                                                                                                            |
| `poweredBy`   | no       | A small "Powered by Orbital Preflight" link in the drawers and the desktop-only notice. On unless set to `false`.                                                                                                                                                                                                              |

### Analytics

None by default: a build with no analytics IDs writes no tag, sets no cookie, shows no banner and makes no third-party request. The IDs come from the build's environment, not the config, so they stay out of the repository and a fork never inherits yours. In the Pages workflow they are repository variables (Settings → Secrets and variables → Actions → **Variables**; not secrets, since the IDs are public in every page's HTML):

| Variable            | What                                                                               |
| ------------------- | ---------------------------------------------------------------------------------- |
| `GA_MEASUREMENT_ID` | A GA4 measurement ID, `G-XXXXXXXXXX`.                                              |
| `UMAMI_WEBSITE_ID`  | The website ID (a UUID) the Umami dashboard shows for the site.                    |
| `UMAMI_HOST`        | Optional. Where the Umami script is served from; default `https://cloud.umami.is`. |

For a local build, set them in the shell: `GA_MEASUREMENT_ID=G-XXXXXXXXXX pnpm build`. A value in the wrong shape fails the build.

- **Google Analytics 4** sets a cookie, so a banner asks first. Until a visitor allows it, the page contacts no Google endpoint: only an inline bootstrap with Consent Mode defaults (everything `denied`) is in the HTML, and the `gtag/js` script is added on Allow. The answer is kept per base path, so two forks on one github.io origin ask separately.
- **Umami** sets no cookie and stores no identifier, so it needs no consent and runs either way; the banner says so when it is on. Ad blockers drop the Google tag for much of this audience, and Umami counts some of those visits. `cloud.umami.is` is on the same blocklists, so a self-hosted `umamiHost` on your own domain counts more.

The tags are written into the prerendered HTML at build time (`src/hooks.server.ts` fills a placeholder in `src/app.html`; nothing runs on a server). Events are sent from `src/lib/orbital-preflight/analytics/events.ts`, the only file the app calls; nothing about a visitor's binds or file names is sent:

| Event          | When                                 | Data                                   |
| -------------- | ------------------------------------ | -------------------------------------- |
| page view      | each navigation                      | URL and title                          |
| `binds_load`   | a preset or the visitor's file opens | `source` (`preset` or `upload`), `sim` |
| `binds_export` | a rebound preset is downloaded       | `sim`, `changes` (binds changed)       |

The look comes from [`@orbital-controls/theme`](https://www.npmjs.com/package/@orbital-controls/theme), installed from npm: Tailwind v4 tokens, the motif utilities and three self-hosted font families. Re-theme through `theme`, not by copying its values.

## Phil's instance: Preflight on orbitalcontrols.com

Phil's instance lives in `instances/orbitalcontrols/`: its own config (title, `homeUrl: https://orbitalcontrols.com`, and `siteUrl` commented out until the subdomain serves it; the brand is the default Orbital Controls mark and "Preflight", copied from the site's `Mark.svelte` into `src/lib/orbital-preflight/brand.ts`). It builds with:

```sh
ORBITAL_PREFLIGHT_CONFIG=instances/orbitalcontrols/orbital-preflight.config.ts pnpm build
```

and deploys with the same GitHub Pages workflow as a fork, served at `preflight.orbitalcontrols.com`. To set it up in Phil's repository:

1. Set the repository variable `ORBITAL_PREFLIGHT_CONFIG` to `instances/orbitalcontrols/orbital-preflight.config.ts` (Settings → Secrets and variables → Actions → Variables). The Pages workflow builds with it.
2. Settings → Pages: Source _GitHub Actions_, custom domain `preflight.orbitalcontrols.com`, then tick _Enforce HTTPS_ once the certificate is issued.
3. At the DNS host for orbitalcontrols.com, add a `CNAME` record from `preflight` to `orbital-controls.github.io`. Verifying the domain for the `orbital-controls` organisation (Settings → Pages → Verified domains) stops anyone else claiming it.
4. Push to `main`. With a custom domain the base path is empty, so the app is served at the root.
5. Uncomment `siteUrl` in `instances/orbitalcontrols/orbital-preflight.config.ts`, so the page gets its canonical and Open Graph tags.
6. For analytics, create a GA4 web data stream and an Umami website for `preflight.orbitalcontrols.com`, and set their IDs as the repository variables `GA_MEASUREMENT_ID` and `UMAMI_WEBSITE_ID` (see [Analytics](#analytics)).

The build output is plain static files, so any static host works too.

## Develop

Node 24 and pnpm.

```sh
pnpm install
pnpm dev            # http://localhost:5173
pnpm check          # svelte-check and TypeScript
pnpm check:svelte   # the Svelte team's autofixer over every component
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
| `src/lib/orbital-preflight/scene/`          | The 3D viewport: pure flight → part mappings, and the three.js engine.          |
| `src/lib/orbital-preflight/analytics/`      | Optional Google Analytics and Umami: head tags, consent, events.                |
| `src/lib/components/`                       | One component per UI piece.                                                     |

### The 3D scene

The ship and SRV views are real-time three.js scenes: the Lantern II flying in space, and the Wick LR driving on a moon, both driven by the same mock flight state the HUD reads. `Viewport.svelte` mounts `Scene3D.svelte`, which loads the engine (`scene/three/`) with a dynamic import, so three.js is a separate chunk fetched only when the viewport mounts. The scene reads `SceneProps` (`{ flight, mode }`) plus the bound stick axes once a frame, renders, and reports nothing back but whether WebGL came up. It never handles input. Switching mode swaps scenes at once: the engine builds the new mode's scene and disposes the last one. See [`scene/README.md`](./src/lib/orbital-preflight/scene/README.md) for the part contracts and how to swap in a glTF.

- **Falls back to the 2D placeholder** when WebGL isn't available or the context is lost, and on foot, which has no 3D scene yet. A `scene` snippet passed to `Viewport` still replaces both.
- **Renders only when it's seen**: it pauses while the tab is hidden, the viewport is scrolled away, or a drawer, dialog or the full editor covers it, and disposes everything when it unmounts. The pixel ratio is capped at 1.5.
- **Reduced motion**: no camera shake, fewer and shorter dust streaks, and fewer, gentler wheel dust puffs.
- **Analog axes**: a bound pitch, roll or yaw axis on a paired controller flies the ship directly, and a bound steering or drive speed axis drives the SRV; the digital binds still work. While the rebind card is listening, or a drawer is open, the axes are ignored, as every other input is, and the SRV holds still.
- **Toggle camera** switches between the chase camera and the pilot's seat (the driver's seat in the SRV). It is an Orbital Preflight action, not an Elite one: it's listed under Panels in Ship and in SRV, bound to K by default and rebindable, but never written to an export. The view is shared by both modes. The viewport's camera button does the same.
- **The SRV's turret** pops up out of the deck in turret mode and aims at the reticle, which the viewport draws over the 3D scene as the SRV placeholder does. It isn't on the v0.4 board yet; it follows the placeholder's turret.
- **The SRV's moon** is a stand-in until a terrain is designed: seeded rolling ground, mounds, craters, rock-slab ramps and rocks (`scene/terrain.ts`). The drive model is kinematic, with no physics engine (`scene/drive.ts`).
- **Frame time**: the canvas carries `data-op-frame-ms`, the rolling average CPU time per frame (update and render submit). In `pnpm dev`, `?op-orbit=135` swings the chase camera around the ship to look at it from another side.

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
- **Stick axis signs** for the 3D scene: stick forward reads negative (nose down), right is positive for roll, yaw and SRV steering, and the file's `Inverted` flag isn't applied.
- **SRV drive speed axis**: read as a forward-only lever like the ship's throttle (full forward −1 is full speed, pulled back is stopped). Elite can also run it full range, with the back half as reverse; that setting isn't in the binds file.
- **K for Toggle camera**, in Ship and in SRV: free in the shipped presets; not checked against Elite's own default binds.

## Licence

MIT, see [LICENSE](./LICENSE). The fonts that come with the theme package are under the SIL Open Font License 1.1.
