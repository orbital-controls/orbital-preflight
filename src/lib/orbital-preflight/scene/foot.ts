import { TICK_MS } from '../flight.ts';
import { ROUNDS, SLIDE_TRAVEL, type V3 } from './tracer.ts';

/**
 * On foot: the Tracer's animation, as pure functions of the flight state and a few clocks
 * the scene keeps (seconds since the last shot, reload progress). The four key poses
 * come from PistolPoses: idle, fire, reload out, reload in. Every timing is a placeholder
 * and lives in `FOOT_ANIM`.
 */

const DEG = Math.PI / 180;

export const FOOT_ANIM = {
	fire: {
		/** The slide's trip back, and back home. */
		kick: 0.035,
		return: 0.11,
		/** The muzzle rises at the wrist, peaks, and settles. */
		recoil: 7 * DEG,
		recoilPeak: 0.045,
		settle: 0.3,
		flash: 0.09,
		/** The index finger: onto the trigger, held, and back along the frame. */
		indexIn: 0.05,
		indexHold: 0.28,
		indexOut: 0.16,
		/** The holo round's streak. */
		round: 0.12
	},
	reload: {
		/** The mock flight's reload timer, in seconds (24 ticks). */
		seconds: (24 * TICK_MS) / 1000,
		/**
		 * The forearm rolls inward: the grip's base turns in toward the player, presenting
		 * the magwell, so the spent and holo cartridges are in view. (Rolling the gun's top
		 * toward the centre instead hides the grip behind the slide from this camera.)
		 */
		roll: 40 * DEG,
		/** And lifts the gun toward the centre, in gun-frame cm. Eased back from the block-out. */
		lift: [2.0, 2.6, -3.0] as V3,
		/** And tips the muzzle up at the wrist, so the grip's base swings into view. */
		flex: 12 * DEG,
		/** Phases, as fractions of the reload. */
		rollIn: [0, 0.18],
		out: [0.12, 0.45],
		in: [0.45, 0.8],
		slide: [0.78, 0.86],
		refill: [0.8, 0.92],
		rollBack: [0.86, 1],
		/** How far the spent cartridge falls (cm) and where the hologram starts below the grip. */
		drop: 14,
		holoStart: 10
	},
	bob: {
		/** Weapon bob amplitude in cm: breathing, walking, sprinting. */
		idle: 0.12,
		walk: 0.55,
		sprint: 1.3,
		/** Cycles per second. */
		breathHz: 0.25,
		walkHz: 1.8,
		sprintHz: 2.5,
		/** The camera's head bob in metres, walking (sprint doubles it). */
		head: 0.022
	},
	sprint: { drop: 4.5, cant: 20 * DEG, pitch: -15 * DEG, ease: 6 },
	holster: { seconds: 0.32, drop: 28 },
	aim: { seconds: 0.16, worldFov: 70, adsFov: 58 },
	/** A weapon swap: down and back up. */
	swap: { seconds: 0.55 }
} as const;

/** What the viewmodel shows in one frame (three/tracer.ts applies it). */
export interface TracerPose {
	/** Slide travel back, cm. */
	slide: number;
	/** Lit (loaded) stripe segments, rear to front. */
	segments: boolean[];
	/** Muzzle up at the wrist, radians. */
	flex: number;
	/** Forearm roll, radians (positive is inward: the grip's base toward the player). */
	roll: number;
	/** Forearm offset, gun-frame cm. */
	lift: V3;
	/** Index finger: 0 on the frame, 1 on the trigger. */
	index: number;
	/** Emitter flash, 0..1. */
	flash: number;
	cartridge: { visible: boolean; drop: number; opacity: number };
	holo: { visible: boolean; below: number; opacity: number; scan: number };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (t: number) => {
	const k = clamp01(t);
	return k * k * (3 - 2 * k);
};
/** How far into the phase `[a, b]` progress `p` is, 0..1. */
export function phase(p: number, [a, b]: readonly number[]): number {
	return clamp01((p - a) / (b - a));
}

/** Slide travel back (cm). Locked back when empty; it returns during reload-in. */
export function slideOffset(sinceFire: number, ammo: number, reload: ReloadState | null): number {
	const f = FOOT_ANIM.fire;
	if (reload) {
		if (!reload.fromEmpty) return 0;
		return SLIDE_TRAVEL * (1 - smooth(phase(reload.p, FOOT_ANIM.reload.slide)));
	}
	if (ammo <= 0) return SLIDE_TRAVEL;
	if (sinceFire < f.kick) return SLIDE_TRAVEL * (sinceFire / f.kick);
	if (sinceFire < f.kick + f.return) return SLIDE_TRAVEL * (1 - (sinceFire - f.kick) / f.return);
	return 0;
}

/**
 * Which stripe segments are lit. Spent rounds go grey from the front; during reload-in
 * they refill left to right (rear first).
 */
export function segmentStates(ammo: number, reload: ReloadState | null): boolean[] {
	let lit = Math.max(0, Math.min(ROUNDS, ammo));
	if (reload) {
		const k = phase(reload.p, FOOT_ANIM.reload.refill);
		lit = Math.max(lit, Math.min(ROUNDS, Math.floor(lit + (ROUNDS - lit) * k + 1e-9)));
	}
	return Array.from({ length: ROUNDS }, (_, i) => i < lit);
}

/** The muzzle rise at the wrist after a shot, radians. */
export function recoilFlex(sinceFire: number): number {
	const f = FOOT_ANIM.fire;
	if (!Number.isFinite(sinceFire) || sinceFire < 0) return 0;
	if (sinceFire < f.recoilPeak) return f.recoil * smooth(sinceFire / f.recoilPeak);
	const t = (sinceFire - f.recoilPeak) / f.settle;
	return t >= 1 ? 0 : f.recoil * (1 - smooth(t));
}

/** The index finger's trigger pose after a shot: in, held, back out. */
export function indexPose(sinceFire: number): number {
	const f = FOOT_ANIM.fire;
	if (!Number.isFinite(sinceFire) || sinceFire < 0) return 0;
	if (sinceFire < f.indexIn) return smooth(sinceFire / f.indexIn);
	if (sinceFire < f.indexIn + f.indexHold) return 1;
	return 1 - smooth((sinceFire - f.indexIn - f.indexHold) / f.indexOut);
}

/** The emitter's gold flash after a shot; softer with reduced motion. */
export function emitterFlash(sinceFire: number, reducedMotion = false): number {
	const f = FOOT_ANIM.fire;
	if (!Number.isFinite(sinceFire) || sinceFire < 0 || sinceFire > f.flash) return 0;
	return (1 - sinceFire / f.flash) * (reducedMotion ? 0.35 : 1);
}

export interface ReloadState {
	/** Progress, 0..1. */
	p: number;
	/** The cartridge was empty when the reload began: the slide was locked back. */
	fromEmpty: boolean;
}

/** The reload's forearm roll, lift and the two cartridges, for progress `p`. */
export function reloadPose(p: number) {
	const r = FOOT_ANIM.reload;
	const k = smooth(phase(p, r.rollIn)) * (1 - smooth(phase(p, r.rollBack)));
	const out = phase(p, r.out);
	const into = phase(p, r.in);
	return {
		roll: r.roll * k,
		flex: r.flex * k,
		lift: [r.lift[0] * k, r.lift[1] * k, r.lift[2] * k] as V3,
		// The spent one slides out and fades; once the hologram is seated, the real one
		// fades back in under it.
		cartridge:
			p < r.in[1]
				? {
						visible: p < r.out[1],
						drop: r.drop * out * out,
						opacity: 1 - smooth(phase(p, [r.out[0] + 0.12, r.out[1]]))
					}
				: { visible: true, drop: 0, opacity: phase(p, [r.in[1], r.rollBack[1]]) },
		holo: {
			visible: p >= r.in[0] && p < r.rollBack[1],
			below: r.holoStart * (1 - smooth(into)),
			// Solid once seated: it fades into the real cartridge during the roll back.
			opacity: p < r.in[1] ? 1 : 1 - phase(p, [r.in[1], r.rollBack[1]]),
			scan: p >= r.in[0] && p < r.in[1] ? 1 : 0
		}
	};
}

export type Gait = 'idle' | 'walk' | 'sprint';

/** Weapon bob amplitude in cm; none with reduced motion. */
export function bobAmplitude(gait: Gait, reducedMotion: boolean): number {
	if (reducedMotion) return 0;
	return FOOT_ANIM.bob[gait];
}

/** The gait the player's horizontal speed (m/s) reads as. */
export function gaitFor(speed: number, sprinting: boolean): Gait {
	if (speed < 0.4) return 'idle';
	return sprinting ? 'sprint' : 'walk';
}

export interface PoseInput {
	/** Seconds since the last shot (Infinity: none yet). */
	sinceFire: number;
	ammo: number;
	reload: ReloadState | null;
	reducedMotion: boolean;
}

/** The viewmodel's pose from the state and clocks. */
export function tracerPose(i: PoseInput): TracerPose {
	const reload = i.reload;
	const r = reload ? reloadPose(reload.p) : null;
	return {
		slide: slideOffset(i.sinceFire, i.ammo, reload),
		segments: segmentStates(i.ammo, reload),
		flex: r ? r.flex : recoilFlex(i.sinceFire),
		roll: r?.roll ?? 0,
		lift: r?.lift ?? [0, 0, 0],
		index: reload ? 0 : indexPose(i.sinceFire),
		flash: emitterFlash(i.sinceFire, i.reducedMotion),
		cartridge: r?.cartridge ?? { visible: true, drop: 0, opacity: 1 },
		holo: r?.holo ?? { visible: false, below: FOOT_ANIM.reload.holoStart, opacity: 0, scan: 0 }
	};
}
