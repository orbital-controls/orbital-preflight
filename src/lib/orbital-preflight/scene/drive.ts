/**
 * The Wick LR's drive model: kinematic, no physics engine. One ground-height query under
 * each wheel, a spring and damper per wheel on the ride height (which gives heave, pitch
 * and roll), and bicycle-model steering on the ground. Pure TS and deterministic, so
 * it is tested without WebGL; the scene poses the model from the `Chassis` it returns.
 *
 * World frame: three.js, +Y up, metres. `heading` 0 faces -Z and turning left increases
 * it. Pitch is positive nose up, roll positive with the right side up.
 */

export type Ground = (x: number, z: number) => number;

/** Wheel geometry from the block-out: centres x 1.06 and 4.32, y ±1.36, z 0.52. */
export const WHEEL_RADIUS = 0.52;
export const WHEELBASE = 4.32 - 1.06;
export const HALF_TRACK = 1.36;
/** Where the model's origin sits along the body (block-out x), between the axles. */
export const ORIGIN_X = (4.32 + 1.06) / 2;

export interface WheelSpec {
	id: 'FL' | 'FR' | 'RL' | 'RR';
	/** Chassis-local position (three.js: +X right, -Z forward), at rest. */
	x: number;
	z: number;
	front: boolean;
	/** +1 on the left (driver's) side, -1 on the right. */
	side: 1 | -1;
}

export const WHEELS: readonly WheelSpec[] = [
	{ id: 'FL', x: -HALF_TRACK, z: -WHEELBASE / 2, front: true, side: 1 },
	{ id: 'FR', x: HALF_TRACK, z: -WHEELBASE / 2, front: true, side: -1 },
	{ id: 'RL', x: -HALF_TRACK, z: WHEELBASE / 2, front: false, side: 1 },
	{ id: 'RR', x: HALF_TRACK, z: WHEELBASE / 2, front: false, side: -1 }
];

/** Surface gravity, m/s². [Placeholder: a low-g moon so the hop jets read.] */
export const GRAVITY = 3.2;

/**
 * Per wheel, per unit of vehicle mass. Heave settles at about 1.6 Hz, a little under
 * critically damped. No wheel goes past its bump stop (see `MAX_LIFT`).
 */
export const SUSPENSION = {
	/** Wheel travel down (droop) and up (bump) from rest, metres. */
	droop: 0.2,
	bump: 0.18,
	stiffness: 26,
	damping: 3.4
} as const;
const PRELOAD = GRAVITY / (4 * SUSPENSION.stiffness);
/** Pitch and roll inertia per unit mass, m² (a 5.4 × 2.1 × 1.2 m box, roughly). */
const INERTIA = { pitch: 2.4, roll: 1.1 };
const ANGULAR_DRAG = 0.6;
/** In the air the SRV eases back toward level (pitch and roll per second²), as drive assist does in the sims. */
const AIR_LEVEL = { spring: 5, drag: 2.5 };
const STEER_RATE = 7;
/**
 * A hard hit (a ramp edge, a rock at full speed) mustn't fling the chassis: the damper
 * sees at most this rate, and past the bump stop the chassis is lifted rather than
 * pushed, rising no faster than `MAX_LIFT`.
 */
const MAX_DAMPER_RATE = 6;
const MAX_LIFT = 4;
const MAX_RISE = 9;
const STEP = 1 / 120;

export interface Chassis {
	x: number;
	z: number;
	/** Height of the model's origin (ground level at rest). */
	y: number;
	heading: number;
	vx: number;
	vy: number;
	vz: number;
	pitch: number;
	pitchRate: number;
	roll: number;
	rollRate: number;
	/** Eased front-wheel yaw. */
	steer: number;
	/** Wheel roll angle, radians (negative rolls forward). */
	spin: number;
	/** Forward and sideways speed in the chassis frame, m/s. */
	speed: number;
	slip: number;
	/** Each wheel's travel from rest, metres: positive pushed up, negative drooping. */
	travel: [number, number, number, number];
	contact: [boolean, boolean, boolean, boolean];
	/** Raw compression last step, for the dampers. */
	comp: [number, number, number, number];
	/** Seconds since all four wheels left the ground (0 on the ground). */
	air: number;
	/** Downward speed at the last touchdown, m/s, for a landing bump. */
	landed: number;
}

export interface DriveInput {
	/** Forward speed to hold, m/s. */
	speed: number;
	/** Per-second rate the speed follows it. */
	follow: number;
	/** Front-wheel yaw to steer toward, radians, positive left. */
	steer: number;
	/** Per-second decay of sideways slip. */
	grip: number;
	/** Upward thrust, m/s². */
	thrust: number;
	/** The most sideways acceleration the tyres give, m/s²: caps the turn rate at speed. */
	lateral?: number;
}

/** Travel from a raw compression: what the wheel and its fender show. */
export function wheelTravel(compression: number): number {
	return Math.max(-SUSPENSION.droop, Math.min(SUSPENSION.bump, compression));
}

/** World X, Z of a chassis-local point at this heading. */
function place(c: Chassis, lx: number, lz: number): [number, number] {
	const cos = Math.cos(c.heading);
	const sin = Math.sin(c.heading);
	return [c.x + lx * cos + lz * sin, c.z - lx * sin + lz * cos];
}

/** World height of a wheel's rest centre for the chassis pose (small-angle tilt). */
function hubHeight(c: Chassis, w: WheelSpec): number {
	return c.y + WHEEL_RADIUS + w.x * Math.sin(c.roll) - w.z * Math.sin(c.pitch);
}

/**
 * Each wheel's raw compression for the chassis as posed over `ground`: how far the
 * ground pushes the wheel up from its rest position (negative: the wheel hangs).
 */
export function compressions(c: Chassis, ground: Ground): [number, number, number, number] {
	return WHEELS.map((w) => {
		const [gx, gz] = place(c, w.x, w.z);
		return ground(gx, gz) + WHEEL_RADIUS - hubHeight(c, w);
	}) as [number, number, number, number];
}

/** Suspension targets: each wheel's travel for the chassis as posed over `ground`. */
export function suspensionTargets(c: Chassis, ground: Ground): [number, number, number, number] {
	return compressions(c, ground).map(wheelTravel) as [number, number, number, number];
}

/** A chassis at rest on `ground` at (x, z), facing `heading`. */
export function restChassis(ground: Ground, x = 0, z = 0, heading = 0): Chassis {
	const c: Chassis = {
		x,
		z,
		y: 0,
		heading,
		vx: 0,
		vy: 0,
		vz: 0,
		pitch: 0,
		pitchRate: 0,
		roll: 0,
		rollRate: 0,
		steer: 0,
		spin: 0,
		speed: 0,
		slip: 0,
		travel: [0, 0, 0, 0],
		contact: [true, true, true, true],
		comp: [0, 0, 0, 0],
		air: 0,
		landed: 0
	};
	const heights = WHEELS.map((w) => ground(...place(c, w.x, w.z)));
	c.y = heights.reduce((a, b) => a + b, 0) / 4;
	c.comp = compressions(c, ground);
	return c;
}

/** Advances `c` by `dt` seconds, in fixed sub-steps. Mutates and returns `c`. */
export function stepChassis(c: Chassis, input: DriveInput, ground: Ground, dt: number): Chassis {
	const steps = Math.max(1, Math.ceil(dt / STEP - 1e-9));
	const h = dt / steps;
	for (let i = 0; i < steps; i++) subStep(c, input, ground, h);
	return c;
}

function subStep(c: Chassis, input: DriveInput, ground: Ground, dt: number) {
	const S = SUSPENSION;
	const comp = compressions(c, ground);
	// The bump stop: lift the chassis so no wheel is pushed past it.
	const excess = Math.max(0, ...comp.map((v) => v - S.bump));
	if (excess > 0) {
		c.y += excess;
		c.vy = Math.max(c.vy, Math.min(MAX_LIFT, excess / dt));
		for (let i = 0; i < 4; i++) comp[i] -= excess;
	}
	let heave = input.thrust - GRAVITY;
	let pitchTorque = 0;
	let rollTorque = 0;
	let touching = 0;
	for (let i = 0; i < 4; i++) {
		const w = WHEELS[i];
		const rate = clamp((comp[i] - c.comp[i]) / dt, -MAX_DAMPER_RATE, MAX_DAMPER_RATE);
		const contact = comp[i] > -S.droop;
		let force = 0;
		if (contact) {
			force = Math.max(0, S.stiffness * (comp[i] + PRELOAD) + S.damping * rate);
			touching++;
		}
		heave += force;
		pitchTorque += force * -w.z;
		rollTorque += force * w.x;
		c.contact[i] = contact;
		c.travel[i] = wheelTravel(comp[i]);
	}
	c.comp = comp;

	if (touching > 0 && c.air > 0) c.landed = Math.max(0, -c.vy);
	c.air = touching > 0 ? 0 : c.air + dt;

	c.vy = Math.min(MAX_RISE, c.vy + heave * dt);
	c.pitchRate += (pitchTorque / INERTIA.pitch - ANGULAR_DRAG * c.pitchRate) * dt;
	c.rollRate += (rollTorque / INERTIA.roll - ANGULAR_DRAG * c.rollRate) * dt;
	if (touching === 0) {
		c.pitchRate -= (AIR_LEVEL.spring * c.pitch + AIR_LEVEL.drag * c.pitchRate) * dt;
		c.rollRate -= (AIR_LEVEL.spring * c.roll + AIR_LEVEL.drag * c.rollRate) * dt;
	}
	c.y += c.vy * dt;
	c.pitch = clamp(c.pitch + c.pitchRate * dt, -0.6, 0.6);
	c.roll = clamp(c.roll + c.rollRate * dt, -0.6, 0.6);

	c.steer += (input.steer - c.steer) * (1 - Math.exp(-STEER_RATE * dt));

	// Ground handling: the wheels hold the speed and kill sideways slip, as hard as the
	// grip allows. In the air the velocity carries.
	const fx = -Math.sin(c.heading);
	const fz = -Math.cos(c.heading);
	const lx = -Math.cos(c.heading);
	const lz = Math.sin(c.heading);
	let forward = c.vx * fx + c.vz * fz;
	let side = c.vx * lx + c.vz * lz;
	if (touching > 0) {
		const traction = touching / 4;
		forward += (input.speed - forward) * (1 - Math.exp(-input.follow * traction * dt));
		side *= Math.exp(-input.grip * traction * dt);
		let yawRate = (forward * Math.tan(c.steer)) / WHEELBASE;
		const lateral = input.lateral ?? Infinity;
		if (Math.abs(forward) > 0.5) {
			const most = lateral / Math.abs(forward);
			yawRate = clamp(yawRate, -most, most);
		}
		c.heading += yawRate * traction * dt;
	}
	c.vx = fx * forward + lx * side;
	c.vz = fz * forward + lz * side;
	c.x += c.vx * dt;
	c.z += c.vz * dt;
	c.speed = forward;
	c.slip = side;
	c.spin -= (forward / WHEEL_RADIUS) * dt;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}
