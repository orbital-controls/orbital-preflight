# The 3D scene

```
scene/
  targets.ts     flight state → part targets (gear progress, glow, ring tilt, door angles…). Pure.
  analog.ts      bound pitch / roll / yaw axes from the input hub. Pure.
  parts.ts       the part contract below, and checkParts() to test a model against it.
  three/         the three.js side, loaded with a dynamic import
    index.ts       the engine: renderer, loop, pause, dispose
    ship-scene.ts  the ship mode: flight path, part animation, cameras, effects
    lantern.ts     the procedural Lantern II
    cockpit.ts     the cockpit interior and its dash screens
    space.ts       stars, planet, dust, the contact
    fx.ts          tracers, chaff, the heat-sink puff
```

The engine reads the page's state once a frame and never writes back. A mode is a `ModeScene` (`ship-scene.ts`): its own `Scene`, camera and `update()`. SRV and on-foot scenes slot in beside `ShipScene` in `index.ts`; `Viewport.svelte` lists which modes are 3D (`IN_3D`).

## The Lantern II part contract

The animation finds every moving part by name, so a glTF exported from Blender can replace `buildLantern()` without touching `ship-scene.ts`, as long as it keeps these names, parents and pivots. `parts.spec.ts` checks the procedural ship against the list; run `checkParts()` on an imported model too.

**Frame:** +Y up, −Z forward (the nose), +X to starboard. 1 unit = 10 px of the 2D sheet (the sheet's top view converts as X = (x − 450) / 10, Y = (210 − y) / 10, then into this frame). Each part's origin is its pivot; rest pose is stowed or closed.

| Name                                   | Parent      | Pivot and motion                                                                 |
| -------------------------------------- | ----------- | -------------------------------------------------------------------------------- |
| `lantern`                              | (root)      | Ship origin. The engine sets its rotation (bank, pitch, heading) and lift.       |
| `hull`                                 | `lantern`   | Static. Flat-shaded; the facets are the look.                                    |
| `stripe`                               | `lantern`   | Static. Violet emissive, dimmed by silent running.                               |
| `canopyGlass`                          | `lantern`   | Static. Smooth, one surface. Hidden in the cockpit camera.                       |
| `pylonL`, `pylonR`                     | `lantern`   | Static.                                                                          |
| `ringL`, `ringR`                       | `lantern`   | Ring centre, axis along Z. Rotates about Y with the yaw rate (up to 12°).        |
| `ringGlowL`, `ringGlowR`               | ring        | Gold glow disc and hot core, deep in the duct. Colour and brightness animate.    |
| `turretL`, `turretR`                   | ring        | Stowed in the ring's lower wall. Slides 1.8 along −Z with hardpoints out.        |
| `tailBlock`                            | `lantern`   | Static.                                                                          |
| `rampDoor`                             | `tailBlock` | Bottom edge. Rotates about +X up to 78°, the top swinging aft and down.          |
| `tailLights`                           | `tailBlock` | Static. Amber emissive.                                                          |
| `bayDoorL`, `bayDoorR`                 | `lantern`   | Outer edge on the roof. Rotates about Z up to 115°, opening up and out.          |
| `gearFL`, `gearFR`, `gearRL`, `gearRR` | `lantern`   | Hinge in the belly. Rest: lying aft (−90° about X). Deployed: vertical, 0°.      |
| `gearDoorFL` … `gearDoorRR`            | `lantern`   | Outer edge of the belly door. Rotates about Z up to 100°, dropping outward.      |
| `noseLight`                            | `lantern`   | Nose tip, facing −Z. Gold emissive; the floodlight (a `SpotLight`) hangs off it. |

Required `userData` (`checkParts()` checks it):

- Every door carries `openSign`, and opens to `rotation.z = openSign × angle`. Bay doors (opening up): port +1, starboard −1. Gear doors (dropping down): port −1, starboard +1.
- Turrets carry `stowedZ`, their stowed `position.z`; deployed is `stowedZ − 1.8`.

Materials are matched by role, not name: the engine recolours the materials it created. A glTF should be loaded and then have its materials swapped for `makeShipMaterials()`'s, by mesh name, until the art pipeline settles.

The cockpit (`cockpit.ts`) is built the same way and rides under `lantern`: `cockpit`, `stick` and `throttleGrip` (pivots at their bases), `screenPilot`, `screenShared`, `screenCopilot`, `lightArch`. The pilot's eye is `EYE`, in sheet model space.

## What reacts to what

| Flight state                         | Scene                                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| Throttle, boost, supercruise         | Ring glow brightness and colour (deep amber → full gold on boost), speed, dust streaks |
| Flight assist off                    | Velocity lags the nose, so the ship drifts                                             |
| Gear                                 | Doors open, then the four legs swing down                                              |
| Hardpoints, primary / secondary fire | Turrets slide out; gold tracers, or heavier warning-coloured ones                      |
| Lights, silent running               | Nose floodlight and ring running lights; silent dims every emissive and cuts the glow  |
| Heat, heat sink                      | A warm tint on hull and rings above half heat; a vented puff                           |
| Cargo scoop                          | Roof bay doors open                                                                    |
| Landed (gear down, throttle at zero) | The ramp drops. The mock flight has no landing, so this stands in for it               |
| Yaw, roll, vertical thrust           | Heading turns and the rings tilt; the ship banks; nose trim and lift                   |
| Bound pitch / roll / yaw axes        | Fly the ship directly; the cockpit stick follows                                       |
| Chaff, night vision, target          | A glinting burst; a tint on the canvas; the HUD's bracket (the contact sits under it)  |
| Toggle camera                        | Chase camera or the pilot's seat                                                       |
