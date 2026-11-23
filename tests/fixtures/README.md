# Fixtures

**Synthetic.** `hotas.binds` and `keyboard-only.binds` were written by hand from memory of the Elite Dangerous format, not exported by the game. They stand in until real files are added (see the PR's "Unverified" list). `static/binds/demo.binds` is a copy of `hotas.binds`.

- `hotas.binds`: a T.16000M stick, a TWCS throttle and one VKB device by raw id (`231D0200`), with keyboard and mouse on the other slots. LF line endings. `ShipSpotLightToggle` and `LandingGearToggle` share `L` on purpose, so there is a clash to find.
- `keyboard-only.binds`: keyboard and mouse only. CRLF line endings, to check the writer keeps them.

`.gitattributes` marks `*.binds` as binary text (`-text`) so git never rewrites their line endings.

`star-citizen.xml` is a Star Citizen layout in the format the game exports (checked against real exports, not one itself): a VKB stick as `js1`, a TWCS throttle as `js2`, a few keyboard, mouse and controller rebinds, and one `kb1_ ` clearing a default. `v_toggle_landing_system` and `v_vtol_toggle` share `K` on purpose. `static/binds/demo-star-citizen.xml` is a copy. `star-citizen-defaults.xml` changes nothing, so it reads as the game's defaults.

`x4.xml` is an X4 inputmap.xml in the format the game writes (checked against game-written files, not one itself): keyboard and mouse, an Xbox pad in slot 1 and a stick in slot 2 (`…_2`). It has a radial menu entry the slots skip, a `toggle` attribute, a Shift wheel and a row ("Map") that writes to two controls. LF line endings.

When real files arrive, drop them in here, add them to the round-trip test in `src/lib/orbital-preflight/sims/elite/elite.spec.ts`, and replace `static/binds/demo.binds` with one of them.
