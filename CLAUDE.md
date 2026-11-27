# Orbital Preflight

A static, desktop-only SvelteKit app: load a space-sim binds file, test every bind against a mock flight with real controllers, rebind, and export a new preset. It is also a framework that pilots fork onto GitHub Pages. Phil's instance runs as "Preflight" at preflight.orbitalcontrols.com.

## Neighbours

- `../orbital-controls` (the main site, private) is **read-only reference**. Read its CLAUDE.md, docs/AGENTS.md and packages/theme/README.md for conventions; never edit it and never import from it by relative path. Forks don't have it, so this repo must build on its own.
- The approved design is the Orbital Controls Master canvas, page "Preflight" (`Stand*.dc.html` boards); for switching games, the "Orbital Controls — Preflight" canvas's Main, BindEditor and StandBar boards win (G1 Manifest and G2 Bay select were chosen, G3 game tabs rejected). Board copy is final except text in [square brackets], which is placeholder data. Claude Code sessions with the Artifact tool can read the canvas directly: list its files (`project/Stand*.dc.html`) and its assets (the boards' renders are `/_blob/<id>` assets, read by id). Otherwise Phil supplies an export, unpacked into `design/`. Never commit board sources or renders (gitignored: the repo is public, the boards aren't). `design/src/Stand*.html` are the readable board sources. StandDrive, StandOnFoot, StandRebind* and StandUnbound are StandFly in another `preview` state.
- Deliberate departures from board copy: the crew (PATAPSCO, "Patty") is left out because forks aren't Orbital Controls and the site keeps the crew off product pages; there is no "Fly with the defaults" button: a sim that ships its game's defaults (`SimAdapter.defaults`, Star Citizen and X4 today) opens on them when it has no pilot's preset, and the others ask for a file; the deck's "Mockup only" note is rewritten for the live deck. Nothing appears that no bind can drive: Pad 7's Lean, Helmet, Fire mode, Wrist menu and on-foot Recall ship prompts are left out because Elite has no such bind (`prompts.spec.ts` checks every prompt against the catalogue); a status chip or HUD readout no action in the loaded file drives doesn't show. Only panels say they "would open"; an action with no effect of its own shows only in the last-input toast, where the board said it would open too.

## Naming

On Phil's instance the feature is "Preflight"; the framework is "Orbital Preflight". Tailwind's base reset is also called Preflight, so in code, config, CSS and file names **never use a bare `preflight`**: `orbital-preflight` for folders, modules and the package; an `op-` prefix for CSS variables and classes. In comments and docs write "Tailwind's base reset" when you mean Tailwind's.

## Theme

- The look comes from `@orbital-controls/theme` (npm): `@import 'tailwindcss'` then `@import '@orbital-controls/theme'` in `src/routes/layout.css`. Never copy or recreate its tokens, utilities or fonts. Its CSS variable names (`--color-trail`, `--font-display`…) are the public API; don't invent parallel ones.
- It is installed from npm (`^0.1.0`), never linked from `../orbital-controls`: forks don't have that checkout. To try an unreleased theme change, publish it first. `pnpm-workspace.yaml` exempts it from pnpm's one-day hold on new releases.
- Config `theme` overrides are those same variables, applied after the import.

## Stack and rules

- SvelteKit + Svelte 5 runes (shared state in `.svelte.ts`), TypeScript strict, Tailwind v4, pnpm, Vitest, Playwright, Prettier, ESLint. This repo uses pnpm and Svelte by design, whatever a global default says.
- **Static only.** `adapter-static`, everything prerendered, everything interactive on the client. No runtime server code (`src/hooks.server.ts` only runs while prerendering) and no runtime network calls, except opt-in analytics: Google Analytics (behind consent) and Umami, off unless the build's environment sets their IDs (repository variables in the Pages workflow, never committed), and never sent anything about a visitor's binds. Files are read with FileReader; nothing is uploaded.
- **Base path.** `BASE_PATH` feeds `paths.base`. Every link and asset goes through `resolve()` / `asset()` from `$app/paths` (SvelteKit 3 has no `base` export).
- **Config.** `orbital-preflight.config.ts` is the only file a fork edits. `ORBITAL_PREFLIGHT_CONFIG` swaps in another (Phil's instance lives in `instances/orbitalcontrols/`; the Pages workflow reads it from a repository variable of the same name). Document every new field in the README.
- **Sessions.** Each game loaded this visit is a `Session` in `sessions.svelte.ts` (file, original and edited binds, mode, controller pairing); `app.games.currentSim` picks one, and `app.store` / `app.mode` are the current game's, so components read the current game without knowing about the others. Switching never discards a session; only the mock flight starts over. Sims are `ready` (parser and writer checked against real files) or `later` (listed as "Coming later") in `sims/index.ts`. A sim's own words for the HUD, toasts and mode tabs go in its adapter's `words` (Star Citizen says Decoupled and Vehicle). Star Citizen's catalogue is generated from the game's defaultProfile.xml by `scripts/sc-catalogue.ts`; never edit `sims/star-citizen/defaults.ts` by hand. The defaults it was built from are checked in as `data/star-citizen/defaultProfile.xml` (with `build_manifest.json`); replace them together after a patch, and leave `data/` byte for byte as the game ships it. X4's catalogue is generated from the game's controls menu and English text by `scripts/x4-catalogue.ts` into `sims/x4/controls.ts` (never edit by hand); its defaults are `data/x4/inputmap.xml`, which the adapter reads as it ships. The script's `IDS` table (menu number → control name) is hand-made: check it after a patch that adds controls.
- **Logic stays pure.** Parsers, writers, bind resolution and the mock flight are plain TS modules under `src/lib/orbital-preflight/` with Vitest specs beside them. The writer splices into the original file text; never rebuild a binds file from the model.
- Anything taken from memory rather than a real file or device (binds format details, file paths, browser HOTAS limits) is marked `UNVERIFIED` in code and listed in the README.
- Ask Phil before adding a dependency beyond the stack above.
- Svelte MCP: `.mcp.json` gives Claude Code sessions the official Svelte MCP (`list-sections` → `get-documentation` for Svelte 5 / SvelteKit questions, `svelte-autofixer` on code you write). Without it, `pnpm exec svelte-mcp <command>` runs the same tools. `pnpm check:svelte` runs the autofixer over every component and `.svelte.ts` module: fix every issue, and fix or justify every suggestion (they're heuristics). Keep the `@sveltejs/mcp` versions in `package.json` and `.mcp.json` the same.

## Semantic HTML, accessibility and SEO

- One `<h1>` (visually hidden: "<site name> Preflight"), no skipped heading levels; landmarks (`<header>`, `<main>`, `<nav aria-label>`, `<aside>`); real lists and tables; buttons for actions, links for navigation; `alt` on every image (`alt=""` if decorative).
- Dialogs trap focus, close on Esc and return focus to the opener. Toggles carry `aria-pressed`, tabs `aria-selected`. The last-input toast is `aria-live`. Focus rings are gold (`--color-trail`). `prefers-reduced-motion` stops the pulses.
- The head: a specific title and description from config, canonical and Open Graph when `siteUrl` is set.

## Copy

Follow the Orbital Controls voice where it applies (see ../orbital-controls/docs/AGENTS.md "Voice and copy"): plain sentence case for buttons and body, the terminal register (uppercase) for status chips and eyebrows, no exclamation marks, no AI-sounding filler, no disabled placeholder controls.

## Checks

Run before every commit: `pnpm check`, `pnpm check:svelte`, `pnpm lint`, `pnpm check:fallow`, `pnpm test:unit --run`, `pnpm build`. `pnpm check:fallow` is [fallow](https://fallow.tools)'s dead-code pass (unused files, exports, members and dependencies; `.fallowrc.json` says why each exception is there). `pnpm exec fallow` adds duplication and complexity reports, which don't gate. `pnpm test:e2e` builds five variants (root, non-root base, theme override, multi-game with Elite and Star Citizen presets, analytics on) and runs the Playwright smoke tests against them.

## Git

Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`). Work on a branch, open a PR, don't merge.
