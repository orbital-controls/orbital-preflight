# Orbital Preflight

A static, desktop-only SvelteKit app: load a space-sim binds file, test every bind against a mock flight with real controllers, rebind, and export a new preset. It is also a framework that pilots fork onto GitHub Pages. Phil's instance runs as "Preflight" at preflight.orbitalcontrols.com.

## Neighbours

- `../orbital-controls` (the main site, private) is **read-only reference**. Read its CLAUDE.md, docs/AGENTS.md and packages/theme/README.md for conventions; never edit it and never import from it by relative path. Forks don't have it, so this repo must build on its own.
- The approved design is the Orbital Controls Master canvas, page "Preflight" (`Stand*.dc.html` boards). Board copy is final except text in [square brackets], which is placeholder data. Claude Code sessions with the Artifact tool can read the canvas directly: list its files (`project/Stand*.dc.html`) and its assets (the boards' renders are `/_blob/<id>` assets, read by id). Otherwise Phil supplies an export, unpacked into `design/`. Never commit board sources or renders (gitignored: the repo is public, the boards aren't). `design/src/Stand*.html` are the readable board sources. StandDrive, StandOnFoot, StandRebind* and StandUnbound are StandFly in another `preview` state.
- Deliberate departures from board copy: the crew (PATAPSCO, "Patty") is left out because forks aren't Orbital Controls and the site keeps the crew off product pages; "Fly with the defaults" is left out until real default files ship; the deck's "Mockup only" note is rewritten for the live deck.

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

Run before every commit: `pnpm check`, `pnpm check:svelte`, `pnpm lint`, `pnpm test:unit --run`, `pnpm build`. `pnpm test:e2e` builds four variants (root, non-root base, theme override, analytics on) and runs the Playwright smoke tests against them.

## Git

Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`). Work on a branch, open a PR, don't merge.
