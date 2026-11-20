# The 3D scene

```
scene/
  targets.ts     ship: flight state → part targets (gear progress, glow, ring tilt, door angles…). Pure.
  srv.ts         SRV: flight state → Wick LR targets (wheel yaw, speed, grip, jets, lights). Pure.
  drive.ts       SRV: the kinematic drive model (a ground query and spring per wheel, steering). Pure.
  terrain.ts     SRV: the stand-in moon's height function, rocks and ramps. Pure.
  analog.ts      bound stick, steering, drive, move and look axes from the input hub. Pure.
  held.ts        on foot: the effects whose binds are held down (walk directions, sprint). Pure.
  tracer.ts      on foot: the Tracer P1 and right hand's rig geometry (gun frame, cm). Pure.
  foot.ts        on foot: flight state + clocks → the viewmodel's pose; every timing in FOOT_ANIM. Pure.
  pad.ts         on foot: Pad 7 Compact as data — bay, solids, ramp, stops, prompts, ray casts. Pure.
  walker.ts      on foot: the kinematic first-person walker. Pure.
  prompts.ts     on foot: a stop's prompt lines with the pilot's current binds. Pure.
  parts.ts       the part contracts below, and checkParts() to test a model against one.
  three/         the three.js side, loaded with a dynamic import
    index.ts       the engine: renderer, loop, pause, one mode scene at a time, dispose
    ship-scene.ts  the ship mode: flight path, part animation, cameras, effects
    lantern.ts     the procedural Lantern II
    cockpit.ts     the cockpit interior and its dash screens
    space.ts       stars, planet, dust, the contact
    fx.ts          tracers, chaff, the heat-sink puff
    srv-scene.ts   the SRV mode: drive model, part posing, lights, cameras, dash screens
    wick.ts        the procedural Wick LR
    convex.ts      convex solids from half-spaces (the Wick LR's block-out shapes)
    surface.ts     the moon's ground mesh, rocks, ramp slabs and wheel dust
    foot-scene.ts  on foot: the walker, the parked ship, holo rounds, the viewmodel overlay
    pad7.ts        on foot: Pad 7's deck, walls, ceiling, pad, stops, props and lights
    tracer.ts      on foot: the procedural Tracer P1 and Crew Soft right hand
```

The engine reads the page's state once a frame and never writes back. A mode is a `ModeScene` (`ship-scene.ts`): its own `Scene`, camera and `update()`, and optionally an `overlay` (a second scene and camera drawn after the depth buffer is cleared: the on-foot viewmodel). The engine builds a mode's scene when the mode comes up and disposes the last one (`ShipScene`, `SrvScene`, `FootScene` in `index.ts`); `Viewport.svelte` lists which modes are 3D (`IN_3D`).

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

## The Wick LR part contract

The SRV is built the same way (`wick.ts`, from the StandWickLR3D v0.4 block-out) and checked by `checkParts(root, WICK_PARTS, WICK_ROOT)`. A Blender glTF can replace `buildWick()` if it keeps these names, parents, pivots and `userData`.

**Frame:** three.js, +Y up, −Z forward (the nose), +X to the right, in metres. The origin is on the ground between the axles (block-out x = 2.69). The block-out's own numbers (x forward from the tail, y to the left, z up) go through `w()` in `wick.ts`. Each part's origin is its pivot; rest pose is the vehicle standing still on flat ground.

| Name                                         | Parent       | Pivot and motion                                                                                                                     |
| -------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `wick`                                       | (root)       | Model origin. The scene sets its position and rotation (heading, then pitch, then roll) from the drive model.                        |
| `body`                                       | `wick`       | Static. Flat-shaded. Carries the door outline and handle, the panel seams and the step.                                              |
| `stripe`                                     | `wick`       | Static. The violet waist stripe.                                                                                                     |
| `cabinGlass`                                 | `wick`       | Static. Dark tinted, transparent. Hidden from the driver's seat (its edges, `cabinFrame`, stay).                                     |
| `lightStrip`                                 | `wick`       | Static. Gold; brighter with the headlights. A top face only, with a thin lip along the glass's front-top edge.                       |
| `seatL`, `seatR`, `jumpSeat`                 | `wick`       | Static.                                                                                                                              |
| `dash`                                       | `wick`       | Static.                                                                                                                              |
| `screenDrive`, `screenRecall`, `screenRange` | `dash`       | Static. Canvas textures mirroring the HUD: speed and drive assist; the ship; fuel and the spare cell.                                |
| `rack`, `spareCell`                          | `wick`       | Static.                                                                                                                              |
| `cellSeam`                                   | `spareCell`  | Static. Gold; pulses on low fuel (steady with reduced motion).                                                                       |
| `wheelFL`, `wheelFR`, `wheelRL`, `wheelRR`   | `wick`       | Wheel centre, axle along X, rotation order YXZ. `position.y = restY + travel`; `rotation.y` steers (front only), `rotation.x` rolls. |
| `wheelGlowFL` …                              | the wheel    | Static in the wheel. The gold glow ring.                                                                                             |
| `armUpperFL`, `armLowerFL` …                 | `wick`       | Inner (chassis) end. `rotation.z = −side × asin(travel / length)`, so the outer end follows the wheel.                               |
| `damperFL` …                                 | `wick`       | Upper mount, pointing down (−Y). Aimed at the lower arm, `damperAt` along it, and stretched (`scale.y`).                             |
| `fenderFL` …                                 | `wick`       | `position.y = restY + travel`: rides with its wheel, doesn't steer.                                                                  |
| `noseLampL`, `noseLampR`                     | `wick`       | Set into the upper nose facet. Gold; one headlight `SpotLight` sits between them.                                                    |
| `tailLight`                                  | `wick`       | Static. Gold; brighter on brake and reverse.                                                                                         |
| `hatch`                                      | `wick`       | Top edge (a hinge for later). Static for now.                                                                                        |
| `winch`                                      | `wick`       | Drum axis, along X. Static for now.                                                                                                  |
| `winchHook`                                  | `winch`      | Top of the line, under the drum.                                                                                                     |
| `turretRing`                                 | `wick`       | Static collar on the deck between the cabin and the rack. Violet; brightens when the turret is up.                                   |
| `turret`                                     | `wick`       | Base centre on the deck. `position.y = restY + lift × rise`.                                                                         |
| `turretHead`                                 | `turret`     | Turret axis. `rotation.y` yaws (0 = forward, left positive); stowed facing aft (π).                                                  |
| `turretGun`                                  | `turretHead` | Trunnion. `rotation.x` pitches; the barrel runs along −Z.                                                                            |
| `turretMuzzle`                               | `turretGun`  | Barrel tip, facing −Z. Tracers start here; the gold muzzle flash hangs off it.                                                       |
| `jetL`, `jetR`                               | `wick`       | Nozzle centre, facing +Z (aft). The violet core: dim at idle, bright when the jets fire.                                             |
| `plumeL`, `plumeR`                           | the jet      | At the nozzle, along +Z, angled down. `scale.z` is the plume length; hidden at idle.                                                 |

Required `userData` (`checkParts()` checks it): wheels carry `restY` and `side` (+1 left, −1 right); arms carry `side` and `length`; dampers carry `restLength`; fenders carry `restY`; `turret` carries `restY` and `lift`.

The roof turret is **not on the v0.4 board**. It follows the SRV placeholder's turret (StandFly): a roof mount with one long barrel, aimed at the reticle, firing gold (primary) or the warning colour (secondary). It pops up between the cabin and the rack: stowed, it sits low facing aft over the rack, mostly hidden behind the cabin; in turret mode it rises 0.32 m, clear of the glass. Its pitch is clamped so the barrel clears the cabin ahead and the rack behind (`turretPitch()` in `srv.ts`).

### What the SRV reacts to

| Flight state                                 | Scene                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Accelerate, reverse, handbrake (`sSpd`)      | Speed, wheel roll, dust; the tail strip brightens on brake and reverse                            |
| Steer left / right, or a bound steering axis | Front wheels yaw up to ±20°; the turn rate is capped by tyre grip at speed                        |
| Drive speed axis                             | Sets the speed directly while it's off its rest; the HUD keeps the mock flight's numbers          |
| Ground under each wheel                      | Spring and damper per wheel: travel, fenders, arms and dampers follow; the body pitches and rolls |
| Vertical thrusters (`jetT`)                  | Hop jets go bright violet with a plume; a short hop                                               |
| Drive assist off                             | Sideways slip dies away slowly, and it turns in harder: the SRV slides                            |
| Headlights                                   | Nose lamps and the cabin strip glow and the headlights light the ground                           |
| Low fuel (under 25 %)                        | The spare cell's gold seam pulses                                                                 |
| Turret mode                                  | The roof turret rises and aims at the reticle; the chase camera rises so the turret sits below it |
| Primary / secondary fire (turret mode)       | Gold tracers, or heavier warning-coloured ones, from the muzzle toward the reticle                |
| Target ahead                                 | The HUD's bracket; a contact holds that spot on screen, as in the ship scene                      |
| Recall ship, cargo scoop                     | HUD only                                                                                          |
| Toggle camera                                | Chase camera or the driver's seat, with the Drive / Recall / Range screens                        |
| Listening for a rebind                       | The vehicle holds still; the scene keeps drawing                                                  |

## The Tracer P1 part contract (on foot)

The viewmodel is built the same way (`three/tracer.ts`, from the Pistol3D v0.1 block-out) and checked by `checkParts(root, TRACER_PARTS, TRACER_ROOT)`. A Blender glTF of the gun and the Crew Soft right hand can replace `buildTracer()` if it keeps these names, parents, pivots and `userData`.

**Frame:** the gun frame, in centimetres: +X toward the muzzle, +Y up, +Z the gun's right side. The first-person camera is defined in this frame too (`VIEW` in `tracer.ts`: eye (−40, 10, −15) looking at (30, −1, −2), 46° vertical), so the whole viewmodel is one overlay with its own camera and never clips into walls. Rest pose is the final grip pose from Pistol3D: the web of the hand high on the backstrap, middle/ring/pinky wrapped round the front strap, the index straight along the frame, the thumb along the frame's left side. Only `forearmRoll`, `wristFlex` and the index chain are bones that animate.

| Name                                                  | Parent              | Pivot and motion                                                                                                               |
| ----------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `tracer`                                              | (root)              | The gun frame. The scene offsets it for bob, sprint lowering and cant, and the holster / swap dips.                            |
| `forearmRoll`                                         | `tracer`            | The elbow, local +X along the forearm to the wrist, +Y as near up as it goes. `rotation.x` rolls (reload: about −40°, inward). |
| `wristFlex`                                           | `forearmRoll`       | The wrist, axes parallel to the gun frame at rest. `rotation.z` lifts the muzzle (about 7° on fire).                           |
| `slide`                                               | `wristFlex`         | Gun origin. `position.x` = −travel: 1.8 back on fire, locked back when empty, home during reload-in.                           |
| `ammoSeg0` … `ammoSeg5`                               | `slide`             | Static. Violet emissive when loaded, metal grey when spent; spent from the front, refilled from the rear.                      |
| `rearSightL`, `rearSightR`, `frontSight`              | `slide`             | Static. The rear posts are gold emissive.                                                                                      |
| `frame`, `barrel`, `triggerGuard`, `trigger`          | `wristFlex`         | Static. The barrel shows when the slide kicks.                                                                                 |
| `emitter`                                             | `wristFlex`         | The muzzle disc, facing +X. Gold; flashes on fire. Holo rounds leave from just ahead of it.                                    |
| `grip`                                                | `wristFlex`         | Top centre of the grip, local −Y down the grip (raked back 18°).                                                               |
| `cartridge`                                           | `grip`              | Bottom of the grip. White body, gold base cap. Slides out along −Y and fades on reload-out.                                    |
| `cartridgeHolo`                                       | `grip`              | Bottom of the grip. The translucent violet hologram, with a gold scan line at its base, rising in along +Y.                    |
| `palm`, `glove`                                       | `wristFlex`         | Static. The palm and heel round the backstrap and right side; the back of the hand, wrist to knuckles.                         |
| `fingerMid`, `fingerRing`, `fingerPinky` (+`1`, `+2`) | `wristFlex` (chain) | Three bones each, locked to the grip. Each bone's local +X runs to the next joint.                                             |
| `index`, `index1`, `index2`                           | `wristFlex` (chain) | Animates from straight along the frame to the trigger (`indexJoints()`: two-bone IK, fixed lengths).                           |
| `thumb`, `thumb1`, `thumb2`                           | `wristFlex` (chain) | Locked along the frame's left side, pointing at the muzzle.                                                                    |
| `cuffSeam`, `sleeve`, `sleeveStripe`                  | `forearmRoll`       | Static. The soft white sleeve (cuff r 2.9 to elbow r 4.4), the grey seam, the violet top-outer stripe.                         |

Required `userData` (`checkParts()` checks it): `forearmRoll` and `grip` carry `length`. The builder also keeps each animated bone's rest orientation in `userData.base`, so a pose is applied on top of it.

### What on foot reacts to

| Flight state / input                      | Scene                                                                                                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Held move binds, bound move axes          | The walker walks (3.2 m/s), sprints (6), crouch-walks (1.6); a step bob on the gun and the eye                                                                                    |
| Sprint (held, or the mock flight's timer) | Faster; the gun lowers and cants                                                                                                                                                  |
| Crouch                                    | The eye drops from 1.7 m to 1.05 m                                                                                                                                                |
| Jump                                      | A 0.87 m hop: enough to vault the 1 m cargo barrier, or climb onto the crates                                                                                                     |
| Mouse (pointer lock), bound look axes     | Look; slower aiming down the sights                                                                                                                                               |
| Fire                                      | Index onto the trigger, slide kick, gold emitter flash, a violet holo round to the crosshair, a 7° muzzle rise, a segment greys; a ring hit flashes and counts                    |
| Empty                                     | Slide locked back, every segment grey; fire does nothing but the HUD's "Empty · reload"                                                                                           |
| Reload                                    | Forearm rolls in, the spent cartridge drops and fades, the holo cartridge rises in with its scan line, the slide returns, the segments refill rear to front, the wrist rolls back |
| Aim down sights                           | The rear sights come to the centre; the world's FOV narrows from 70° to 58°                                                                                                       |
| Holster, next / previous weapon           | The gun drops out of view (and comes back for a swap). The Tracer is the only weapon modelled                                                                                     |
| Flashlight                                | A cone light from the eye; the viewmodel catches it too                                                                                                                           |
| Night vision                              | A tint on the canvas, as in the ship                                                                                                                                              |
| Standing in a stop zone                   | Reported to the page: the HUD shows the stop's prompts and marks it visited                                                                                                       |
| Listening for a rebind                    | The pilot freezes and the pointer lock is released                                                                                                                                |

Every timing is a placeholder in `FOOT_ANIM` (`foot.ts`).

## Pad 7 Compact (on foot)

`pad.ts` holds the bay as data (metres; +X east toward Lantern II's nose, +Z south, origin the pad centre): the bay bounds, the solids the walker collides with, the ship's ramp as a walkable slope, the seven stops with their prompts, and the target rings. `pad7.ts` builds it; `walker.ts` and `castRay()` read the same data. Pad 7 Full (gantry, drill booth, airlock, EVA hull walk) adds stops, solids and ramps there. The walker is one-level only: it has no ceilings over the walkable floor, so a second level needs overhead checks.

Lantern II is the ship scene's procedural model at 0.36 m per model unit (17.5 m long), parked with its gear down. Its ramp panel is too short to reach the deck from gear height, so the on-foot scene drops it past horizontal and stretches it along its length (`rampPose()`), until the model has an extending ramp. The tail opening is about a metre tall at this scale: an interior will need a taller tail.
