import {
	AdditiveBlending,
	Color,
	CylinderGeometry,
	DirectionalLight,
	HemisphereLight,
	Material,
	Mesh,
	MeshBasicMaterial,
	Object3D,
	PerspectiveCamera,
	PointLight,
	Scene,
	SpotLight,
	Sprite,
	SpriteMaterial,
	Vector3,
	type Texture
} from 'three';
import type { FlightState } from '../../flight.ts';
import {
	bobAmplitude,
	FOOT_ANIM,
	gaitFor,
	tracerPose,
	type Gait,
	type ReloadState
} from '../foot.ts';
import { castRay, rampPose, SHIP, stopAt, STOPS } from '../pad.ts';
import { OPEN_ANGLE } from '../targets.ts';
import { lerp3, VIEW, VIEW_ADS } from '../tracer.ts';
import {
	eyeHeight,
	IDLE_INPUT,
	spawnWalker,
	speedOf,
	stepWalker,
	WALK,
	type Walker,
	type WalkInput
} from '../walker.ts';
import { buildLantern, makeShipMaterials } from './lantern.ts';
import { buildPad7, type Pad7 } from './pad7.ts';
import type { Palette } from './palette.ts';
import type { FrameInput, ModeScene } from './ship-scene.ts';
import { buildTracer, type TracerRig } from './tracer.ts';

/**
 * On foot: a first-person walk round Pad 7 Compact, with Lantern II parked on the pad,
 * seen over the right arm holding the Tracer P1. The walker moves on held binds and
 * bound axes, the mouse looks (pointer lock), and the flight state drives the
 * viewmodel. The viewmodel is an overlay: its own scene and camera, in gun-frame cm,
 * drawn after the depth is cleared, so it never clips into walls.
 *
 * Reads the frame input; reports only which stop zone the pilot is in (`onstop`).
 */

export interface Spawn {
	x: number;
	z: number;
	yaw: number;
}

export interface FootOptions {
	reducedMotion: boolean;
	spawn?: Spawn | null;
	/** The pilot entered a stop zone (its number), or left one (null). */
	onstop?: (n: number | null) => void;
	/** Dev only: a fixed camera high over the bay (screenshots); the viewmodel hides. */
	overview?: boolean;
}

/** The dev overview camera: high in the south-west corner, looking across the bay. */
const OVERVIEW = { eye: new Vector3(-21, 8.4, 12.2), at: new Vector3(3, 0, -3), fov: 62 };

/** Mouse look, radians per pixel; slower aiming down the sights. */
const MOUSE = 0.0022;
/** Bound look axes at full deflection, radians per second. UNVERIFIED signs. */
const LOOK_RATE = { yaw: 2.4, pitch: 1.8 };

const _v = new Vector3();
const _w = new Vector3();
const _up = new Vector3(0, 1, 0);
const _right = new Vector3();

/** Where a spawn spec from the URL lands: a stop number, or "x,z,yawDegrees". */
export function parseSpawn(spec: string | null | undefined): Spawn | null {
	if (!spec) return null;
	const n = Number(spec);
	if (Number.isInteger(n)) {
		const stop = STOPS.find((s) => s.n === n);
		return stop ? { x: stop.at[0], z: stop.at[1], yaw: stop.face } : null;
	}
	const [x, z, yaw = 0] = spec.split(',').map(Number);
	if (![x, z, yaw].every(Number.isFinite)) return null;
	return { x, z, yaw: (yaw * Math.PI) / 180 };
}

export class FootScene implements ModeScene {
	readonly camera = new PerspectiveCamera(FOOT_ANIM.aim.worldFov, 900 / 560, 0.05, 120);
	readonly root: Object3D;
	readonly overlay: { scene: Scene; camera: PerspectiveCamera };

	#opts: FootOptions;
	#rig: TracerRig;
	#pad: Pad7;
	#walker: Walker;
	#prev: FlightState | null = null;
	#t = 0;
	#sinceFire = Number.POSITIVE_INFINITY;
	#reload: { t0: number; fromEmpty: boolean } | null = null;
	#holster = 0;
	#aim = 0;
	#sprint = 0;
	#swap = 0;
	#bobPhase = 0;
	#bobAmp = 0;
	#headAmp = 0;
	#stop: number | null = null;
	#hits = 0;
	#lit = 6;
	#beam: Mesh;
	#beamMat: MeshBasicMaterial;
	#impact: Sprite;
	#beamT = 0;
	#flashlight: SpotLight;
	#vmFill: PointLight;

	constructor(
		readonly scene: Scene,
		palette: Palette,
		glow: Texture,
		options: FootOptions
	) {
		this.#opts = options;
		this.#pad = buildPad7(palette);
		scene.add(this.#pad.group);

		// Lantern II, parked: gear down, ramp dropped to the deck, rings idling dark.
		const mat = makeShipMaterials(palette, glow);
		const ship = buildLantern(palette, mat);
		const parts: Record<string, Object3D> = {};
		ship.root.traverse((o) => {
			if (o.name) parts[o.name] = o;
		});
		for (const id of ['FL', 'FR', 'RL', 'RR']) {
			parts[`gear${id}`].rotation.x = 0;
			const door = parts[`gearDoor${id}`];
			door.rotation.z = (door.userData.openSign as number) * OPEN_ANGLE.gearDoor;
		}
		const ramp = rampPose();
		parts.rampDoor.rotation.x = ramp.angle;
		parts.rampDoor.scale.y = ramp.stretch;
		mat.glow.color.multiplyScalar(0.2);
		for (const halo of ship.halos) halo.scale.setScalar(1.5);
		ship.noseSpot.intensity = 0;
		ship.root.scale.setScalar(SHIP.scale);
		// Model nose (−Z) to world +X.
		ship.root.rotation.y = -Math.PI / 2;
		ship.root.position.set(SHIP.at[0], -SHIP.groundZ * SHIP.scale, SHIP.at[1]);
		scene.add(ship.root);

		// The pilot.
		const spawn = options.spawn ?? { x: STOPS[0].at[0], z: STOPS[0].at[1], yaw: STOPS[0].face };
		this.#walker = spawnWalker(spawn.x, spawn.z, spawn.yaw);
		this.camera.rotation.order = 'YXZ';
		this.#flashlight = new SpotLight(new Color('#f4f1ff'), 0, 32, 0.42, 0.45, 1.3);
		this.#flashlight.position.set(0.18, -0.12, 0);
		const aim = new Object3D();
		aim.position.set(0, 0, -6);
		this.camera.add(this.#flashlight, aim);
		this.#flashlight.target = aim;
		scene.add(this.camera);

		// Holo rounds: a violet streak to the hit, a small glow where it lands.
		this.#beamMat = new MeshBasicMaterial({
			color: palette.violetBright,
			transparent: true,
			opacity: 0,
			blending: AdditiveBlending,
			depthWrite: false
		});
		const beamGeo = new CylinderGeometry(0.012, 0.012, 1, 6, 1, true);
		beamGeo.translate(0, 0.5, 0);
		this.#beam = new Mesh(beamGeo, this.#beamMat);
		this.#beam.visible = false;
		this.#beam.frustumCulled = false;
		this.#impact = new Sprite(
			new SpriteMaterial({
				map: glow,
				color: palette.violetBright,
				transparent: true,
				opacity: 0,
				blending: AdditiveBlending,
				depthWrite: false
			})
		);
		this.#impact.visible = false;
		scene.add(this.#beam, this.#impact);

		// The viewmodel layer.
		this.#rig = buildTracer(palette);
		this.root = this.#rig.root;
		const vm = new Scene();
		vm.add(this.#rig.root);
		// Near-neutral fill, as Pistol3D lights it: the glove reads slate, not navy.
		vm.add(new HemisphereLight(new Color('#ecebf6'), palette.steel, 1.9));
		const key = new DirectionalLight(new Color('#fff6e8'), 2.4);
		key.position.set(-30, 60, -45);
		vm.add(key);
		const rim = new DirectionalLight(palette.violetBright, 0.6);
		rim.position.set(40, 10, 50);
		vm.add(rim);
		this.#vmFill = new PointLight(new Color('#f4f1ff'), 0, 200, 1);
		this.#vmFill.position.set(...VIEW.eye);
		vm.add(this.#vmFill);
		const vmCam = new PerspectiveCamera(VIEW.fov, 900 / 560, 1, 600);
		this.overlay = { scene: vm, camera: vmCam };
		this.#placeViewCamera(0);
		this.#placeCamera(0);
	}

	targets() {
		return null;
	}

	info() {
		return {
			hits: this.#hits,
			segments: this.#lit,
			stop: this.#stop ?? 0,
			x: Math.round(this.#walker.x * 10) / 10,
			z: Math.round(this.#walker.z * 10) / 10
		};
	}

	update(input: FrameInput, dt: number) {
		const s = input.flight;
		const prev = this.#prev ?? s;
		this.#prev = s;
		this.#t += dt;
		const rm = input.reducedMotion;

		// Edges in the flight state.
		const shot = s.ammo < prev.ammo && s.fireT > 0;
		// The mock flight refills when its timer runs out, so the ammo at the start says
		// whether the slide was locked back.
		if (s.reloadT > 0 && !this.#reload) this.#reload = { t0: this.#t, fromEmpty: s.ammo === 0 };
		if (s.reloadT === 0) this.#reload = null;
		if (s.weapon !== prev.weapon) this.#swap = FOOT_ANIM.swap.seconds;
		const jump = s.jumpT > prev.jumpT;

		// Move and look.
		this.#walker = stepWalker(
			this.#walker,
			input.frozen ? IDLE_INPUT : this.#walkInput(input, jump, dt),
			dt
		);
		const w = this.#walker;
		const speed = speedOf(w);
		const sprinting = (input.held?.has('sprint') ?? false) || s.sprintT > 0;
		const gait: Gait = w.grounded ? gaitFor(speed, sprinting && speed > WALK.walk + 0.4) : 'idle';

		// Stop zones.
		const stop = stopAt(w.x, w.z)?.n ?? null;
		if (stop !== this.#stop) {
			this.#stop = stop;
			this.#opts.onstop?.(stop);
		}

		// Eased weapon states.
		const ease = (from: number, to: number, seconds: number) =>
			from + (to - from) * (1 - Math.exp(-dt / Math.max(0.01, seconds / 3)));
		const reloading = this.#reload !== null;
		this.#holster = ease(this.#holster, s.holster ? 1 : 0, FOOT_ANIM.holster.seconds);
		this.#aim = ease(this.#aim, s.aim && !s.holster && !reloading ? 1 : 0, FOOT_ANIM.aim.seconds);
		this.#sprint = ease(
			this.#sprint,
			gait === 'sprint' && this.#aim < 0.5 ? 1 : 0,
			1 / FOOT_ANIM.sprint.ease
		);
		this.#swap = Math.max(0, this.#swap - dt);

		// Bob: breathing at rest, a step rhythm walking and sprinting.
		const hz =
			gait === 'sprint'
				? FOOT_ANIM.bob.sprintHz
				: gait === 'walk'
					? FOOT_ANIM.bob.walkHz
					: FOOT_ANIM.bob.breathHz;
		this.#bobPhase += dt * Math.PI * 2 * hz;
		this.#bobAmp = ease(this.#bobAmp, bobAmplitude(gait, rm) * (1 - 0.75 * this.#aim), 0.3);
		const head = rm ? 0 : gait === 'sprint' ? 2 : gait === 'walk' ? 1 : 0;
		this.#headAmp = ease(this.#headAmp, head * FOOT_ANIM.bob.head, 0.3);

		// Fire: the clocks, the round's path and the target it lights.
		if (shot) {
			this.#sinceFire = 0;
			this.#fire(rm);
		} else this.#sinceFire += dt;

		// The viewmodel.
		const reload: ReloadState | null = this.#reload
			? {
					p: Math.min(1, (this.#t - this.#reload.t0) / FOOT_ANIM.reload.seconds),
					fromEmpty: this.#reload.fromEmpty
				}
			: null;
		const pose = tracerPose({
			sinceFire: this.#sinceFire,
			ammo: s.ammo,
			reload,
			reducedMotion: rm
		});
		this.#lit = pose.segments.filter(Boolean).length;
		this.#rig.setPose(pose);
		this.#placeViewmodel();
		this.#placeViewCamera(this.#aim);
		this.#placeCamera(dt);
		if (this.#opts.overview) {
			this.camera.position.copy(OVERVIEW.eye);
			this.camera.lookAt(OVERVIEW.at);
			this.camera.fov = OVERVIEW.fov;
			this.camera.updateProjectionMatrix();
			this.overlay.scene.visible = false;
		}

		// Lights: the flashlight from the eye; the viewmodel catches some of it.
		this.#flashlight.intensity = s.flash ? 38 : 0;
		this.#vmFill.intensity = s.flash ? 4500 : 0;

		// Fades: the round, its impact, the rings.
		this.#beamT = Math.max(0, this.#beamT - dt);
		const k = this.#beamT / FOOT_ANIM.fire.round;
		this.#beamMat.opacity = k * (rm ? 0.5 : 0.9);
		this.#beam.visible = k > 0;
		(this.#impact.material as SpriteMaterial).opacity = k * (rm ? 0.5 : 1);
		this.#impact.visible = k > 0;
		for (const ring of this.#pad.rings) {
			ring.flash = Math.max(0, ring.flash - dt);
			const f = Math.min(1, ring.flash / 0.12) * (rm ? 0.5 : 1);
			ring.ring.color
				.copy(this.#pad.ringColor)
				.lerp(_white, f * 0.6)
				.multiplyScalar(1 + f * 1.5);
			ring.core.color.copy(this.#pad.coreColor).multiplyScalar(1 + f * 2);
		}
	}

	#walkInput(input: FrameInput, jump: boolean, dt: number): WalkInput {
		const held = input.held;
		const on = (e: string) => (held?.has(e) ? 1 : 0);
		const a = input.analog;
		const forward = on('walkF') - on('walkB') + (a.has.moveY ? -a.moveY : 0);
		const strafe = on('walkR') - on('walkL') + (a.has.moveX ? a.moveX : 0);
		const sens = MOUSE * (1 - 0.35 * this.#aim);
		const look = input.look ?? { dx: 0, dy: 0 };
		return {
			forward,
			strafe,
			sprint: on('sprint') === 1 || input.flight.sprintT > 0,
			crouch: input.flight.crouch,
			jump,
			lean: on('leanR') - on('leanL'),
			yaw: -look.dx * sens - (a.has.lookX ? a.lookX * LOOK_RATE.yaw * dt : 0),
			pitch: -look.dy * sens - (a.has.lookY ? a.lookY * LOOK_RATE.pitch * dt : 0)
		};
	}

	#fire(rm: boolean) {
		this.camera.updateMatrixWorld();
		const origin = this.camera.getWorldPosition(_v);
		const dir = this.camera.getWorldDirection(_w);
		const hit = castRay([origin.x, origin.y, origin.z], [dir.x, dir.y, dir.z]);
		if (hit.ring !== null) {
			this.#pad.rings[hit.ring].flash = rm ? 0.2 : 0.35;
			this.#hits += 1;
			this.#pad.setHits(this.#hits);
		}
		// The streak starts where the emitter is on screen, half a metre out.
		this.overlay.scene.updateMatrixWorld();
		this.overlay.camera.updateMatrixWorld();
		const ndc = this.#rig.muzzle.getWorldPosition(_v).project(this.overlay.camera);
		const start = ndc
			.setZ(0.5)
			.unproject(this.camera)
			.sub(origin)
			.normalize()
			.multiplyScalar(0.5)
			.add(origin);
		const end = _w.set(...hit.point);
		const along = end.clone().sub(start);
		const length = along.length();
		this.#beam.position.copy(start);
		this.#beam.quaternion.setFromUnitVectors(_up, along.normalize());
		this.#beam.scale.set(1, length, 1);
		this.#impact.position.copy(end);
		this.#impact.scale.setScalar(hit.ring !== null ? 0.9 : 0.5);
		this.#beamT = FOOT_ANIM.fire.round;
	}

	/** The eye: feet + eye height, a head bob, the lean; pitch, yaw, then lean roll. */
	#placeCamera(dt: number) {
		const w = this.#walker;
		const bob = Math.sin(this.#bobPhase * 2) * this.#headAmp;
		_right.set(Math.cos(w.yaw), 0, -Math.sin(w.yaw));
		this.camera.position
			.set(w.x, w.y + eyeHeight(w) + bob, w.z)
			.addScaledVector(_right, w.lean * WALK.leanShift);
		this.camera.rotation.set(w.pitch, w.yaw, -w.lean * WALK.leanRoll);
		const fov =
			FOOT_ANIM.aim.worldFov + (FOOT_ANIM.aim.adsFov - FOOT_ANIM.aim.worldFov) * this.#aim;
		if (Math.abs(fov - this.camera.fov) > 1e-3 || dt === 0) {
			this.camera.fov = fov;
			this.camera.updateProjectionMatrix();
		}
	}

	/** The viewmodel's camera: the block-out's eye, sliding onto the sight line to aim. */
	#placeViewCamera(aim: number) {
		const cam = this.overlay.camera;
		const eye = lerp3(VIEW.eye, VIEW_ADS.eye, aim);
		const at = lerp3(VIEW.at, VIEW_ADS.at, aim);
		cam.position.set(...eye);
		cam.lookAt(at[0], at[1], at[2]);
		const fov = VIEW.fov + (VIEW_ADS.fov - VIEW.fov) * aim;
		if (Math.abs(cam.fov - fov) > 1e-3 || cam.aspect !== this.camera.aspect) {
			cam.fov = fov;
			cam.aspect = this.camera.aspect;
			cam.updateProjectionMatrix();
		}
	}

	/** Bob, sprint lowering and cant, holster and swap dips, in gun-frame cm. */
	#placeViewmodel() {
		const r = this.#rig.root;
		const amp = this.#bobAmp;
		const sp = this.#sprint;
		const swap = this.#swap > 0 ? Math.sin((Math.PI * this.#swap) / FOOT_ANIM.swap.seconds) : 0;
		const down = Math.max(this.#holster, swap);
		r.position.set(
			0,
			Math.sin(this.#bobPhase * 2) * amp * 0.5 -
				FOOT_ANIM.sprint.drop * sp -
				FOOT_ANIM.holster.drop * down,
			Math.sin(this.#bobPhase) * amp
		);
		r.rotation.set(
			-FOOT_ANIM.sprint.cant * sp - 0.5 * down,
			0,
			FOOT_ANIM.sprint.pitch * sp - 0.7 * down
		);
		this.overlay.scene.visible = this.#holster < 0.985;
	}

	dispose() {
		this.#opts.onstop?.(null);
		// The engine frees the world scene; the overlay is ours.
		this.overlay.scene.traverse((o) => {
			const m = o as Mesh;
			m.geometry?.dispose();
			const mats = Array.isArray(m.material) ? m.material : [m.material];
			for (const mat of mats) if (mat instanceof Material) mat.dispose();
		});
	}
}

const _white = new Color(1, 1, 1);
