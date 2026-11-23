import { nudgeCamera, pathThrough, type Camera, type Limits, type Vec } from './map-camera.ts';

/**
 * A simplified system map, after Elite Dangerous's: the star system you're in, drawn as
 * an orrery, to try out the binds the system map reads. Everything in it is driven by
 * one:
 *
 * - it opens and closes on the mode's System map bind (`sysmap`); Menu back closes it;
 * - the camera (`map-camera.ts`) circles, pans and zooms on the "Galaxy map" binds; Map
 *   home goes back to the body the ship is at;
 * - Menu left / right step the selection from body to body; Menu select targets it and
 *   brings the camera to it.
 *
 * UNVERIFIED: that Menu left / right step between bodies (the game moves a cursor).
 * Pure; the system and its bodies are placeholder data.
 */

export type BodyKind = 'star' | 'rocky' | 'earthlike' | 'gas' | 'icy';

export interface Body {
	name: string;
	kind: BodyKind;
	/** Distance from what it orbits, in map units. */
	orbit: number;
	/** Where on that orbit, in degrees. */
	phase: number;
	/** Drawn size, in map units. */
	radius: number;
	/** The body it orbits (an index into `BODIES`); the star for planets. */
	parent?: number;
	/** Distance from the star in light seconds, for the info card. */
	ls: number;
}

export const SYSTEM_NAME = '[Home system]';

/** The ship is at `HOME_BODY`. Moons follow their planet. */
export const BODIES: readonly Body[] = [
	{ name: '[Home] A', kind: 'star', orbit: 0, phase: 0, radius: 6, ls: 0 },
	{ name: '[Home] 1', kind: 'rocky', orbit: 22, phase: 40, radius: 1.3, parent: 0, ls: 184 },
	{ name: '[Home] 2', kind: 'rocky', orbit: 38, phase: 200, radius: 1.8, parent: 0, ls: 412 },
	{ name: '[Home] 3', kind: 'earthlike', orbit: 60, phase: 310, radius: 2.4, parent: 0, ls: 506 },
	{ name: '[Home] 3 a', kind: 'rocky', orbit: 7, phase: 90, radius: 0.8, parent: 3, ls: 507 },
	{ name: '[Home] 4', kind: 'gas', orbit: 95, phase: 120, radius: 5, parent: 0, ls: 1290 },
	{ name: '[Home] 4 a', kind: 'icy', orbit: 11, phase: 250, radius: 1, parent: 5, ls: 1292 },
	{ name: '[Home] 5', kind: 'icy', orbit: 140, phase: 20, radius: 2.1, parent: 0, ls: 3410 }
];

export const KIND_NAMES: Record<BodyKind, string> = {
	star: 'Main sequence star',
	rocky: 'Rocky body',
	earthlike: 'Earth-like world',
	gas: 'Gas giant',
	icy: 'Icy body'
};

/** Where the ship is. */
export const HOME_BODY = 3;

/** A body's place in the system. Orbits lie flat, in the x–z plane. */
export function bodyAt(i: number): Vec {
	const b = BODIES[i];
	const origin = b.parent === undefined ? { x: 0, y: 0, z: 0 } : bodyAt(b.parent);
	const rad = (b.phase * Math.PI) / 180;
	return { x: origin.x + b.orbit * Math.cos(rad), y: 0, z: origin.z + b.orbit * Math.sin(rad) };
}

export interface SystemMapState extends Camera {
	/** The body the selection ring is on. */
	sel: number;
	/** The targeted body, if any. */
	target: number | null;
}

export const SYSTEM_LIMITS: Limits = { pitch: [5, 89], dist: [12, 420], height: 210, radius: 200 };
const HOME_DIST = 180;

export function initialSystemMap(): SystemMapState {
	return {
		yaw: 30,
		pitch: 35,
		dist: HOME_DIST,
		focus: bodyAt(HOME_BODY),
		glide: null,
		sel: HOME_BODY,
		target: null
	};
}

/** What a press does to a map: its new state, whether it closes, a HUD message. */
export interface MapPress<S> {
	map: S;
	close?: true;
	msg?: string;
}

/** Effects the open system map reads, besides the camera's. */
export const SYSTEM_PRESSES = ['sysmap', 'uiBack', 'uiLeft', 'uiRight', 'uiSelect', 'mapHome'];

/** One press of a bind the open system map reads. Anything else leaves it as it is. */
export function pressSystemMap(s: SystemMapState, effect: string): MapPress<SystemMapState> {
	switch (effect) {
		case 'sysmap':
		case 'uiBack':
			return { map: s, close: true };
		case 'uiLeft':
			return { map: { ...s, sel: (s.sel + BODIES.length - 1) % BODIES.length } };
		case 'uiRight':
			return { map: { ...s, sel: (s.sel + 1) % BODIES.length } };
		case 'uiSelect':
			return {
				map: { ...s, target: s.sel, glide: bodyAt(s.sel) },
				msg: `${BODIES[s.sel].name} targeted`
			};
		case 'mapHome':
			return { map: { ...s, sel: HOME_BODY, glide: bodyAt(HOME_BODY), dist: HOME_DIST } };
		default:
			return { map: nudgeCamera(s, effect, SYSTEM_LIMITS) };
	}
}

/** A body's orbit as an SVG path. */
export function orbitPath(s: SystemMapState, i: number, segments = 72): string {
	const b = BODIES[i];
	if (b.parent === undefined) return '';
	const c = bodyAt(b.parent);
	const points = Array.from({ length: segments + 1 }, (_, n) => {
		const a = (n / segments) * Math.PI * 2;
		return { x: c.x + b.orbit * Math.cos(a), y: 0, z: c.z + b.orbit * Math.sin(a) };
	});
	return pathThrough(s, points);
}
