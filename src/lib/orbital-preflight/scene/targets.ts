import type { FlightState } from '../flight.ts';

/**
 * Flight state → where the ship's moving parts should be heading. Pure, so the mapping
 * is tested without WebGL; the renderer eases each part toward its target every frame.
 *
 * Progress values are 0..1 (0 stowed or closed, 1 deployed or open). Angles are radians.
 */

export interface PartTargets {
	/** Landing gear: doors open first, then the four legs swing down. */
	gear: number;
	/** Roof cargo-bay doors: open with the cargo scoop. */
	bayDoors: number;
	/** The tail ramp: drops when landed (gear down, throttle at zero). */
	ramp: number;
	/** Turrets slide out of the ring fronts with hardpoints deployed. */
	turrets: number;
	/** Ring glow, 0 (cut) to about 1.6 (boost or supercruise). */
	glow: number;
	/** How far the glow has gone from violet toward full gold, 0..1. */
	glowGold: number;
	/** Ring running lights and the nose floodlight, 0..1. */
	running: number;
	nose: number;
	/** Every emissive, scaled: silent running dims them. */
	emissive: number;
	/** Heat tint on the hull and rings, 0 (cool) to 1 (overheating). */
	heat: number;
	/** World speed, units per second (1 unit = 10 px of the 2D sheet). */
	speed: number;
	/** How fast velocity catches up with the nose, per second. Low with flight assist off. */
	follow: number;
	/** Dust streak length, in seconds of travel. */
	streak: number;
	/** Bank from the digital roll binds, radians. */
	bank: number;
	/** Nose trim from vertical thrust, radians, and the matching drift up or down (units/s). */
	trim: number;
	lift: number;
	/** Camera shake amplitude in units (0 with reduced motion). */
	shake: number;
	/** Primary and secondary fire, this tick. */
	fire: boolean;
	fire2: boolean;
	nightVision: boolean;
	cockpit: boolean;
}

export interface TargetOptions {
	reducedMotion?: boolean;
}

/** Speed scale: the mock flight's speed units to world units per second. */
export const SPEED_SCALE = 22;
export const MAX_BANK = (32 * Math.PI) / 180;
export const MAX_TRIM = (7 * Math.PI) / 180;
/** Ring tilt at full yaw rate (the 2D sheet's callout: the rings tilt slightly with yaw). */
export const MAX_RING_TILT = (12 * Math.PI) / 180;
/** Yaw rate that gives the full ring tilt, radians per second. */
export const FULL_YAW_RATE = (60 * Math.PI) / 180;

/** The mock flight's per-tick catch-up (`tick()` in flight.ts) as a per-second rate. */
function perSecond(perTick: number): number {
	return -Math.log(1 - perTick) / 0.05;
}

export function shipSpeed(s: FlightState): number {
	return s.thr * (s.boostT > 0 ? 2.2 : 1) * (s.sc ? 3 : 1) * 4 * SPEED_SCALE;
}

/** Landed, as far as the mock flight knows: gear down and throttle at zero. */
export function landed(s: FlightState): boolean {
	return s.gear && s.thr === 0;
}

export function partTargets(s: FlightState, options: TargetOptions = {}): PartTargets {
	const boost = s.boostT > 0;
	const dim = s.silent ? 0.18 : 1;
	const glow = s.silent ? 0 : boost ? 1.6 : s.sc ? 1.35 : s.thr === 0 ? 0.12 : 0.25 + s.thr * 0.85;
	const heat = Math.max(0, Math.min(1, (s.heat - 0.45) / 0.45));
	const reduced = options.reducedMotion ?? false;
	return {
		gear: s.gear ? 1 : 0,
		bayDoors: s.scoop ? 1 : 0,
		ramp: landed(s) ? 1 : 0,
		turrets: s.hp ? 1 : 0,
		glow,
		glowGold: boost ? 1 : s.sc ? 0.75 : Math.min(1, 0.25 + s.thr * 0.6),
		running: s.lights ? dim : 0,
		nose: s.lights && !s.silent ? 1 : 0,
		emissive: dim,
		heat,
		speed: shipSpeed(s),
		follow: perSecond(s.faOff ? 0.03 : 0.22),
		streak: (s.sc ? 0.09 : boost ? 0.05 : 0.025) * (reduced ? 0.5 : 1),
		bank: s.rollT > 0 ? s.rollDir * MAX_BANK : 0,
		trim: s.altT > 0 ? s.altDir * MAX_TRIM : 0,
		lift: s.altT > 0 ? s.altDir * 6 : 0,
		shake: reduced ? 0 : boost ? 0.12 : s.sc ? 0.05 : 0,
		fire: s.fireT > 0,
		fire2: s.fire2T > 0,
		nightVision: s.nv,
		cockpit: s.cam === 'cockpit'
	};
}

/** Ring tilt from the ship's yaw rate (radians per second), signed with the turn. */
export function ringTilt(yawRate: number): number {
	const t = Math.max(-1, Math.min(1, yawRate / FULL_YAW_RATE));
	return t * MAX_RING_TILT;
}

/** Gear doors open over the first 40 % of the travel, the legs swing down over the rest. */
export function gearPose(progress: number): { door: number; leg: number } {
	const p = Math.max(0, Math.min(1, progress));
	return { door: Math.min(1, p / 0.4), leg: Math.max(0, (p - 0.3) / 0.7) };
}

/** Open angles of the hinged parts at progress 1. */
export const OPEN_ANGLE = {
	gearDoor: (100 * Math.PI) / 180,
	/** A leg is stowed lying aft, flat in the belly, and swings down to vertical. */
	gearLeg: Math.PI / 2,
	bayDoor: (115 * Math.PI) / 180,
	ramp: (78 * Math.PI) / 180
} as const;

/** How far the turrets slide forward out of the ring fronts, in units. */
export const TURRET_TRAVEL = 1.8;

/** Ease `current` toward `target` at `rate` per second (exponential, frame-rate independent). */
export function approach(current: number, target: number, rate: number, dt: number): number {
	return target + (current - target) * Math.exp(-rate * dt);
}

/** One-off effects to start between two flight states. */
export interface FlightEvents {
	chaff: boolean;
	heatSink: boolean;
	/** Heading change from the digital yaw binds, degrees. */
	yaw: number;
}

export function flightEvents(prev: FlightState, next: FlightState): FlightEvents {
	return {
		chaff: next.chaffT > prev.chaffT,
		heatSink: prev.heat - next.heat > 0.05 && next.heat < 0.02,
		yaw: next.a - prev.a
	};
}
