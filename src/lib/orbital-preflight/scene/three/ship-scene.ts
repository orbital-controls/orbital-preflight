import {
	Color,
	DirectionalLight,
	Euler,
	Group,
	HemisphereLight,
	Object3D,
	PerspectiveCamera,
	Quaternion,
	Vector3,
	type Sprite,
	type Scene,
	type Texture
} from 'three';
import { shipHud, type FlightState } from '../../flight.ts';
import type { Analog } from '../analog.ts';
import {
	approach,
	flightEvents,
	gearPose,
	OPEN_ANGLE,
	partTargets,
	ringTilt,
	MAX_BANK,
	TURRET_TRAVEL,
	type PartTargets
} from '../targets.ts';
import { buildCockpit, drawScreens, EYE, type Cockpit } from './cockpit.ts';
import { Effects } from './fx.ts';
import { m } from './geometry.ts';
import { buildLantern, makeShipMaterials, type ShipMaterials } from './lantern.ts';
import type { Palette } from './palette.ts';
import { contact, Dust, planet, starfield } from './space.ts';

/** What a mode's scene gets every frame. It reads; it never writes back. */
export interface FrameInput {
	flight: FlightState;
	analog: Analog;
	reducedMotion: boolean;
	/** Dev only: swing the chase camera around the ship by this many degrees. */
	orbit?: number;
}

/**
 * One mode's 3D world. The engine owns the renderer and the loop; a mode scene owns its
 * objects and camera. SRV and on-foot scenes plug in the same way.
 */
export interface ModeScene {
	readonly scene: Scene;
	readonly camera: PerspectiveCamera;
	update(input: FrameInput, dt: number): void;
	/** The HUD hook for the e2e tests and the PR's numbers: current part targets. */
	targets(): PartTargets | null;
	dispose(): void;
}

const UP = new Vector3(0, 1, 0);
const RIGHT = new Vector3(1, 0, 0);
const FORWARD = new Vector3(0, 0, -1);
const YAW_RATE = 0.9;
const PITCH_RATE = 0.85;
const CHASE = { offset: new Vector3(0, 15, 64), pitch: -0.2, fov: 50 };
const CHASE_TILT = new Quaternion().setFromAxisAngle(RIGHT, CHASE.pitch);
const COCKPIT = { pitch: -0.1, fov: 74 };
const COCKPIT_TILT = new Quaternion().setFromAxisAngle(RIGHT, COCKPIT.pitch);
const EYE_POS = m(EYE.x, EYE.y, EYE.z);

// Scratch objects, reused every frame so the loop allocates nothing.
const _pathQ = new Quaternion();
const _shipQ = new Quaternion();
const _q = new Quaternion();
const _euler = new Euler(0, 0, 0, 'XYZ');
const _v = new Vector3();
const _world = new Vector3();
const _color = new Color();
/** The HUD draws its target bracket here (px of the 900 × 560 viewport). */
const CONTACT_PX = { x: 712, y: 132, w: 900, h: 560, range: 650 };

function toward(current: number, target: number, step: number): number {
	return current < target ? Math.min(target, current + step) : Math.max(target, current - step);
}

export class ShipScene implements ModeScene {
	readonly camera = new PerspectiveCamera(CHASE.fov, 900 / 560, 0.1, 20000);
	#ship: Group;
	#mat: ShipMaterials;
	#parts: Record<string, Object3D> = {};
	#muzzles: Object3D[];
	#halos: Sprite[] = [];
	#cockpit: Cockpit;
	#dust: Dust;
	#sky = new Group();
	#fx: Effects;
	#contact: Group;
	#contactBeacon: { color: Color };
	#noseSpot: Object3D & { intensity: number };
	#palette: Palette;

	// Flight path and the cosmetic pose on top of it.
	#heading = 0;
	#pitch = 0;
	#yawRate = 0;
	#bank = 0;
	#trim = 0;
	#lift = 0;
	#velocity = new Vector3();
	#camQ = new Quaternion();
	#prev: FlightState | null = null;
	#t = 0;
	#fireClock = 0;
	#fire2Clock = 0;
	#muzzleSide = 0;
	#last: PartTargets | null = null;
	#screenKey = '';
	#screenClock = 0;

	// Eased part progress, 0..1.
	#gear = 0;
	#bay = 0;
	#ramp = 0;
	#turrets = 0;
	#glow = 0.4;
	#gold = 0.5;
	#running = 1;
	#nose = 1;
	#emissive = 1;
	#heat = 0;

	constructor(
		readonly scene: Scene,
		palette: Palette,
		glow: Texture,
		options: { dust: number }
	) {
		this.#palette = palette;
		this.#mat = makeShipMaterials(palette, glow);
		const built = buildLantern(palette, this.#mat);
		this.#ship = built.root;
		this.#muzzles = built.muzzles;
		this.#halos = built.halos;
		this.#noseSpot = built.noseSpot;
		this.#ship.traverse((o) => {
			if (o.name) this.#parts[o.name] = o;
		});
		this.#cockpit = buildCockpit(palette);
		this.#ship.add(this.#cockpit.group);
		scene.add(this.#ship);

		const sun = new Vector3(0.55, 0.45, 0.35).normalize();
		const light = new DirectionalLight(0xffffff, 2.6);
		light.position.copy(sun).multiplyScalar(100);
		scene.add(light);
		scene.add(new HemisphereLight(palette.violetBright, palette.ground, 0.55));

		const stars = starfield(palette);
		stars.renderOrder = -2;
		// The planet keeps its own light, so the face toward the ship reads pale.
		this.#sky.add(stars, planet(palette, new Vector3(-0.75, 0.35, 0.55)));
		scene.add(this.#sky);

		this.#dust = new Dust(palette, options.dust);
		scene.add(this.#dust.group);
		this.#fx = new Effects(palette, glow);
		scene.add(this.#fx.group);

		const c = contact(palette);
		this.#contact = c.group;
		this.#contactBeacon = c.beacon;
		this.camera.add(this.#contact);
		scene.add(this.camera);
		this.#camQ.identity();
	}

	/** The names the animation found: the part contract, checked against the live model. */
	get root(): Group {
		return this.#ship;
	}

	targets(): PartTargets | null {
		return this.#last;
	}

	update(input: FrameInput, dt: number) {
		const s = input.flight;
		const t = partTargets(s, { reducedMotion: input.reducedMotion });
		this.#last = t;
		this.#t += dt;
		const a = input.analog;

		// Steering: digital yaw arrives as heading steps, eased in; bound axes fly directly.
		const events = this.#prev
			? flightEvents(this.#prev, s)
			: { chaff: false, heatSink: false, yaw: 0 };
		this.#prev = s;
		const before = this.#heading;
		// A yaw axis pushed past halfway also fires the yaw buttons' step; the axis wins.
		const stepped = a.has.yaw && Math.abs(a.yaw) > 0.4 ? 0 : (events.yaw * Math.PI) / 180;
		this.#pendingYaw += stepped;
		const ease = this.#pendingYaw * (1 - Math.exp(-7 * dt));
		this.#pendingYaw -= ease;
		this.#heading += ease + a.yaw * YAW_RATE * dt;
		this.#pitch = Math.max(-1.2, Math.min(1.2, this.#pitch + a.pitch * PITCH_RATE * dt));
		this.#yawRate = approach(this.#yawRate, (this.#heading - before) / Math.max(dt, 1e-3), 8, dt);

		const rollIn = a.has.roll && a.roll !== 0 ? a.roll * MAX_BANK : t.bank;
		const yawBank = Math.max(-0.25, Math.min(0.25, this.#yawRate * 0.22));
		this.#bank = approach(this.#bank, rollIn + yawBank, 5, dt);
		this.#trim = approach(this.#trim, t.trim + a.pitch * 0.12, 5, dt);
		this.#lift = approach(this.#lift, t.lift > 0 ? 2.4 : t.lift < 0 ? -2.4 : 0, 3, dt);

		const pathQ = _pathQ
			.setFromAxisAngle(UP, -this.#heading)
			.multiply(_q.setFromAxisAngle(RIGHT, this.#pitch));
		const shipQ = _shipQ
			.copy(pathQ)
			.multiply(_q.setFromEuler(_euler.set(this.#trim, 0, -this.#bank, 'XYZ')));
		this.#ship.quaternion.copy(shipQ);
		this.#ship.position.copy(UP).applyQuaternion(pathQ).multiplyScalar(this.#lift);

		// Velocity catches up with the nose: slowly with flight assist off, so the ship drifts.
		const want = _v.copy(FORWARD).applyQuaternion(pathQ).multiplyScalar(t.speed);
		this.#velocity.lerp(want, 1 - Math.exp(-t.follow * dt));

		this.#animateParts(t, dt);
		this.#effects(t, events, shipQ, dt, input.reducedMotion);
		this.#cameraUpdate(t, pathQ, shipQ, dt, input.orbit ?? 0);

		this.#sky.position.copy(this.camera.position);
		this.#dust.update(this.#velocity, dt, t.streak, this.camera.position);
		this.#dust.setDim(input.reducedMotion ? 0.6 : 1);
		this.#fx.update(dt, this.#velocity);
		this.#contact.rotation.y += dt * 0.3;
		this.#contactBeacon.color
			.setScalar(0)
			.add(this.#palette.warning)
			.multiplyScalar(0.5 + 0.8 * (Math.sin(this.#t * 5) > 0 ? 1 : 0));

		if (t.cockpit) this.#updateCockpit(s, a, dt);
	}

	#pendingYaw = 0;

	#animateParts(t: PartTargets, dt: number) {
		const P = this.#parts;
		this.#gear = toward(this.#gear, t.gear, dt * 0.75);
		this.#bay = toward(this.#bay, t.bayDoors, dt * 0.6);
		this.#ramp = toward(this.#ramp, t.ramp, dt * 0.5);
		this.#turrets = toward(this.#turrets, t.turrets, dt * 1.6);
		this.#glow = approach(this.#glow, t.glow, 4, dt);
		this.#gold = approach(this.#gold, t.glowGold, 4, dt);
		this.#running = approach(this.#running, t.running, 6, dt);
		this.#nose = approach(this.#nose, t.nose, 6, dt);
		this.#emissive = approach(this.#emissive, t.emissive, 3, dt);
		this.#heat = approach(this.#heat, t.heat, 1.5, dt);

		const pose = gearPose(this.#gear);
		for (const id of ['FL', 'FR', 'RL', 'RR']) {
			P[`gear${id}`].rotation.x = -OPEN_ANGLE.gearLeg * (1 - pose.leg);
			const door = P[`gearDoor${id}`];
			door.rotation.z = door.userData.openSign * OPEN_ANGLE.gearDoor * pose.door;
		}
		for (const id of ['bayDoorL', 'bayDoorR']) {
			P[id].rotation.z = P[id].userData.openSign * OPEN_ANGLE.bayDoor * this.#bay;
		}
		P.rampDoor.rotation.x = OPEN_ANGLE.ramp * this.#ramp;
		for (const id of ['turretL', 'turretR']) {
			P[id].position.z = P[id].userData.stowedZ - TURRET_TRAVEL * this.#turrets;
		}
		const tilt = -ringTilt(this.#yawRate);
		P.ringL.rotation.y = approach(P.ringL.rotation.y, tilt, 6, dt);
		P.ringR.rotation.y = P.ringL.rotation.y;

		// Glow: violet at idle through gold at boost; cut by silent running.
		const p = this.#palette;
		const e = this.#emissive;
		const g = this.#glow;
		const heat = this.#heat * (0.85 + 0.15 * Math.sin(this.#t * 9));
		// Idle burns a deep amber inside; boost is full gold.
		const glowColor = _color.copy(p.gold).lerp(p.warning, 0.55).lerp(p.gold, this.#gold);
		this.#mat.glow.color.copy(glowColor).multiplyScalar(g * 1.5);
		this.#mat.core.color
			.set('#FFF4D6')
			.lerp(p.gold, 1 - this.#gold)
			.multiplyScalar(g * 2.1);
		this.#mat.halo.color.copy(glowColor);
		this.#mat.halo.opacity = Math.min(1, g * 0.75);
		for (const halo of this.#halos) {
			halo.visible = g > 0.02;
			halo.scale.setScalar(4 + g * 6);
		}
		this.#mat.running.color
			.copy(p.violetBright)
			.multiplyScalar(this.#running * (0.85 + 0.25 * Math.sin(this.#t * 3)));
		this.#mat.nose.color.copy(p.gold).multiplyScalar((0.15 + this.#nose * 1.1) * e);
		this.#noseSpot.intensity = this.#nose * 900;
		this.#mat.tail.color.copy(p.amber).multiplyScalar(0.25 + 0.95 * e);
		this.#mat.stripe.emissiveIntensity = 0.35 * e;
		this.#mat.violet.emissiveIntensity = 0.25 * e;
		this.#mat.ring.emissiveIntensity = 0.12 * e;
		// Heat: a warm tint on the hull and rings as it climbs.
		this.#mat.hull.emissive.copy(p.warning).multiplyScalar(heat * 0.35);
		this.#mat.ring.emissive.copy(p.violet).lerp(p.warning, heat * 0.7);
	}

	#effects(
		t: PartTargets,
		events: { chaff: boolean; heatSink: boolean },
		shipQ: Quaternion,
		dt: number,
		reduced: boolean
	) {
		const world = _world;
		this.#fireClock -= dt;
		this.#fire2Clock -= dt;
		if (t.fire && this.#turrets > 0.6 && this.#fireClock <= 0) {
			this.#fireClock = 0.07;
			this.#muzzleSide = 1 - this.#muzzleSide;
			this.#muzzles[this.#muzzleSide].getWorldPosition(world);
			this.#fx.fire(world, shipQ, this.#velocity, false);
		}
		if (t.fire2 && this.#turrets > 0.6 && this.#fire2Clock <= 0) {
			this.#fire2Clock = 0.18;
			for (const muzzle of this.#muzzles) {
				muzzle.getWorldPosition(world);
				this.#fx.fire(world, shipQ, this.#velocity, true);
			}
		}
		if (events.chaff) {
			this.#ship.localToWorld(world.copy(m(-25, 0, 0)));
			this.#fx.chaff(world, this.#velocity, reduced);
		}
		if (events.heatSink) {
			this.#ship.localToWorld(world.copy(m(-21, 0, 2.2)));
			this.#fx.puff(world, _v.copy(UP).applyQuaternion(shipQ), this.#velocity);
		}
	}

	#cameraUpdate(t: PartTargets, pathQ: Quaternion, shipQ: Quaternion, dt: number, orbit: number) {
		const cam = this.camera;
		const cockpit = t.cockpit;
		this.#cockpit.group.visible = cockpit;
		// From the seat the windshield is simply clear: skipping the glass saves a
		// full-screen transparent pass.
		this.#parts.canopyGlass.visible = !cockpit;
		const fov = cockpit ? COCKPIT.fov : CHASE.fov;
		if (cam.fov !== fov) {
			cam.fov = fov;
			cam.updateProjectionMatrix();
		}
		if (cockpit) {
			cam.position.copy(EYE_POS).applyQuaternion(shipQ).add(this.#ship.position);
			cam.quaternion.copy(shipQ).multiply(COCKPIT_TILT);
			this.#camQ.copy(pathQ);
		} else {
			this.#camQ.slerp(pathQ, 1 - Math.exp(-3.5 * dt));
			if (orbit) {
				const q = _q
					.copy(pathQ)
					.multiply(new Quaternion().setFromAxisAngle(UP, (orbit * Math.PI) / 180));
				cam.position.copy(CHASE.offset).applyQuaternion(q);
				cam.lookAt(0, 0, 0);
				return;
			}
			cam.position.copy(CHASE.offset).applyQuaternion(this.#camQ);
			cam.quaternion.copy(this.#camQ).multiply(CHASE_TILT);
			if (t.shake > 0) {
				cam.position.x += (Math.random() - 0.5) * t.shake;
				cam.position.y += (Math.random() - 0.5) * t.shake;
			}
		}
		// The contact holds the HUD bracket's spot on screen.
		const tan = Math.tan(((cam.fov / 2) * Math.PI) / 180);
		const nx = (CONTACT_PX.x / CONTACT_PX.w) * 2 - 1;
		const ny = 1 - (CONTACT_PX.y / CONTACT_PX.h) * 2;
		this.#contact.position
			.set(nx * tan * cam.aspect, ny * tan, -1)
			.multiplyScalar(CONTACT_PX.range);
	}

	#updateCockpit(s: FlightState, a: Analog, dt: number) {
		const c = this.#cockpit;
		const pitch = a.has.pitch ? a.pitch : this.#trim / 0.12;
		const roll = a.has.roll ? a.roll : this.#bank / MAX_BANK;
		c.stick.rotation.x = approach(
			c.stick.rotation.x,
			Math.max(-1, Math.min(1, pitch)) * 0.32,
			12,
			dt
		);
		c.stick.rotation.z = approach(
			c.stick.rotation.z,
			-Math.max(-1, Math.min(1, roll)) * 0.32,
			12,
			dt
		);
		c.throttle.position.z = approach(
			c.throttle.position.z,
			c.throttle.userData.idleZ - c.throttleTravel * s.thr,
			10,
			dt
		);
		const e = this.#emissive;
		c.arch.color.copy(this.#palette.violet).multiplyScalar(0.4 + 0.9 * e);
		c.archCore.color.copy(this.#palette.gold).multiplyScalar(0.3 + 0.9 * e);
		for (const mat of c.screenMaterials) mat.color.setScalar(0.35 + 0.65 * e);

		this.#screenClock -= dt;
		const speed = shipHud(s).spd;
		const key = `${s.thr}|${s.pips.join()}|${Math.round(s.heat * 50)}|${Math.round(speed / 5)}`;
		if (key !== this.#screenKey && this.#screenClock <= 0) {
			this.#screenKey = key;
			this.#screenClock = 0.1;
			drawScreens(c, this.#palette, { thr: s.thr, pips: s.pips, heat: s.heat, speed });
		}
	}

	dispose() {
		/* The engine disposes the whole scene graph. */
	}
}
