import type { FlightState } from '../flight.ts';
import type { Analog } from './analog.ts';

/**
 * SRV flight state → what the Wick LR's parts and the drive model should be heading for.
 * Pure, like `targets.ts` for the ship: the scene eases toward these every frame.
 *
 * Units are metres, seconds and radians. Steering is positive to the left (three.js
 * turns +Y anticlockwise seen from above, and the nose is -Z).
 */

/** Front-wheel lock at full steer: about ±20°, per the brief. */
export const MAX_STEER = (20 * Math.PI) / 180;
/** The HUD's top speed (`tick()` eases `sSpd` toward `sThr × 28`), in m/s. */
export const MAX_SPEED = 28;
/** Below this fuel fraction the spare cell's gold seam pulses. */
export const LOW_FUEL = 0.25;
/** `act('jets')` sets `jetT` to this many ticks. */
export const JET_TICKS = 16;

export interface SrvTargets {
	/** Front-wheel yaw, radians, positive left. */
	steer: number;
	/** Forward speed to hold, m/s (negative in reverse). */
	speed: number;
	/** How fast the scene's speed follows `speed`, per second. */
	follow: number;
	/** How fast sideways slip dies away, per second: high with drive assist, low without. */
	grip: number;
	/** Most sideways acceleration, m/s²: caps the turn rate at speed. Off, it turns in harder. */
	lateral: number;
	/** The hop jets are firing (vertical thrusters, the SRV's jump). */
	jets: boolean;
	/** Jet core brightness: dim violet at idle, bright violet when firing. */
	jetGlow: number;
	/** Plume length, 0..1: full when the jets fire, shrinking as the burst runs out. */
	plume: number;
	/** Upward thrust from the jets, m/s². */
	thrust: number;
	/** Headlights: nose lamps' floodlights and the cabin strip, 0..1. */
	headlights: number;
	/** The nose lamps' and cabin strip's own glow (they idle dim with headlights off). */
	lamps: number;
	/** Tail strip brightness: running, brighter on brake or reverse. */
	tail: number;
	braking: boolean;
	reversing: boolean;
	/** Low fuel: the spare cell's seam pulses. */
	cellPulse: boolean;
	/** Dust kicked up, as a share of the full effect (lower with reduced motion). */
	dust: number;
	/** Camera shake amplitude in metres (0 with reduced motion). */
	shake: number;
	/** The driver's seat camera rather than the chase camera. */
	driver: boolean;
	/** Turret mode: the roof turret rises and aims at the HUD's reticle. */
	turret: boolean;
	/** Primary and secondary turret fire, this tick. */
	fire: boolean;
	fire2: boolean;
}

export interface SrvOptions {
	reducedMotion?: boolean;
}

export const JET_GLOW = { idle: 0.32, firing: 1.8 } as const;
export const TAIL = { running: 0.45, bright: 1.25 } as const;
/** Upward jet thrust, m/s², against the surface's gravity (see drive.ts). */
export const JET_THRUST = 6.5;

/** The mock flight's per-tick catch-up (`tick()` in flight.ts) as a per-second rate. */
function perSecond(perTick: number): number {
	return -Math.log(1 - perTick) / 0.05;
}

/** Front-wheel yaw: a bound steering axis drives it directly, the steer binds by steps. */
export function wheelYaw(s: FlightState, analog?: Analog): number {
	if (analog?.has.steer && analog.steer !== 0) return -analog.steer * MAX_STEER;
	return s.steerT > 0 ? -s.steerDir * MAX_STEER : 0;
}

/** A bound drive axis off its rest wins over the digital speed steps. */
export function analogDrive(analog?: Analog): boolean {
	return Boolean(analog?.has.drive && analog.drive > 0);
}

export function srvTargets(s: FlightState, analog?: Analog, options: SrvOptions = {}): SrvTargets {
	const reduced = options.reducedMotion ?? false;
	const jets = s.jetT > 0;
	const reversing = s.sThr < 0;
	const braking = s.sThr === 0 && Math.abs(s.sSpd) > 0.5;
	const lit = s.sLights ? 1 : 0;
	const drive = analogDrive(analog);
	return {
		steer: wheelYaw(s, analog),
		// Digital: the mock flight already eases sSpd, so the scene follows it closely.
		speed: drive ? (analog?.drive ?? 0) * MAX_SPEED : s.sSpd,
		follow: drive ? perSecond(0.08) : 8,
		grip: s.daOff ? 1.1 : 9,
		lateral: s.daOff ? 14 : 8,
		jets,
		jetGlow: jets ? JET_GLOW.firing : JET_GLOW.idle,
		plume: jets ? Math.min(1, 0.35 + (0.65 * s.jetT) / JET_TICKS) : 0,
		thrust: jets ? JET_THRUST : 0,
		headlights: lit,
		lamps: 0.18 + 0.95 * lit,
		tail: braking || reversing ? TAIL.bright : TAIL.running,
		braking,
		reversing,
		cellPulse: s.fuel < LOW_FUEL,
		dust: reduced ? 0.35 : 1,
		shake: reduced ? 0 : jets ? 0.025 : 0,
		driver: s.cam === 'cockpit',
		turret: s.turret,
		fire: s.turret && s.fireT > 0,
		fire2: s.turret && s.fire2T > 0
	};
}

/**
 * The roof turret. It isn't on the v0.4 board: it follows the SRV placeholder's turret
 * (StandFly), a roof mount with one long barrel aimed at the HUD's reticle.
 */
export const TURRET = {
	/** How far the turret rises out of the deck, metres. */
	lift: 0.32,
	/** Stowed, it faces aft over the roof rack. */
	stowedYaw: Math.PI,
	maxPitch: (35 * Math.PI) / 180,
	/** Lowest pitch over the cabin (front arc) and elsewhere (rack and sides). */
	minPitchFront: (-5 * Math.PI) / 180,
	minPitchRear: (-12 * Math.PI) / 180,
	/** Half-width of the front arc, where the barrel passes over the cabin glass. */
	frontArc: (70 * Math.PI) / 180
} as const;

/** Wraps an angle to -π..π. */
export function wrapAngle(a: number): number {
	return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Turret pitch, clamped so the barrel clears the cabin glass ahead and the rack behind. */
export function turretPitch(yaw: number, pitch: number): number {
	const front = Math.abs(wrapAngle(yaw)) < TURRET.frontArc;
	const min = front ? TURRET.minPitchFront : TURRET.minPitchRear;
	return Math.max(min, Math.min(TURRET.maxPitch, pitch));
}

/**
 * The turret's pose for deploy progress 0..1 and an aim (yaw relative to the nose,
 * positive left; pitch up). It rises first, then swings to the aim; stowing reverses.
 */
export function turretPose(
	progress: number,
	aimYaw: number,
	aimPitch: number
): { lift: number; yaw: number; pitch: number } {
	const p = Math.max(0, Math.min(1, progress));
	const rise = Math.min(1, p / 0.55);
	const swing = Math.max(0, (p - 0.45) / 0.55);
	const yaw = TURRET.stowedYaw + wrapAngle(aimYaw - TURRET.stowedYaw) * swing;
	return { lift: TURRET.lift * rise, yaw, pitch: turretPitch(yaw, aimPitch) * swing };
}

/** What the HUD-mirroring dash screens show. */
export interface DashData {
	speed: number;
	dir: string;
	assistOff: boolean;
	ship: string;
	shipCalled: boolean;
	fuel: number;
	cellPulse: boolean;
}
