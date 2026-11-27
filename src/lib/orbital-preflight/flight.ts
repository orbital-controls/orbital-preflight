import type { Mode } from './types.ts';

/**
 * The mock flight, ported from the StandFly board's `act()`, `tick()` and `pip()`.
 *
 * Pure: every function takes a state and returns a new one. The HUD, the toasts and the
 * status chips read it, and so will the 3D scene: it receives this state and the mode,
 * renders, and reports nothing back.
 *
 * Timers (`boostT`, `fireT`…) count ticks; the page ticks every `TICK_MS`.
 */

export const TICK_MS = 50;

/** Rounds in a Tracer P1 cartridge: one stripe segment each. */
export const TRACER_ROUNDS = 6;

/** The ship view's camera: behind the ship, or from the pilot's seat. */
export type CameraView = 'chase' | 'cockpit';

export interface FlightState {
	// shared
	msg: string;
	msgT: number;
	tgt: boolean;
	fireT: number;
	fire2T: number;
	pips: [number, number, number];
	// ship
	a: number;
	thr: number;
	vx: number;
	vy: number;
	boostT: number;
	chaffT: number;
	rollT: number;
	rollDir: number;
	altT: number;
	altDir: number;
	heat: number;
	gear: boolean;
	hp: boolean;
	lights: boolean;
	faOff: boolean;
	silent: boolean;
	scoop: boolean;
	nv: boolean;
	sc: boolean;
	cam: CameraView;
	// srv
	sThr: number;
	sSpd: number;
	steerT: number;
	steerDir: number;
	jetT: number;
	daOff: boolean;
	turret: boolean;
	sLights: boolean;
	sScoop: boolean;
	shipCalled: boolean;
	fuel: number;
	hull: number;
	// on foot
	crouch: boolean;
	walkT: number;
	sprintT: number;
	jumpT: number;
	aim: boolean;
	holster: boolean;
	flash: boolean;
	fNv: boolean;
	ammo: number;
	mag: number;
	reserve: number;
	reloadT: number;
	weapon: number;
	health: number;
	shield: number;
	battery: number;
}

export function initialFlight(): FlightState {
	return {
		msg: '',
		msgT: 0,
		tgt: false,
		fireT: 0,
		fire2T: 0,
		pips: [2, 2, 2],
		a: 0,
		thr: 0.4,
		vx: 0,
		vy: 0,
		boostT: 0,
		chaffT: 0,
		rollT: 0,
		rollDir: 1,
		altT: 0,
		altDir: 1,
		heat: 0.22,
		gear: false,
		hp: false,
		lights: true,
		faOff: false,
		silent: false,
		scoop: false,
		nv: false,
		sc: false,
		cam: 'chase',
		sThr: 0.3,
		sSpd: 0,
		steerT: 0,
		steerDir: 1,
		jetT: 0,
		daOff: false,
		turret: false,
		sLights: true,
		sScoop: false,
		shipCalled: false,
		fuel: 0.86,
		hull: 1,
		crouch: false,
		walkT: 0,
		sprintT: 0,
		jumpT: 0,
		aim: false,
		holster: false,
		flash: false,
		fNv: false,
		// The Tracer P1's cartridge holds six (StandFly's mock had 24 of 30). It starts in
		// hand, so the HUD names the sidearm.
		ammo: TRACER_ROUNDS,
		mag: TRACER_ROUNDS,
		reserve: 120,
		reloadT: 0,
		weapon: 1,
		health: 0.72,
		shield: 1,
		battery: 0.64
	};
}

const TIMERS = [
	'boostT',
	'fireT',
	'fire2T',
	'chaffT',
	'rollT',
	'altT',
	'msgT',
	'steerT',
	'jetT',
	'walkT',
	'sprintT',
	'jumpT',
	'reloadT'
] as const;

/** One step of time in `mode`. */
export function tick(s: FlightState, mode: Mode): FlightState {
	const p: Partial<FlightState> = {};
	for (const t of TIMERS) p[t] = Math.max(0, s[t] - 1);
	if (mode === 'ship') {
		const rad = (s.a * Math.PI) / 180;
		const sp = s.thr * (s.boostT > 0 ? 2.2 : 1) * (s.sc ? 3 : 1) * 4;
		const k = s.faOff ? 0.03 : 0.22;
		p.vx = approach(s.vx, Math.sin(rad) * sp, k);
		p.vy = approach(s.vy, -Math.cos(rad) * sp, k);
		p.heat = clamp01(
			s.heat + (s.boostT > 0 ? 0.006 : 0) + (s.fireT > 0 ? 0.01 : 0) + (s.silent ? 0.004 : -0.0015)
		);
	}
	if (mode === 'srv') {
		p.sSpd = approach(s.sSpd, s.sThr * 28, 0.08);
		p.fuel = Math.max(0, s.fuel - Math.abs(s.sThr) * 0.0002);
	}
	if (mode === 'foot') {
		if (s.reloadT === 1) {
			const take = Math.min(s.mag - s.ammo, s.reserve);
			p.ammo = s.ammo + take;
			p.reserve = s.reserve - take;
		}
		p.battery = Math.max(0, s.battery - (s.flash ? 0.0004 : 0));
	}
	// At rest nothing moves: hand back the same state, so nothing that reads it recomputes.
	for (const key of Object.keys(p) as (keyof FlightState)[])
		if (p[key] !== s[key]) return { ...s, ...p };
	return s;
}

/** `k` of the way from `from` to `to`, landing on `to` once it's too close to see. */
function approach(from: number, to: number, k: number): number {
	const next = from + (to - from) * k;
	return Math.abs(to - next) < 1e-4 ? to : next;
}

function clamp01(n: number): number {
	return Math.max(0, Math.min(1, n));
}

/** One more pip to `i`, taken from the fullest of the other two. */
function pip(pips: FlightState['pips'], i: number): FlightState['pips'] {
	const next = [...pips] as FlightState['pips'];
	if (next[i] < 4) {
		const j = [0, 1, 2].filter((n) => n !== i).sort((m, n) => next[n] - next[m])[0];
		if (next[j] > 0) {
			next[i] += 1;
			next[j] -= 1;
		}
	}
	return next;
}

/**
 * The state after one action fires. `effect` is the action's effect id; `name` is its
 * readable name, for the "would open" message panels get. Unknown effects change nothing:
 * the toast still says the action fired. `stowable` says the game deploys its hardpoints
 * (some action has `hp`); when it doesn't, as in X4, the guns are always ready.
 */
export function act(s: FlightState, effect: string, name: string, stowable = true): FlightState {
	const p: Partial<FlightState> = {};
	const msg = (text: string, ticks = 40) => {
		p.msg = text;
		p.msgT = ticks;
	};
	switch (effect) {
		// ship
		case 'thrUp':
			p.thr = Math.min(1, s.thr + 0.2);
			break;
		case 'thrDn':
			p.thr = Math.max(0, s.thr - 0.2);
			break;
		case 'thrZero':
			p.thr = 0;
			break;
		case 'yawL':
			p.a = s.a - 18;
			break;
		case 'yawR':
			p.a = s.a + 18;
			break;
		case 'rollL':
			p.rollT = 8;
			p.rollDir = -1;
			break;
		case 'rollR':
			p.rollT = 8;
			p.rollDir = 1;
			break;
		case 'up':
			p.altT = 10;
			p.altDir = 1;
			break;
		case 'down':
			p.altT = 10;
			p.altDir = -1;
			break;
		case 'boost':
			p.boostT = 22;
			break;
		case 'gear':
			p.gear = !s.gear;
			if (!s.gear) {
				p.thr = Math.min(s.thr, 0.6);
				if (s.thr > 0.6) msg('Gear down · speed limited');
			}
			break;
		case 'fa':
			p.faOff = !s.faOff;
			msg(s.faOff ? 'Flight assist on' : 'Flight assist off');
			break;
		// The galaxy map's route (`galaxy.ts`) handles Target next system in route, and the
		// drive when a system is targeted; this is the drive with nothing to jump to.
		case 'fsd':
			msg('FSD charging · mass locked', 50);
			break;
		case 'sc':
			p.sc = !s.sc;
			msg(s.sc ? 'Dropped from supercruise' : 'Supercruise engaged');
			break;
		case 'orbit':
			msg('Orbit lines toggled');
			break;
		case 'fire':
			if (stowable && !s.hp) msg('Hardpoints are stowed');
			else p.fireT = 5;
			break;
		case 'fire2':
			if (stowable && !s.hp) msg('Hardpoints are stowed');
			else p.fire2T = 6;
			break;
		case 'hp':
			p.hp = !s.hp;
			break;
		case 'tgt':
			p.tgt = true;
			break;
		case 'chaff':
			p.chaffT = 24;
			msg('Chaff away', 20);
			break;
		case 'heatsink':
			p.heat = 0;
			msg('Heat sink launched');
			break;
		case 'silent':
			p.silent = !s.silent;
			break;
		case 'scoop':
			p.scoop = !s.scoop;
			break;
		case 'lights':
			p.lights = !s.lights;
			break;
		case 'nv':
			p.nv = !s.nv;
			break;
		case 'pSys':
			p.pips = pip(s.pips, 0);
			break;
		case 'pEng':
			p.pips = pip(s.pips, 1);
			break;
		case 'pWep':
			p.pips = pip(s.pips, 2);
			break;
		case 'pBal':
			p.pips = [2, 2, 2];
			break;
		case 'camera':
			p.cam = s.cam === 'chase' ? 'cockpit' : 'chase';
			break;
		// srv
		case 'drvFwd':
			p.sThr = Math.min(1, s.sThr + 0.25);
			break;
		case 'drvRev':
			p.sThr = Math.max(-0.5, s.sThr - 0.25);
			break;
		case 'steerL':
			p.steerT = 10;
			p.steerDir = -1;
			break;
		case 'steerR':
			p.steerT = 10;
			p.steerDir = 1;
			break;
		case 'brake':
			p.sThr = 0;
			msg('Handbrake', 20);
			break;
		case 'jets':
			p.jetT = 16;
			break;
		case 'da':
			p.daOff = !s.daOff;
			msg(s.daOff ? 'Drive assist on' : 'Drive assist off');
			break;
		case 'turret':
			p.turret = !s.turret;
			msg(s.turret ? 'Back to driving' : 'Turret mode');
			break;
		case 'tFire':
			if (!s.turret) msg('Switch to turret mode to fire');
			else p.fireT = 5;
			break;
		case 'tFire2':
			if (!s.turret) msg('Switch to turret mode to fire');
			else p.fire2T = 6;
			break;
		case 'sLights':
			p.sLights = !s.sLights;
			break;
		case 'sScoop':
			p.sScoop = !s.sScoop;
			break;
		case 'recall':
			p.shipCalled = !s.shipCalled;
			msg(s.shipCalled ? 'Ship dismissed to orbit' : 'Ship recalled · touching down soon', 50);
			break;
		// on foot
		// One effect per direction, so the 3D walker knows which way; the mock flight
		// treats them all as the board's walk.
		case 'walkF':
		case 'walkB':
		case 'walkL':
		case 'walkR':
			p.walkT = 8;
			break;
		case 'sprint':
			p.sprintT = 30;
			p.walkT = 30;
			break;
		case 'jump':
			p.jumpT = 10;
			break;
		case 'crouch':
			p.crouch = !s.crouch;
			break;
		case 'primary':
			if (s.holster) msg('Weapon holstered', 24);
			else if (s.reloadT > 0) msg('Reloading', 20);
			else if (s.ammo > 0) {
				p.ammo = s.ammo - 1;
				p.fireT = 4;
			} else msg('Empty · reload', 30);
			break;
		case 'aim':
			if (!s.holster) p.aim = !s.aim;
			break;
		case 'reload':
			if (s.ammo < s.mag && s.reserve > 0) p.reloadT = 24;
			break;
		case 'melee':
			msg('Melee', 16);
			break;
		case 'grenade':
			msg('Grenade out', 24);
			break;
		case 'wNext':
			p.weapon = (s.weapon + 1) % 3;
			p.holster = false;
			break;
		case 'wPrev':
			p.weapon = (s.weapon + 2) % 3;
			p.holster = false;
			break;
		case 'holster':
			p.holster = !s.holster;
			p.aim = false;
			break;
		case 'interact':
			msg('Interacting with [terminal]');
			break;
		case 'medkit':
			p.health = 1;
			msg('Medkit used');
			break;
		case 'cell':
			p.battery = 1;
			msg('Energy cell used');
			break;
		case 'flash':
			p.flash = !s.flash;
			break;
		case 'fNv':
			p.fNv = !s.fNv;
			break;
		case 'scan':
			msg('Profile analyser out', 24);
			break;
		case 'ping':
			msg('Ping sent', 16);
			break;
		case 'panel':
			msg(`${name} would open`);
			break;
		default:
			break;
	}
	return { ...s, ...p };
}

/** Switching mode clears what belonged to the last one, as the board does. */
export function enterMode(s: FlightState): FlightState {
	return { ...s, tgt: false, msgT: 0, fireT: 0, fire2T: 0 };
}

/** Throttle from a throttle axis: full forward is -1 on most HOTAS throttles. UNVERIFIED. */
export function setThrottle(s: FlightState, axis: number): FlightState {
	return { ...s, thr: Math.round(clamp01((1 - axis) / 2) * 20) / 20 };
}

// HUD values. The HUD is DOM over the scene and reads only these.

export interface Pips {
	name: string;
	value: number;
}

export function pips(s: FlightState): Pips[] {
	return s.pips.map((value, i) => ({ name: ['SYS', 'ENG', 'WEP'][i], value }));
}

export function shipHud(s: FlightState) {
	const spd = Math.round(Math.hypot(s.vx, s.vy) * (s.sc ? 900 : 62));
	return {
		thr: Math.round(s.thr * 100),
		spd,
		mode: s.sc ? 'Supercruise' : s.faOff ? 'FA off' : '',
		heat: Math.round(s.heat * 100),
		hot: s.heat > 0.7
	};
}

export function srvHud(s: FlightState) {
	return {
		spd: Math.round(Math.abs(s.sSpd)),
		dir: s.sThr < 0 ? 'Reverse' : s.sThr === 0 ? 'Stopped' : 'Forward',
		assistOff: s.daOff,
		assist: s.daOff ? 'Drive assist off' : 'Drive assist on',
		hull: Math.round(s.hull * 100),
		fuel: Math.round(s.fuel * 100),
		shipCalled: s.shipCalled,
		ship: s.shipCalled ? 'Inbound' : 'In orbit'
	};
}

export const WEAPONS = ['[Primary rifle]', '[Sidearm]', '[Tool]'];

export function footHud(s: FlightState) {
	return {
		health: Math.round(s.health * 100),
		shield: Math.round(s.shield * 100),
		battery: Math.round(s.battery * 100),
		ammo: s.ammo,
		reserve: s.reserve,
		weapon: WEAPONS[s.weapon],
		reloading: s.reloadT > 0
	};
}

export interface StatusChip {
	name: string;
	on: boolean;
}

/**
 * The status chips for a mode. With `has`, a chip shows only when some action in the file
 * drives it: Star Citizen has no SRV turret or silent running, so no chip for them.
 */
export function statusChips(
	s: FlightState,
	mode: Mode,
	has: (effect: string) => boolean = () => true
): StatusChip[] {
	const c = (name: string, on: boolean, ...effects: string[]): StatusChip[] =>
		effects.some(has) ? [{ name, on }] : [];
	if (mode === 'ship') {
		return [
			...c('GEAR', s.gear, 'gear'),
			...c('HARDPOINTS', s.hp, 'hp'),
			...c('LIGHTS', s.lights, 'lights'),
			...c('FA OFF', s.faOff, 'fa'),
			...c('SILENT', s.silent, 'silent'),
			...c('SCOOP', s.scoop, 'scoop'),
			...c('NV', s.nv, 'nv')
		];
	}
	if (mode === 'srv') {
		return [
			...c('TURRET', s.turret, 'turret'),
			...c('HEADLIGHTS', s.sLights, 'sLights'),
			...c('DA OFF', s.daOff, 'da'),
			...c('SCOOP', s.sScoop, 'sScoop'),
			...c('HANDBRAKE', s.sThr === 0, 'brake', 'drvRev', 'drvFwd'),
			...c('SHIP INBOUND', s.shipCalled, 'recall')
		];
	}
	return [
		...c('FLASHLIGHT', s.flash, 'flash'),
		...c('NV', s.fNv, 'fNv'),
		...c('CROUCH', s.crouch, 'crouch'),
		...c('SPRINT', s.sprintT > 0, 'sprint'),
		...c('ADS', s.aim, 'aim'),
		...c('HOLSTERED', s.holster, 'holster')
	];
}

/** What the 3D scene draws from. The placeholder reads the same values. */
export interface SceneProps {
	flight: FlightState;
	mode: Mode;
}
