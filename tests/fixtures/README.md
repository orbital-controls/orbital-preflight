# Fixtures

**Synthetic.** `hotas.binds` and `keyboard-only.binds` were written by hand from memory of the Elite Dangerous format, not exported by the game. They stand in until real files are added (see the PR's "Unverified" list). `static/binds/demo.binds` is a copy of `hotas.binds`.

- `hotas.binds`: a T.16000M stick, a TWCS throttle and one VKB device by raw id (`231D0200`), with keyboard and mouse on the other slots. LF line endings. `ShipSpotLightToggle` and `LandingGearToggle` share `L` on purpose, so there is a clash to find.
- `keyboard-only.binds`: keyboard and mouse only. CRLF line endings, to check the writer keeps them.

`.gitattributes` marks `*.binds` as binary text (`-text`) so git never rewrites their line endings.

When real files arrive, drop them in here, add them to the round-trip test in `src/lib/orbital-preflight/sims/elite/elite.spec.ts`, and replace `static/binds/demo.binds` with one of them.
