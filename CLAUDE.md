# Orbital Preflight

A static, desktop-only SvelteKit app: load a space-sim binds file, test every bind against a mock flight with real controllers, rebind, and export a new preset. It is also a framework that pilots fork onto GitHub Pages. Phil's instance runs as "Preflight" at preflight.orbitalcontrols.com.

## Neighbours

- `../orbital-controls` (the main site, private) is **read-only reference**. Read its CLAUDE.md, docs/AGENTS.md and packages/theme/README.md for conventions; never edit it and never import from it by relative path. Forks don't have it, so this repo must build on its own.
- The approved design is the Orbital Controls Master canvas, page "Preflight" (`Stand*.dc.html` boards). Board copy is final except text in [square brackets], which is placeholder data. Cloud sessions can't open the canvas link; Phil supplies an export, unpacked into `design/` (gitignored: the repo is public, the boards aren't). `design/src/Stand*.html` are the readable board sources. StandDrive, StandOnFoot, StandRebind* and StandUnbound are StandFly in another `preview` state.
- Deliberate departures from board copy: the crew (PATAPSCO, "Patty") is left out because forks aren't Orbital Controls and the site keeps the crew off product pages; "Fly with the defaults" is left out until real default files ship; the deck's "Mockup only" note is rewritten for the live deck.

## Naming

On Phil's instance the feature is "Preflight"; the framework is "Orbital Preflight". Tailwind's base reset is also called Preflight, so in code, config, CSS and file names **never use a bare `preflight`**: `orbital-preflight` for folders, modules and the package; an `op-` prefix for CSS variables and classes. In comments and docs write "Tailwind's base reset" when you mean Tailwind's.

## Theme

- The look comes from `@orbital-controls/theme` (npm): `@import 'tailwindcss'` then `@import '@orbital-controls/theme'` in `src/routes/layout.css`. Never copy or recreate its tokens, utilities or fonts. Its CSS variable names (`--color-trail`, `--font-display`…) are the public API; don't invent parallel ones.
- Until the package is on npm it is linked from `../orbital-controls/packages/theme`. CI swaps the link for the npm range, so CI never needs the sibling checkout. Switch `package.json` to `^0.1.0` once it's published.
- Config `theme` overrides are those same variables, applied after the import.

## Stack and rules

- SvelteKit + Svelte 5 runes (shared state in `.svelte.ts`), TypeScript strict, Tailwind v4, pnpm, Vitest, Playwright, Prettier, ESLint. This repo uses pnpm and Svelte by design, whatever a global default says.
- **Static only.** `adapter-static`, everything prerendered, everything interactive on the client. No server code, no runtime network calls, no analytics. Files are read with FileReader; nothing is uploaded.
- **Base path.** `BASE_PATH` feeds `paths.base`. Every link and asset goes through `resolve()` / `asset()` from `$app/paths` (SvelteKit 3 has no `base` export).
- **Config.** `orbital-preflight.config.ts` is the only file a fork edits. `ORBITAL_PREFLIGHT_CONFIG` swaps in another (Phil's instance lives in `instances/orbitalcontrols/`; the Pages workflow reads it from a repository variable of the same name). Document every new field in the README.
- **Logic stays pure.** Parsers, writers, bind resolution and the mock flight are plain TS modules under `src/lib/orbital-preflight/` with Vitest specs beside them. The writer splices into the original file text; never rebuild a binds file from the model.
- Anything taken from memory rather than a real file or device (binds format details, file paths, browser HOTAS limits) is marked `UNVERIFIED` in code and listed in the README.
- Ask Phil before adding a dependency beyond the stack above.
- Use the Svelte MCP (list-sections → get-documentation, svelte-autofixer on every component) when it's available.

## Semantic HTML, accessibility and SEO

- One `<h1>` (visually hidden: "<site name> Preflight"), no skipped heading levels; landmarks (`<header>`, `<main>`, `<nav aria-label>`, `<aside>`); real lists and tables; buttons for actions, links for navigation; `alt` on every image (`alt=""` if decorative).
- Dialogs trap focus, close on Esc and return focus to the opener. Toggles carry `aria-pressed`, tabs `aria-selected`. The last-input toast is `aria-live`. Focus rings are gold (`--color-trail`). `prefers-reduced-motion` stops the pulses.
- The head: a specific title and description from config, canonical and Open Graph when `siteUrl` is set.

## Copy

Follow the Orbital Controls voice where it applies (see ../orbital-controls/docs/AGENTS.md "Voice and copy"): plain sentence case for buttons and body, the terminal register (uppercase) for status chips and eyebrows, no exclamation marks, no AI-sounding filler, no disabled placeholder controls.

## Checks

Run before every commit: `pnpm check`, `pnpm lint`, `pnpm test:unit --run`, `pnpm build`. `pnpm test:e2e` builds three variants (root, non-root base, theme override) and runs the Playwright smoke tests against them.

## Git

Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`). Work on a branch, open a PR, don't merge.
