# Orbital Preflight

Load the keybinds file from your space sim, connect your controllers, test every bind against a mock flight, rebind anything and export a new preset. It runs entirely in the browser tab: files are read with `FileReader`, nothing is uploaded, and there is no account. Analytics are off unless the deploy turns them on (see [Analytics](#analytics)), and never see your binds.

It's also a framework. Fork this repo onto GitHub Pages to show off your own binds: visitors test them with their own stick and keyboard, and download them as they are or after changing them.

Elite Dangerous `.binds` files, Star Citizen layouts (`layout_…_exported.xml`) and X4: Foundations `inputmap.xml` files work today. DCS is listed as coming later.

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

- **One game with binds**: presets for one sim (the old single-sim shape too: `sim` plus `presets` with no `sim` of their own), and no other game with binds. A first visit skips the game picker and opens with the first preset loaded; the top bar reads "Pilot's binds · ‹label›". Star Citizen and X4 always have binds (their games' defaults), so while both are listed this doesn't happen: there are always at least two games with binds, and a first visit is the bay.
- **Two or more games with binds**: a first visit shows the bay, one tile per game. Games with presets read "Pilot's binds · ‹label›" and picking one loads its first preset; Star Citizen with no preset reads "Star Citizen 4.10.2 defaults" and opens on them, and X4 reads "X4 9.00 defaults". With Elite presets alone, that's the bay with Elite, Star Citizen and X4. A sim that isn't supported yet shows as "Coming later" and can't be picked.
- **No presets**: the bay; Elite asks for the visitor's own file, and Star Citizen and X4 open on their games' defaults.
- **No game is remembered between visits**: the app doesn't keep which game or binds were open, so every visit starts from this routing.

```ts
presets: [
	{ file: 'hotas.binds', label: 'My HOTAS setup' }, // the config's `sim`
	{ file: 'layout_vex_exported.xml', label: 'My SC layout', sim: 'star-citizen' }
];
```

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

| Event          | When                                                                | Data                                               |
| -------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| page view      | each navigation                                                     | URL and title                                      |
| `binds_load`   | a binds file opens for a game                                       | `source` (`preset`, `defaults` or `upload`), `sim` |
| `binds_export` | a game's rebound preset is downloaded, once per game for Export all | `sim`, `changes` (binds changed)                   |

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

Node 26 and pnpm, at the versions in `.tool-versions` (mise and asdf read it).

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

| Path                                           | What                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| `orbital-preflight.config.ts`                  | The fork's config.                                                                |
| `src/lib/orbital-preflight/sims/`              | The sim registry and adapters: parse and write. `elite/`, `star-citizen/`, `x4/`. |
| `src/lib/orbital-preflight/sessions.svelte.ts` | One session per game loaded this visit, and which is current.                     |
| `src/lib/orbital-preflight/xml.ts`             | An XML scanner that keeps offsets, so the writer splices instead of rebuilding.   |
| `src/lib/orbital-preflight/bindings.ts`        | Clashes, Move / Swap / Keep both, filter counts. Pure.                            |
| `src/lib/orbital-preflight/binds.svelte.ts`    | The bind store: the file, the edits, undo per action, reset per mode, export.     |
| `src/lib/orbital-preflight/flight.ts`          | The mock flight state machine and the HUD values. Pure.                           |
| `src/lib/orbital-preflight/galaxy.ts`          | The galaxy map: the systems, its camera, the route plotter and jumps. Pure.       |
| `src/lib/orbital-preflight/system.ts`          | The system map: each system's bodies, Map and Orrery views, targets. Pure.        |
| `src/lib/orbital-preflight/inputs/`            | Keyboard, mouse and Gamepad API input, and controller pairing.                    |
| `src/lib/orbital-preflight/scene/`             | The 3D viewport: pure flight → part mappings, and the three.js engine.            |
| `src/lib/orbital-preflight/analytics/`         | Optional Google Analytics and Umami: head tags, consent, events.                  |
| `src/lib/components/`                          | One component per UI piece.                                                       |

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

### The galaxy map

In Elite, Galaxy map (in Ship, SRV and On foot) opens a small working galaxy map over the viewport, rather than saying it would open (`galaxy.ts`, `GalaxyMap.svelte`). It is Elite's map at a much smaller scale: a pocket of 40 made-up systems some 70 light years across, plus one out past every jump.

- **Its own binds**: while it's open the game reads the map's binds, not flight's, so W moves the map rather than pitching the ship. Held map pitch, yaw, translate (forward and back, sideways, up and down, and Translate Z hold turning forward and back into up and down) and zoom binds, and their axes, steer a camera that orbits the cursor over the galactic plane; Map home puts the cursor back on the ship's system. Menu select picks the system under the cursor, and again plots a route to it; Menu back, Esc or Galaxy map again closes it. The legend lists only the map controls the file binds.
- **The mouse** works it as in the game: drag to turn, right-drag or Shift-drag to move, the wheel to zoom, click a system to select it. The map sits outside the viewport's mouse zone, so a click on it is never a mouse bind.
- **What it shows**: stars coloured by class with drop lines to the plane, the plane's 10 ly grid, the 14 ly jump range ring round the ship, the system under the cursor or selected (distance, star class, fuel scoopable or not, economy, population), and the plotted route with its jumps and light years. The route takes the fewest jumps within range, then the shortest distance, as the game's fastest route does; Thule is out of range, so it says "Route unavailable".
- **From the cockpit**: plotting targets the route's first system, and the ship HUD shows it. Frame shift drive then charges and jumps there, and on arrival the next system in the route is targeted; Target next system in route targets it again. With nothing targeted the drive says "FSD charging · mass locked", as on the board.
- The demo preset (and `hotas.binds`) binds the map's camera, Map home, Menu select (Space) and Menu back (Backspace) on the keyboard so the map can be flown out of the box.

### The system map

In Elite, System map (in Ship, SRV and On foot) opens the system the ship is in over the viewport (`system.ts`, `SystemMap.svelte`), as the game's system map does. Each of the pocket's 40 systems has its own bodies, made up but the same every visit: the star, 3 to 7 planets whose type follows how hot they run (metal-rich close in, Earth-like and water worlds in the warm band, icy bodies and class I to V gas giants farther out), moons, sometimes an asteroid belt, a nav beacon, and in inhabited systems one to three stations (Coriolis, Orbis, Ocellus, outposts, planetary ports).

- **Two views, as in the game.** Map mode is flat: the star on the left, what orbits it in a row to the right by distance, and what orbits each of those hanging below it, each joined to what it orbits by a straight line; it shows what orbits what and how far out, not where things are. Orrery mode puts every body on its orbit round the star (on a log scale, so the outer planets fit) with orbit lines, on a camera that orbits as the galaxy map's does. The Map and Orrery buttons switch between them (the game has no bind for it).
- **The galaxy map's binds**, as the game has no separate ones: in Map mode, forward and back (and up and down) move the view up and down the screen, left and right move it sideways, zoom zooms, and pitch and yaw do nothing; in Orrery mode they work as on the galaxy map. Map home goes back to the ship. Menu select picks the body under the cursor, and again targets it; Menu back, Esc or System map again closes it. Galaxy map on the system map goes straight to the galaxy map, and System map on the galaxy map comes back.
- **The mouse**: in Map mode drag to move; in Orrery mode drag to turn and right-drag or Shift-drag to move; the wheel zooms and a click selects, in both.
- **What it shows**: bodies coloured by type, landable ones with a light blue arc on their left side, as the game marks them; distance from the arrival point over each body in the row; and for the body under the cursor or selected, the game's details: for a planet or moon its type, distance, gravity, surface temperature, atmosphere, landable or not, orbital period and radius; for a star its class, temperature and whether it can be scooped; for a station its type, what it orbits, largest pad and economy.
- **From the cockpit**: a targeted body shows in the ship HUD as the destination with its distance in light seconds. In supercruise with the throttle up the ship closes on it, faster the farther it is; within 1 ls the HUD says to drop, and dropping out of supercruise there puts the ship at the body. A jump to another system starts over at its star with nothing targeted.

### Star Citizen

A Star Citizen layout holds only what the pilot changed from the game's defaults: one `<rebind input="js1_button3"/>` per device per action, with `js1_ ` (a space) clearing a default. So the adapter (`sims/star-citizen/`) reads the game's own defaults first and lays the layout over them.

- **The defaults** are the game's own `Data\Libs\Config\defaultProfile.xml`, checked in as `data/star-citizen/defaultProfile.xml` with the `build_manifest.json` that names its build (4.10.2 LIVE today; a copy found online, not unpacked here). `sims/star-citizen/defaults.ts` is generated from it and the English `global.ini` by `node scripts/sc-catalogue.ts <defaultProfile.xml> <global.ini> <version>`, keeping the action maps and actions the keybinding screen lists, with their English names. After a patch, replace both data files and run it again.
- **Opens on the defaults**: picking Star Citizen with no pilot's preset loads the game's own defaults (a layout that changes nothing) straight away, labelled "Star Citizen 4.10.2 defaults"; load a layout over them from Load binds. A preset, where the config has one, wins. Elite still asks for a file: its defaults aren't in hand.
- **Ids** are `‹actionmap›.‹action›` (`spaceship_movement.v_yaw`), because the game reuses action names across maps.
- **Modes**: ship (flight, weapons, targeting, power, mining, salvage, turrets…), Vehicle (ground vehicles; the tab Elite calls SRV) and on foot (with EVA, interaction and emotes).
- **Slots**: an action's first two devices with a bind, keyboard and mouse first, then joysticks and the gamepad (controllers first on an axis action). A third device's bind stays in the file untouched. A rebind can't put two binds on one device, Star Citizen takes only Shift, Ctrl and Alt (or a gamepad shoulder) as modifiers, and it binds whole axes only.
- **Clashes**: maps the game reads only in their own operator mode or seat (guns, missiles, quantum, mining, salvage, scanning, turrets, tractor beam, EVA, interaction, the camera) don't clash with flight, and neither do a tap, a long press and a double tap on one key. Actions the game's own defaults put on one input (Space jumps, fires the jump thrusters and climbs ledges) don't clash with each other (`Action.shares`), only with anything else put there. The defaults load with no clashes.
- **Words**: the HUD and toasts say Star Citizen's terms where it has its own (Decoupled for FA off, SCM for hardpoints, SHD for SYS); status chips and readouts that no Star Citizen action drives (silent running, the SRV turret, drive assist, recall) don't show.
- **Controllers**: devices come from the layout's `<options type="joystick">` lines, with USB ids from their DirectInput guid. The first joystick and the gamepad the defaults bind to are always listed, so they can be paired even with a keyboard-only layout. A controller the layout doesn't name gets the next joystick instance and an `<options>` line on export.

### X4: Foundations

A pilot's binds are `Documents\Egosoft\X4\‹player id›\inputmap.xml`, which the game writes whenever controls change. Unlike a Star Citizen layout it holds every bind, one element per input: `<state id="INPUT_STATE_BOOST" source="INPUT_SOURCE_KEYBOARD" code="INPUT_KEYCODE_TAB"/>`. The adapter is `sims/x4/`.

- **The defaults** are the game's own "Keyboard and Mouse" profile, `libraries/inputmap.xml`, checked in as `data/x4/inputmap.xml` (9.00, from a copy found online, not unpacked here) with its WASD variant beside it. The app reads the file itself, as it ships: picking X4 with no pilot's preset opens on it, labelled "X4 9.00 defaults". Entries the game marks `removed="true"` (a bind a later version took away) aren't binds. After a patch, replace both files.
- **The catalogue** is every row of the game's Controls screen a pilot can rebind, under the game's own section names, generated into `sims/x4/controls.ts` by `node scripts/x4-catalogue.ts <gameoptions.lua> <0001-l044.xml> <version>` from the controls menu script and the English text (neither committed; they live in the gitignored `design/x4/`). Sections the menu won't let a pilot change (menu and dialog navigation) are left out. The menu names controls by number and binds files by name; the script's `IDS` table pairs them (see Unverified).
- **Rows that rebind several controls**: some rows set the same input on more than one control ("Map" opens the map and closes it again; "Menu back" is three). The row is one action, named after its first control; the writer gives every control in it the same change.
- **Ids** are the file's own control names (`INPUT_ACTION_OPEN_MAP`, `INPUT_STATE_BOOST`, `INPUT_RANGE_THROTTLE`). Ranges are the axis actions.
- **Modes**: Ship (the Space and Menus tabs) and First person. X4 has no ground vehicles, so there's no SRV tab, and Orbital Preflight's own Toggle camera is only added to the modes a game has.
- **Slots**: a control's first two physical inputs, keyboard and mouse first, then controllers by slot (controllers first on a range). Radial menu entries and any third input stay in the file untouched. Keys and mouse buttons take Shift and Ctrl as modifiers, the wheel Shift; X4 sets its two controller modifiers in game, not in the file. Axis halves (`sgn`) are fine.
- **Controllers**: the file names eight controller slots (`INPUT_SOURCE_JOYBUTTONS` to `…_8`), not devices, so they pair by press. A slot whose every input is a gamepad control (the Xbox names, the D-pad, the sticks and triggers) reads as a gamepad; any other as a stick, with the Xbox names as buttons 1 to 10 and the D-pad as its hat. A new controller goes in the next free slot; which physical controller X4 puts there is set in game.
- **Clashes** follow the game's own check: two rows clash when they're in the same tab and share one of the menu's contexts. Rows in the main context all share it; camera-only and map-only rows get their own, and the Menus tab never clashes with flight. Both shipped profiles load with no clashes.
- **Words**: Travel mode stands in for supercruise and countermeasures for chaff. X4 deploys no hardpoints, so its guns fire whenever they're bound; the heat bar and the on-foot sidearm readout don't show, since no X4 bind drives them.

### Exports

Export ‹ABBR› preset (Export ED preset) writes a new file for the current game, covering all its modes: the original text with the changed slots and the preset name replaced, and every other byte left as it was. The file you loaded is never modified. The new preset is named "‹original name› rebound". Elite's file is "‹name›.‹major›.‹minor›.binds"; Star Citizen's is `layout_‹name›_exported.xml`, as the game names its own exports, with `profileName` and the header's `label` set to the new name. X4's is always `inputmap.xml`, the name the game reads; a pilot's file has no preset name, so only a saved profile's `name` changes. Leave's "Export all N games, then leave" writes one such file per game with changes, a moment apart; browsers may ask before allowing several downloads from one page.

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
- **The galaxy map**: that the cursor snaps to the nearest system, that a second Menu select plots a route, map axis signs (stick forward moves the map forward), Translate Z hold, and the demo preset's map keys, all from memory of the game.
- **The system map**: that it reads the galaxy map's camera binds, with forward and back moving Map mode up and down, is from forum posts, not a file. From memory of the game: body naming ("Halden 2 a", "Halden A Belt"), the details panel's fields, that a second Menu select targets a body, that Map home goes back to the ship, Galaxy map and System map switching straight between the two maps, and how supercruise closes on a target. The fan wiki and Frontier forums couldn't be fetched while this was built, so none of it is checked against a current game.
- **K for Toggle camera**, in Ship and in SRV: free in the shipped presets; not checked against Elite's own default binds.
- **Star Citizen**: the layout format is checked against layouts exported by the game (4.3 and later), and the defaults come from 4.10.2's `defaultProfile.xml` (a copy found online, not unpacked here). Still open: key names no file in hand uses (F13+, Print, Scroll lock, numpad Enter), the gamepad stick directions (`thumbl_up`…), which browser buttons the game calls `mouse4` and `mouse5`, which action maps the game reads apart (the clash contexts above), that a press and a tap on one key really do clash, whether the game accepts a new `<options>` line with a generic "Joystick" name, and the "Where's my file?" menu path. `star-citizen.xml` and the demo layout are **synthetic**.
- **X4**: the format is checked against the profiles the game ships (9.00) and game-written `inputmap.xml` files found online, not one of Phil's. Still open: the `IDS` table in `scripts/x4-catalogue.ts`, worked out by lining up a game-written file (which lists controls in the game's number order) against the menu's numbered names, with the menu script's own comments as anchors; Next and Previous surface element (213, 214) follow their labels, though the game-written file has them the other way round. Also: key names no file uses, which stick button numbers the Xbox names stand for (A is 1 up to Right thumb 10, Big button 11), which way the wheel's `sgn="1"` turns, that the gamepad's Z and RZ axes are its left and right triggers, telling a gamepad slot from a stick by its inputs alone, whether the game accepts an export made from the shipped profile with its upgrade notes (`sinceversion`, `removed`) left in, and the "Where's my file?" path. `x4.xml` is **synthetic**.
- **On-foot axis signs**: `HumanoidForwardAxis`, `HumanoidStrafeAxis`, `HumanoidRotateAxis` and `HumanoidPitchAxis` are taken as the browser reports them (stick forward negative walks forward and looks up). Pad 7 only prompts for binds an Elite action can answer on foot (a spec checks it): the exported file has no lean, helmet, fire mode, wrist menu or on-foot recall bind, so those prompts and the walker's lean are gone. Scan is the profile analyser (`HumanoidSwitchToCompAnalyser`) and Ping is `HumanoidPing`; Look is the mouse, as the file's `MouseHumanoidXMode` setting has it.

## Licence

MIT, see [LICENSE](./LICENSE). The fonts that come with the theme package are under the SIL Open Font License 1.1.
