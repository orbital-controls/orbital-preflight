# Orbital Preflight

Load the keybinds file from your space sim, connect your controllers, test every bind against a mock flight, rebind anything and export a new preset. It runs entirely in the browser tab: files are read with `FileReader`, nothing is uploaded, and there is no account and no analytics.

It's also a framework. Fork this repo onto GitHub Pages to show off your own binds: visitors test them with their own stick and keyboard, and download them as they are or after changing them.

Elite Dangerous `.binds` files and Star Citizen layouts (`layout_…_exported.xml`) work today. X4 and DCS are listed as coming later.

A visitor can load binds for more than one game in the same tab and switch between them from "Binding for" in the top bar: each game keeps its own file, edits, mode and controller pairing while the tab is open. Export is per game; Leave counts unsaved changes across all of them.

Desktop only: below 1280 px wide the page shows a short notice, with your presets still downloadable from it.

## Fork it

1. **Fork** this repository on GitHub.
2. **Edit `orbital-preflight.config.ts`** at the repo root: your title, description, name, where Leave goes, and your presets. It's the only file you need to change.
3. **Drop your `.binds` files into `static/binds/`** and list them under `presets`. In Elite Dangerous they live in `%LOCALAPPDATA%\Frontier Developments\Elite Dangerous\Options\Bindings\`. Presets can be for more than one game: give each the `sim` it's for (see below).
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

| Field         | Required | What it does                                                                                                                                                                                                                                                        |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`       | yes      | The page title, in the head and on the share card. Name what people search for.                                                                                                                                                                                     |
| `description` | yes      | One plain sentence for the meta description and the share card.                                                                                                                                                                                                     |
| `siteName`    | yes      | You or your site. Used in the hidden page heading ("‹siteName› Preflight"), the share card and "Back to ‹siteName›".                                                                                                                                                |
| `siteUrl`     | no       | The absolute URL the app is served from. With it, the head gets a canonical link and Open Graph `og:url` and `og:image` tags.                                                                                                                                       |
| `homeUrl`     | yes      | Where Leave goes: your page or your GitHub profile. Leave asks first if there are unsaved changes.                                                                                                                                                                  |
| `sim`         | no       | The sim your presets are for, unless a preset names its own. Default `'elite-dangerous'`, the only one that loads today.                                                                                                                                            |
| `presets`     | no       | Binds files in `static/binds/`, each with a `label` and optionally the `sim` it's for. What a first visit shows depends on them (below). Visitors can still load their own file, and download each preset for the current game as it is from the Load binds drawer. |
| `brand`       | no       | The top bar's `wordmark` (default "Preflight") and `mark`, an inline SVG string drawn at 28 px (default: the Orbital Controls mark; `false` for the wordmark alone). Also an optional heavier `markSmall` for the favicon, and an accessible `label`.               |
| `theme`       | no       | CSS variable overrides, applied after the theme package. Use the package's own names (`--color-trail`, `--color-course`, `--font-display`…); its README lists them.                                                                                                 |
| `poweredBy`   | no       | A small "Powered by Orbital Preflight" link in the drawers and the desktop-only notice. On unless set to `false`.                                                                                                                                                   |

#### Presets and the first visit

- **Presets for one sim** (the usual fork, and the old single-sim shape: `sim` plus `presets` with no `sim` of their own): a first visit skips the game picker and opens with the first preset loaded; the top bar reads "Pilot's binds · ‹label›".
- **Presets for several sims**: a first visit shows the bay, one tile per game, and the games you have presets for read "Pilot's binds · ‹label›". Picking one loads its first preset. A sim that isn't supported yet shows as "Coming later" and can't be picked, preset or not.
- **No presets**: the bay, and each game asks for the visitor's own file.
- **"Remember this layout on this browser"** is kept per game. Remembered games come back on the next visit, the one used last is current, and the bay is skipped.

```ts
presets: [
	{ file: 'hotas.binds', label: 'My HOTAS setup' }, // the config's `sim`
	{ file: 'layout_vex_exported.xml', label: 'My SC layout', sim: 'star-citizen' }
];
```

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

The build output is plain static files, so any static host works too.

## Develop

Node 24 and pnpm.

```sh
pnpm install
pnpm dev            # http://localhost:5173
pnpm check          # svelte-check and TypeScript
pnpm check:svelte   # the Svelte team's autofixer over every component
pnpm lint           # Prettier and ESLint
pnpm check:fallow   # fallow: unused files, exports, class members and dependencies
pnpm test:unit      # Vitest
pnpm test:e2e       # builds root, base-path, theme and multi-game variants, then Playwright
pnpm build          # static output in build/
```

`pnpm test:e2e` uses Playwright's Chromium (`pnpm exec playwright install chromium`). To use a Chromium you already have, set `PW_CHROMIUM_PATH`.

The multi-game variant (`tests/fixtures/multi.config.ts`) has presets for Elite Dangerous and Star Citizen (`static/binds/demo-star-citizen.xml`).

### Where things are

| Path                                           | What                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| `orbital-preflight.config.ts`                  | The fork's config.                                                              |
| `src/lib/orbital-preflight/sims/`              | The sim registry and adapters: parse and write. `elite/`, `star-citizen/`.      |
| `src/lib/orbital-preflight/sessions.svelte.ts` | One session per game loaded this visit, and which is current.                   |
| `src/lib/orbital-preflight/xml.ts`             | An XML scanner that keeps offsets, so the writer splices instead of rebuilding. |
| `src/lib/orbital-preflight/bindings.ts`        | Clashes, Move / Swap / Keep both, filter counts. Pure.                          |
| `src/lib/orbital-preflight/binds.svelte.ts`    | The bind store: the file, the edits, undo per action, reset per mode, export.   |
| `src/lib/orbital-preflight/flight.ts`          | The mock flight state machine and the HUD values. Pure.                         |
| `src/lib/orbital-preflight/inputs/`            | Keyboard, mouse and Gamepad API input, and controller pairing.                  |
| `src/lib/orbital-preflight/scene/`             | The 3D viewport: pure flight → part mappings, and the three.js engine.          |
| `src/lib/components/`                          | One component per UI piece.                                                     |

### The 3D scene

All three views are real-time three.js scenes: the Lantern II flying in space, the Wick LR driving on a moon, and a first-person walk round Pad 7 on foot, all driven by the same mock flight state the HUD reads. `Viewport.svelte` mounts `Scene3D.svelte`, which loads the engine (`scene/three/`) with a dynamic import, so three.js is a separate chunk fetched only when the viewport mounts. The scene reads `SceneProps` (`{ flight, mode }`) plus the bound stick axes and, on foot, the held binds, once a frame, renders, and reports back only whether WebGL came up and which on-foot stop the pilot is in. It never writes the flight state; the one input it handles itself is mouse look on foot. Switching mode swaps scenes at once: the engine builds the new mode's scene and disposes the last one, so only one mode's geometry, textures and shaders are ever on the GPU. Where the driver compiles shaders in the background (`KHR_parallel_shader_compile`), the new scene draws once its shaders are ready rather than stalling the page; until then the canvas keeps its last frame. See [`scene/README.md`](./src/lib/orbital-preflight/scene/README.md) for the part contracts and how to swap in a glTF.

- **Falls back to the 2D placeholder** when WebGL isn't available or the context is lost. A `scene` snippet passed to `Viewport` still replaces both.
- **Renders only when it's seen**: it pauses while the tab is hidden, the viewport is scrolled away, or a drawer, dialog or the full editor covers it, and disposes everything when it unmounts. Unseen for 30 seconds (a hidden tab, scrolled away; not a drawer), it also disposes the mode's scene, keeping only the renderer, and builds it again on return, so the on-foot pilot starts over at the spawn. The pixel ratio is capped at 1.5, and adapts: while frames come slower than 25 a second the engine steps it down (to 0.5 at the lowest), and back up while they come faster than 50 (`scene/resolution.ts`). A machine with a GPU stays at the cap; software WebGL renders softer but keeps the page's 50 ms mock-flight tick running. The canvas carries the current ratio as `data-op-pixel-ratio`.
- **Reduced motion**: no camera shake, fewer and shorter dust streaks, and fewer, gentler wheel dust puffs. On foot: no weapon or head bob, and softer muzzle and target flashes.
- **Gamepads**: a controller the browser maps to the standard (Xbox-style) layout reads by Elite's gamepad control names (`GamePad_FaceDown`, `Pos_GamePad_RTrigger`, `GamePad_LStickX`…), so a file's gamepad binds fire, rebind and export like any other. It shows as "Gamepad" (A, B, X, Y, LB, RB, LT, RT, the D-pad, LS, RS, Back, Start), and pressing a button with the Controllers drawer open pairs it with the file's gamepad rather than a stick. Its sticks and triggers count as axes.
- **Analog axes**: a bound pitch, roll or yaw axis on a paired controller flies the ship directly, a bound steering or drive speed axis drives the SRV, and bound move and look axes walk and look on foot; the digital binds still work. While the rebind card is listening, or a drawer is open, the axes are ignored, as every other input is, and the SRV holds still.
- **Toggle camera** switches between the chase camera and the pilot's seat (the driver's seat in the SRV). It is an Orbital Preflight action, not an Elite one: it's listed under Panels in Ship and in SRV, bound to K by default and rebindable, but never written to an export. The view is shared by both modes. The viewport's camera button does the same.
- **The SRV's turret** pops up out of the deck in turret mode and aims at the reticle, which the viewport draws over the 3D scene as the SRV placeholder does. It isn't on the v0.4 board yet; it follows the placeholder's turret.
- **The SRV's moon** is a stand-in until a terrain is designed: seeded rolling ground, mounds, craters, rock-slab ramps and rocks (`scene/terrain.ts`). The drive model is kinematic, with no physics engine (`scene/drive.ts`).
- **On foot** is Pad 7 Compact: a one-level hangar with Lantern II parked on the pad, seven numbered stops, and the Tracer P1 sidearm in the right hand (`scene/pad.ts`, `scene/walker.ts`, `scene/foot.ts`). Held move binds and sprint walk a kinematic first-person walker (no physics engine) that collides with the walls, crates, locker, barrier, console, ship and ramp. A click in the viewport locks the pointer for mouse look; Esc lets go, and so do a drawer, a dialog, the editor and listening for a rebind (which also freezes the pilot). Fire, aim, reload, holster, swap and flashlight drive the viewmodel; the target panel's rings light and count hits. Each stop is a 2 m zone: standing in one shows its prompts in the HUD with your current binds ("Not bound" when nothing is) and marks it visited for the visit. The viewport draws the on-foot crosshair over the scene, as the placeholder does. `?op-spawn=5` starts at stop 5 (or `?op-spawn=x,z,yawDegrees` anywhere); in `pnpm dev`, `?op-overview` views the bay from high in a corner. The Tracer's cartridge holds six, so the mock flight's magazine is 6 (the board's mock had 24 of 30), and the pilot starts with the sidearm drawn.
- **Frame time and GPU memory**: the canvas carries `data-op-frame-ms`, the rolling average CPU time per frame (update and render submit), and `data-op-gpu`, the geometries, textures and shader programs alive (`geometries/textures/programs`). Leaving a mode and coming back should land on the same numbers; an e2e test checks it. In `pnpm dev`, `?op-orbit=135` swings the chase camera around the ship to look at it from another side.

### Star Citizen

A Star Citizen layout holds only what the pilot changed from the game's defaults: one `<rebind input="js1_button3"/>` per device per action, with `js1_ ` (a space) clearing a default. So the adapter (`sims/star-citizen/`) reads the game's own defaults first and lays the layout over them.

- **The defaults** are `sims/star-citizen/defaults.ts`, generated by `node scripts/sc-catalogue.ts <defaultProfile.xml> <global.ini> <version>` from the game's `Data\Libs\Config\defaultProfile.xml` and English `global.ini` (unpacked from `Data.p4k` with unp4k). It keeps the action maps and actions the keybinding screen lists, with their English names. Run it again after a patch. Today's is 4.10.2 LIVE.
- **Fly with the defaults**: with no file handy, the file drop and the Load drawer offer the game's own defaults (a layout that changes nothing). Elite doesn't offer it: its defaults aren't in hand.
- **Ids** are `‹actionmap›.‹action›` (`spaceship_movement.v_yaw`), because the game reuses action names across maps.
- **Modes**: ship (flight, weapons, targeting, power, mining, salvage, turrets…), Vehicle (ground vehicles; the tab Elite calls SRV) and on foot (with EVA, interaction and emotes).
- **Slots**: an action's first two devices with a bind, keyboard and mouse first, then joysticks and the gamepad (controllers first on an axis action). A third device's bind stays in the file untouched. A rebind can't put two binds on one device, Star Citizen takes only Shift, Ctrl and Alt (or a gamepad shoulder) as modifiers, and it binds whole axes only.
- **Clashes**: maps the game reads only in their own operator mode or seat (guns, missiles, quantum, mining, salvage, scanning, turrets, tractor beam, EVA, interaction, the camera) don't clash with flight, and neither do a tap, a long press and a double tap on one key. Actions the game's own defaults put on one input (Space jumps, fires the jump thrusters and climbs ledges) don't clash with each other (`Action.shares`), only with anything else put there. The defaults load with no clashes.
- **Words**: the HUD and toasts say Star Citizen's terms where it has its own (Decoupled for FA off, SCM for hardpoints, SHD for SYS); status chips and readouts that no Star Citizen action drives (silent running, the SRV turret, drive assist, recall) don't show.
- **Controllers**: devices come from the layout's `<options type="joystick">` lines, with USB ids from their DirectInput guid. The first joystick and the gamepad the defaults bind to are always listed, so they can be paired even with a keyboard-only layout. A controller the layout doesn't name gets the next joystick instance and an `<options>` line on export.

### Exports

Export ‹ABBR› preset (Export ED preset) writes a new file for the current game, covering all its modes: the original text with the changed slots and the preset name replaced, and every other byte left as it was. The file you loaded is never modified. The new preset is named "‹original name› rebound". Elite's file is "‹name›.‹major›.‹minor›.binds"; Star Citizen's is `layout_‹name›_exported.xml`, as the game names its own exports, with `profileName` and the header's `label` set to the new name. Leave's "Export all N games, then leave" writes one such file per game with changes, a moment apart; browsers may ask before allowing several downloads from one page.

## Unverified

These were written from memory, not checked against real files or devices, and are marked `UNVERIFIED` in the code. A preset exported by the game (format 4.1, checked by hand and not committed) has since confirmed every action id it holds, which mode each sits in, the `_Buggy` / `Humanoid` / `_Humanoid` naming, the key names it uses (`Key_LeftShift`, `Key_Numpad_7`, `Key_Apostrophe`…), `Joy_POV1Up`, `Pos_`/`Neg_` axis halves, and the `T16000M` / `T16000MTHROTTLE` device names. Still open:

- **The `.binds` format details** that file doesn't show: action ids from other game versions, mouse wheel keys, and DirectInput mouse numbering. `hotas.binds`, `keyboard-only.binds` and the demo preset are **synthetic**.
- **Bind contexts**: which screens Elite reads apart from flight, so the same key there isn't a clash (menus, galaxy map, ship cameras, free camera, FSS, DSS, head look, multicrew, landing overrides, alternate flight controls, store, Holo-Me, Galnet audio, the on-foot wheels). With them, that file showed only the clashes it really has.
- **Readable names** for the actions, and which way the FSS's Increase/Decrease buttons turn.
- **Gamepad controls**: that Elite's `GamePad_*` names line up with the browser's standard layout as `inputs/gamepad.ts` maps them, and the 0..1 range triggers report as axes. The exported file binds its gamepad as `046D0000`, product id `0000`, so it can't be matched by USB id: it pairs by press.
- **Device names and USB ids** used to pair browser controllers with the devices in a file (`T16000M` → `044f:b10a`, and so on).
- **The "Where's my file?" paths** for all four sims.
- **Export file naming** (`‹name›.4.0.binds`) and whether the game accepts any `PresetName`.
- **Browser HOTAS limits**: how many buttons and axes Chrome and Firefox expose for a stick with 32+ buttons, axis order, and how each reports POV hats.
- **Throttle axis direction**: full forward is taken as −1.
- **Stick axis signs** for the 3D scene: stick forward reads negative (nose down), right is positive for roll, yaw and SRV steering, and the file's `Inverted` flag isn't applied.
- **SRV drive speed axis**: read as a forward-only lever like the ship's throttle (full forward −1 is full speed, pulled back is stopped). Elite can also run it full range, with the back half as reverse; that setting isn't in the binds file.
- **K for Toggle camera**, in Ship and in SRV: free in the shipped presets; not checked against Elite's own default binds.
- **Star Citizen**: the layout format is checked against layouts exported by the game (4.3 and later), and the defaults come from 4.10.2's `defaultProfile.xml` (a copy found online, not unpacked here). Still open: key names no file in hand uses (F13+, Print, Scroll lock, numpad Enter), the gamepad stick directions (`thumbl_up`…), which browser buttons the game calls `mouse4` and `mouse5`, which action maps the game reads apart (the clash contexts above), that a press and a tap on one key really do clash, whether the game accepts a new `<options>` line with a generic "Joystick" name, and the "Where's my file?" menu path. `star-citizen.xml` and the demo layout are **synthetic**.
- **On-foot axis signs**: `HumanoidForwardAxis`, `HumanoidStrafeAxis`, `HumanoidRotateAxis` and `HumanoidPitchAxis` are taken as the browser reports them (stick forward negative walks forward and looks up). Pad 7 only prompts for binds an Elite action can answer on foot (a spec checks it): the exported file has no lean, helmet, fire mode, wrist menu or on-foot recall bind, so those prompts and the walker's lean are gone. Scan is the profile analyser (`HumanoidSwitchToCompAnalyser`) and Ping is `HumanoidPing`; Look is the mouse, as the file's `MouseHumanoidXMode` setting has it.

## Licence

MIT, see [LICENSE](./LICENSE). The fonts that come with the theme package are under the SIL Open Font License 1.1.
