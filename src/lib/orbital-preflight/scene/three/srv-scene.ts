import {
	DirectionalLight,
	Euler,
	Fog,
	Group,
	HemisphereLight,
	Object3D,
	PerspectiveCamera,
	PointsMaterial,
	Quaternion,
	Vector3,
	type CanvasTexture,
	type Scene,
	type Texture
} from 'three';
import { srvHud, type FlightState } from '../../flight.ts';
import { restChassis, stepChassis, WHEELS, type Chassis } from '../drive.ts';
import { srvTargets, type DashData, type SrvTargets } from '../srv.ts';
import { approach } from '../targets.ts';
import { heightAt } from '../terrain.ts';
import { buildLantern, makeShipMaterials } from './lantern.ts';
import type { Palette } from './palette.ts';
import type { FrameInput, ModeScene } from './ship-scene.ts';
import { planet, starfield } from './space.ts';
import { Dust, FOG, Surface } from './surface.ts';
import {
	buildWick,
	DRIVER_EYE,
	makeWickMaterials,
	SUSPENSION_MOUNTS,
	w,
	type Wick,
	type WickMaterials
} from './wick.ts';

const CHASE = { back: 8.6, up: 3.3, look: 1.1, ahead: 1.6, fov: 55 };
const DRIVER = { pitch: -0.07, fov: 72 };
const DRIVER_TILT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), DRIVER.pitch);
/** A small kick when the jets light on the ground, so the hop starts at once. */
const HOP_KICK = 1.1;
/** Dust puffs per second per wheel at full speed, before the dust share. */
const DUST_RATE = 34;

const DOWN = new Vector3(0, -1, 0);
const _v = new Vector3();
const _w = new Vector3();
const _euler = new Euler();

/** The SRV view: the Wick LR driving a moon surface, from behind or from the driver's seat. */
export class SrvScene implements ModeScene {
	readonly camera = new PerspectiveCamera(CHASE.fov, 900 / 560, 0.05, 20000);
	#wick: Wick;
	#mat: WickMaterials;
	#parts: Record<string, Object3D> = {};
	#palette: Palette;
	#surface: Surface;
	#dust: Dust;
	#sky = new Group();
	#chassis: Chassis;
	#prev: FlightState | null = null;
	#last: SrvTargets | null = null;
	#t = 0;
	#dustDebt = 0;
	#shake = 0;

	// Eased look values.
	#lamps = 1;
	#headlights = 1;
	#tail = 0.45;
	#jetGlow = 0.32;
	#plume = 0;
	#camYaw = 0;
	#camY = 0;
	#screenKey = '';
	#screenClock = 0;

	constructor(
		readonly scene: Scene,
		palette: Palette,
		glow: Texture,
		options: { reducedMotion: boolean }
	) {
		this.#palette = palette;
		scene.fog = new Fog(palette.ground.clone(), FOG.near, FOG.far);

		this.#mat = makeWickMaterials(palette, glow);
		this.#wick = buildWick(palette, this.#mat);
		this.#wick.root.traverse((o) => {
			if (o.name) this.#parts[o.name] = o;
		});
		scene.add(this.#wick.root);

		// A low sun over the left shoulder of the start, so the chase camera sees the lit side.
		const sun = new DirectionalLight(0xffffff, 2.6);
		sun.position.set(-60, 55, 50);
		const fill = new DirectionalLight(palette.violetBright, 0.3);
		fill.position.set(50, 20, -30);
		scene.add(sun, fill, new HemisphereLight(palette.violetBright, palette.ground, 0.35));

		this.#surface = new Surface(palette);
		scene.add(this.#surface.group);
		this.#dust = new Dust(palette, glow, options.reducedMotion ? 160 : 420);
		scene.add(this.#dust.points);

		const stars = starfield(palette, 2200);
		(stars.material as PointsMaterial).fog = false;
		const world = planet(palette, new Vector3(-0.6, 0.5, 0.6));
		// Rising off the horizon to the right of the start, clear of the HUD panels.
		world.position.set(2900, 650, -7500);
		world.scale.setScalar(0.28);
		this.#sky.add(stars, world);
		scene.add(this.#sky);

		scene.add(lantern(palette, glow));
		scene.add(this.camera);

		this.#chassis = restChassis(heightAt);
		this.#camYaw = this.#chassis.heading;
		this.#camY = this.#chassis.y;
		this.#surface.follow(0, 0);
		this.#pose();
	}

	get root(): Object3D {
		return this.#wick.root;
	}

	targets(): null {
		return null;
	}

	/** The last frame's SRV targets, for tests and the PR's numbers. */
	srvTargets(): SrvTargets | null {
		return this.#last;
	}

	update(input: FrameInput, dt: number) {
		const s = input.flight;
		const t = srvTargets(s, input.analog, { reducedMotion: input.reducedMotion });
		this.#last = t;
		this.#t += dt;
		// Listening for a rebind freezes the vehicle; the scene still draws.
		const sim = input.frozen ? 0 : dt;
		const c = this.#chassis;

		if (this.#prev && s.jetT > this.#prev.jetT && c.contact.some(Boolean) && sim > 0)
			c.vy += HOP_KICK;
		this.#prev = s;
		const wasAir = c.air > 0;
		if (sim > 0) {
			stepChassis(
				c,
				{
					speed: t.speed,
					follow: t.follow,
					steer: t.steer,
					grip: t.grip,
					thrust: t.thrust,
					lateral: t.lateral
				},
				heightAt,
				sim
			);
		}
		if (wasAir && c.air === 0 && c.landed > 1.5 && !input.reducedMotion)
			this.#shake = Math.min(0.12, c.landed * 0.03);

		this.#pose();
		this.#lights(t, dt, input.reducedMotion);
		this.#kickDust(t, sim);
		this.#dust.update(sim);
		this.#surface.follow(c.x, c.z);
		this.#cameraUpdate(t, dt, input.orbit ?? 0);
		this.#sky.position.copy(this.camera.position);
		this.#screens(s, t, dt);
	}

	/** Poses the model from the chassis: body, wheels, arms, dampers, fenders. */
	#pose() {
		const c = this.#chassis;
		const P = this.#parts;
		const root = this.#wick.root;
		root.position.set(c.x, c.y, c.z);
		root.quaternion.setFromEuler(_euler.set(c.pitch, c.heading, c.roll, 'YXZ'));
		const M = SUSPENSION_MOUNTS;
		WHEELS.forEach((spec, i) => {
			const travel = c.travel[i];
			const wheel = P[`wheel${spec.id}`];
			wheel.position.y = wheel.userData.restY + travel;
			wheel.rotation.set(c.spin, spec.front ? c.steer : 0, 0, 'YXZ');
			P[`fender${spec.id}`].position.y = P[`fender${spec.id}`].userData.restY + travel;
			for (const name of ['armUpper', 'armLower']) {
				const arm = P[`${name}${spec.id}`];
				const k = Math.max(-1, Math.min(1, travel / arm.userData.length));
				arm.rotation.z = -arm.userData.side * Math.asin(k);
			}
			// The damper runs from its top mount to a point along the lower arm.
			const lower = P[`armLower${spec.id}`];
			const damper = P[`damper${spec.id}`];
			const reach = lower.userData.length * M.damperAt;
			_v.set(-lower.userData.side * reach, 0, 0)
				.applyAxisAngle(_w.set(0, 0, 1), lower.rotation.z)
				.add(lower.position);
			_v.z = damper.position.z;
			_v.sub(damper.position);
			const length = _v.length();
			damper.quaternion.setFromUnitVectors(DOWN, _v.divideScalar(length));
			damper.scale.y = length / damper.userData.restLength;
		});
	}

	#lights(t: SrvTargets, dt: number, reduced: boolean) {
		const p = this.#palette;
		const mat = this.#mat;
		this.#lamps = approach(this.#lamps, t.lamps, 8, dt);
		this.#headlights = approach(this.#headlights, t.headlights, 8, dt);
		this.#tail = approach(this.#tail, t.tail, 10, dt);
		this.#jetGlow = approach(this.#jetGlow, t.jetGlow, 12, dt);
		this.#plume = approach(this.#plume, t.plume, t.jets ? 18 : 7, dt);

		mat.lamp.color.copy(p.gold).multiplyScalar(this.#lamps * 1.2);
		mat.lampHalo.opacity = 0.85 * this.#headlights;
		for (const spot of this.#wick.headlights) spot.intensity = this.#headlights * 55;
		mat.strip.color.copy(p.gold).multiplyScalar(0.35 + 0.95 * this.#headlights);
		mat.tail.color.copy(p.gold).multiplyScalar(this.#tail);
		const pulse = t.cellPulse && !reduced ? 0.5 + 0.5 * Math.sin(this.#t * 5) : 1;
		mat.seam.color.copy(p.gold).multiplyScalar(t.cellPulse ? 0.3 + 1.1 * pulse : 0.8);

		// Hop jets: dim violet at idle, bright violet with a short plume when they fire.
		const g = this.#jetGlow;
		mat.jetCore.color
			.copy(p.violet)
			.lerp(p.violetBright, Math.min(1, g / 1.8))
			.multiplyScalar(g);
		mat.jetHalo.opacity = Math.min(1, 0.2 + g * 0.45);
		for (const halo of this.#wick.jetHalos) halo.scale.setScalar(0.22 + g * 0.32);
		const flicker = reduced ? 1 : 0.9 + 0.1 * Math.sin(this.#t * 47);
		for (const id of ['plumeL', 'plumeR']) {
			const plume = this.#parts[id];
			plume.visible = this.#plume > 0.02;
			plume.scale.set(
				0.8 + this.#plume * 0.4,
				0.8 + this.#plume * 0.4,
				0.75 * this.#plume * flicker
			);
		}
		mat.plume.opacity = 0.55 * Math.min(1, this.#plume * 1.5);
		mat.plumeCore.opacity = 0.85 * Math.min(1, this.#plume * 1.5);
	}

	#kickDust(t: SrvTargets, dt: number) {
		if (dt <= 0) return;
		const c = this.#chassis;
		const root = this.#wick.root;
		const rate = DUST_RATE * t.dust * Math.min(1, (Math.abs(c.speed) + Math.abs(c.slip) * 3) / 18);
		this.#dustDebt += rate * dt;
		const drift = _w.set(c.vx * 0.25, 0, c.vz * 0.25);
		while (this.#dustDebt >= 1) {
			this.#dustDebt -= 1;
			WHEELS.forEach((spec, i) => {
				if (!c.contact[i] || (spec.front && Math.abs(c.slip) < 2)) return;
				_v.set(spec.x, 0.05, spec.z + 0.35)
					.applyQuaternion(root.quaternion)
					.add(root.position);
				_v.y = heightAt(_v.x, _v.z);
				this.#dust.emit(_v, drift, 1 + Math.abs(c.speed) * 0.05);
			});
		}
	}

	#cameraUpdate(t: SrvTargets, dt: number, orbit: number) {
		const cam = this.camera;
		const c = this.#chassis;
		const driver = t.driver;
		this.#parts.cabinGlass.visible = !driver;
		const fov = driver ? DRIVER.fov : CHASE.fov;
		if (cam.fov !== fov) {
			cam.fov = fov;
			cam.updateProjectionMatrix();
		}
		this.#camYaw = approach(this.#camYaw, c.heading, 3, dt);
		this.#camY = approach(this.#camY, c.y, 4, dt);
		if (driver) {
			const root = this.#wick.root;
			cam.position
				.copy(w(...DRIVER_EYE))
				.applyQuaternion(root.quaternion)
				.add(root.position);
			cam.quaternion.copy(root.quaternion).multiply(DRIVER_TILT);
			return;
		}
		const yaw = this.#camYaw + (orbit * Math.PI) / 180;
		const sin = Math.sin(yaw);
		const cos = Math.cos(yaw);
		cam.position.set(c.x + sin * CHASE.back, this.#camY + CHASE.up, c.z + cos * CHASE.back);
		cam.position.y = Math.max(cam.position.y, heightAt(cam.position.x, cam.position.z) + 1);
		_v.set(c.x - sin * CHASE.ahead, this.#camY + CHASE.look, c.z - cos * CHASE.ahead);
		const shake = Math.max(t.shake, this.#shake);
		this.#shake = approach(this.#shake, 0, 6, dt);
		if (shake > 0.001) {
			cam.position.x += (Math.random() - 0.5) * shake;
			cam.position.y += (Math.random() - 0.5) * shake;
		}
		cam.lookAt(_v);
	}

	#screens(s: FlightState, t: SrvTargets, dt: number) {
		this.#screenClock -= dt;
		const h = srvHud(s);
		const data: DashData = {
			speed: h.spd,
			dir: h.dir,
			assistOff: h.assistOff,
			ship: h.ship,
			shipCalled: h.shipCalled,
			fuel: h.fuel,
			cellPulse: t.cellPulse
		};
		const key = JSON.stringify(data);
		if (key === this.#screenKey || this.#screenClock > 0) return;
		this.#screenKey = key;
		this.#screenClock = 0.15;
		drawDash(this.#wick.screens, this.#palette, data);
	}

	dispose() {
		/* The engine disposes the whole scene graph. */
	}
}

/** The Lantern II hovering beyond the start, gear down: reused from the ship scene. */
function lantern(p: Palette, glow: Texture): Object3D {
	const mat = makeShipMaterials(p, glow);
	const ship = buildLantern(p, mat);
	ship.noseSpot.visible = false;
	ship.root.traverse((o) => {
		if (/^gear(FL|FR|RL|RR)$/.test(o.name)) o.rotation.x = 0;
		if (/^gearDoor/.test(o.name)) o.rotation.z = o.userData.openSign * ((100 * Math.PI) / 180);
	});
	mat.glow.color.copy(p.gold).multiplyScalar(0.5);
	mat.core.color.copy(p.gold).multiplyScalar(0.8);
	for (const halo of ship.halos) halo.scale.setScalar(5);
	mat.halo.opacity = 0.35;
	// [Placeholder scale] About 26 m long beside the 5.4 m Wick LR.
	ship.root.scale.setScalar(0.55);
	ship.root.position.set(24, heightAt(24, -88) + 12, -88);
	ship.root.rotation.y = -0.6;
	ship.root.updateMatrixWorld(true);
	ship.root.traverse((o) => (o.matrixAutoUpdate = false));
	return ship.root;
}

/** The dash screens, mirroring the HUD: Drive (violet), Recall (gold), Range (violet). */
export function drawDash(
	screens: { drive: CanvasTexture; recall: CanvasTexture; range: CanvasTexture },
	p: Palette,
	d: DashData
) {
	const violet = `#${p.violetBright.getHexString()}`;
	const gold = `#${p.gold.getHexString()}`;
	const ink = '#E6E8F6';
	const draw = (
		tex: CanvasTexture,
		fn: (g: CanvasRenderingContext2D, w: number, h: number) => void
	) => {
		const canvas = tex.image as HTMLCanvasElement;
		const g = canvas.getContext('2d');
		if (!g) return;
		g.fillStyle = '#0B0D22';
		g.fillRect(0, 0, canvas.width, canvas.height);
		g.font = 'bold 18px monospace';
		g.textBaseline = 'alphabetic';
		fn(g, canvas.width, canvas.height);
		tex.needsUpdate = true;
	};
	draw(screens.drive, (g) => {
		g.fillStyle = violet;
		g.fillText('DRIVE', 14, 26);
		g.fillText(d.dir.toUpperCase(), 140, 26);
		g.font = 'bold 54px monospace';
		g.fillStyle = ink;
		g.fillText(String(d.speed), 14, 92);
		g.font = 'bold 16px monospace';
		g.fillStyle = violet;
		g.fillText('M/S', 130, 92);
		g.fillStyle = d.assistOff ? gold : violet;
		g.fillText(d.assistOff ? 'DA OFF' : 'DA ON', 14, 118);
	});
	draw(screens.recall, (g, width) => {
		g.fillStyle = gold;
		g.textAlign = 'center';
		g.fillText('RECALL', width / 2, 26);
		g.font = 'bold 26px monospace';
		g.fillStyle = d.shipCalled ? gold : ink;
		g.fillText(d.shipCalled ? 'INBOUND' : 'IN ORBIT', width / 2, 80);
		g.textAlign = 'start';
	});
	draw(screens.range, (g) => {
		g.fillStyle = violet;
		g.fillText('RANGE', 14, 26);
		g.fillText(`${d.fuel}%`, 180, 26);
		g.fillStyle = 'rgba(139,136,255,0.2)';
		g.fillRect(14, 40, 228, 18);
		g.fillStyle = d.cellPulse ? gold : violet;
		g.fillRect(14, 40, (228 * d.fuel) / 100, 18);
		g.font = 'bold 16px monospace';
		g.fillStyle = d.cellPulse ? gold : ink;
		g.fillText(d.cellPulse ? 'SPARE CELL READY' : 'SPARE CELL', 14, 96);
	});
}
