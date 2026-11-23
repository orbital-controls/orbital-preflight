import {
	nudgeCamera,
	pathThrough,
	project,
	VIEW_H,
	VIEW_W,
	type Camera,
	type Limits,
	type Vec
} from './map-camera.ts';
import type { MapPress } from './system-map.ts';

/**
 * A simplified galaxy map, after Elite Dangerous's: a 3D field of star systems around
 * the one you're in, flown through with the map camera, where you pick a system and plot
 * a route to it. It is there to try out the binds the galaxy map reads, so everything in
 * it is driven by one:
 *
 * - it opens and closes on the mode's Galaxy map bind (`galmap`); Menu back closes it;
 * - the camera (`map-camera.ts`) circles, pans and zooms on the "Galaxy map" binds; Map
 *   home flies back to the current system;
 * - the system under the reticle, in the middle of the view, is the one Menu select
 *   picks: the first press selects it and brings the camera to it, the next plots a
 *   route there, drawn system by system within the ship's jump range;
 * - in flight, Target next system in route then names the route's next system.
 *
 * The game picks with the mouse or the reticle and plots from buttons on the selected
 * system's card; here Menu select does both. UNVERIFIED: that the game's Menu select
 * selects what's under the reticle. Pure; the systems are placeholder data.
 */

export type StarClass = 'M' | 'K' | 'G' | 'F' | 'A' | 'B';

export interface StarSystem {
	name: string;
	star: StarClass;
	/** Light years from the current system. */
	at: Vec;
}

/** The ship's jump range, in light years. */
export const JUMP_RANGE = 20;

/** Where the ship is. */
export const HOME_SYSTEM = 0;

const PREFIXES = [
	'Ar',
	'Bel',
	'Cor',
	'Des',
	'El',
	'Fen',
	'Gar',
	'Hal',
	'Is',
	'Jar',
	'Kel',
	'Lun',
	'Mor',
	'Nav'
];
const SUFFIXES = ['den', 'rin', 'vo', 'sa', 'mar', 'ka', 'tis', 'ul', 'eth', 'ion'];
const CLASSES: StarClass[] = ['M', 'M', 'M', 'K', 'K', 'G', 'F', 'A', 'B'];

/** A small seeded random, so the placeholder systems are the same every visit. */
function seeded(seed: number): () => number {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function makeSystems(): StarSystem[] {
	const rand = seeded(7);
	const out: StarSystem[] = [{ name: '[Home system]', star: 'G', at: { x: 0, y: 0, z: 0 } }];
	const names = new Set<string>();
	while (out.length < 80) {
		const r = 6 + Math.sqrt(rand()) * 58;
		const a = rand() * Math.PI * 2;
		const name = `[${PREFIXES[Math.floor(rand() * PREFIXES.length)]}${SUFFIXES[Math.floor(rand() * SUFFIXES.length)]}]`;
		const star = CLASSES[Math.floor(rand() * CLASSES.length)];
		const y = (rand() - 0.5) * 18;
		if (names.has(name)) continue;
		names.add(name);
		out.push({ name, star, at: { x: r * Math.cos(a), y, z: r * Math.sin(a) } });
	}
	return out;
}

export const SYSTEMS: readonly StarSystem[] = makeSystems();

export function distance(a: Vec, b: Vec): number {
	return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * The fewest jumps from `from` to `to`, none longer than the jump range (the shorter way
 * where two routes take as many): system indices, `from` first. Empty when there's none.
 */
export function plotRoute(from: number, to: number, range = JUMP_RANGE): number[] {
	const n = SYSTEMS.length;
	const cost = Array<number>(n).fill(Infinity);
	const prev = Array<number>(n).fill(-1);
	const done = Array<boolean>(n).fill(false);
	cost[from] = 0;
	for (;;) {
		let u = -1;
		for (let i = 0; i < n; i++)
			if (!done[i] && cost[i] < Infinity && (u < 0 || cost[i] < cost[u])) u = i;
		if (u < 0 || u === to) break;
		done[u] = true;
		for (let v = 0; v < n; v++) {
			const d = distance(SYSTEMS[u].at, SYSTEMS[v].at);
			if (done[v] || d > range) continue;
			// A jump costs far more than its length: fewest jumps first.
			const c = cost[u] + 1000 + d;
			if (c < cost[v]) {
				cost[v] = c;
				prev[v] = u;
			}
		}
	}
	if (cost[to] === Infinity) return [];
	const route = [to];
	while (route[0] !== from) route.unshift(prev[route[0]]);
	return route;
}

export interface GalaxyMapState extends Camera {
	/** The selected system, if any. */
	sel: number | null;
	/** The plotted route, current system first; empty when there's none. */
	route: readonly number[];
}

export const GALAXY_LIMITS: Limits = { pitch: [5, 89], dist: [10, 260], height: 60, radius: 80 };
const HOME_DIST = 90;

export function initialGalaxyMap(route: readonly number[] = []): GalaxyMapState {
	return {
		yaw: 20,
		pitch: 30,
		dist: HOME_DIST,
		focus: SYSTEMS[HOME_SYSTEM].at,
		glide: null,
		sel: null,
		route
	};
}

/** How close to the middle of the view a system must be to sit under the reticle, in pixels. */
const RETICLE = 40;

/** The system under the reticle: the nearest to the middle of the view, if one is close. */
export function underReticle(s: GalaxyMapState): number | null {
	let best: number | null = null;
	let bestD = RETICLE;
	SYSTEMS.forEach((sys, i) => {
		const p = project(s, sys.at);
		if (p.depth <= 0.1) return;
		const d = Math.hypot(p.x - VIEW_W / 2, p.y - VIEW_H / 2);
		if (d < bestD) {
			best = i;
			bestD = d;
		}
	});
	return best;
}

/** Effects the open galaxy map reads, besides the camera's. */
export const GALAXY_PRESSES = ['galmap', 'uiBack', 'uiSelect', 'mapHome'];

/** One press of a bind the open galaxy map reads. Anything else leaves it as it is. */
export function pressGalaxyMap(s: GalaxyMapState, effect: string): MapPress<GalaxyMapState> {
	switch (effect) {
		case 'galmap':
		case 'uiBack':
			return { map: s, close: true };
		case 'uiSelect': {
			const under = underReticle(s);
			if (under === null) return { map: s };
			if (under !== s.sel) return { map: { ...s, sel: under, glide: SYSTEMS[under].at } };
			if (under === HOME_SYSTEM) return { map: s, msg: 'You are here' };
			const route = plotRoute(HOME_SYSTEM, under);
			if (!route.length) return { map: s, msg: 'No route within jump range' };
			const jumps = route.length - 1;
			return {
				map: { ...s, route },
				msg: `Route plotted · ${jumps} jump${jumps === 1 ? '' : 's'}`
			};
		}
		case 'mapHome':
			return { map: { ...s, glide: SYSTEMS[HOME_SYSTEM].at, dist: HOME_DIST } };
		default:
			return { map: nudgeCamera(s, effect, GALAXY_LIMITS) };
	}
}

/**
 * The grid on the plane through the focus, 10 ly a square, as SVG paths: the game's
 * galactic plane grid follows the camera. UNVERIFIED: its spacing.
 */
export function gridPaths(s: GalaxyMapState, half = 60, step = 10): string[] {
	const y = s.focus.y;
	const cx = Math.round(s.focus.x / step) * step;
	const cz = Math.round(s.focus.z / step) * step;
	const out: string[] = [];
	for (let k = -half; k <= half; k += step) {
		const line = (a: Vec, b: Vec) =>
			pathThrough(
				s,
				Array.from({ length: 13 }, (_, n) => ({
					x: a.x + ((b.x - a.x) * n) / 12,
					y,
					z: a.z + ((b.z - a.z) * n) / 12
				}))
			);
		out.push(line({ x: cx + k, y, z: cz - half }, { x: cx + k, y, z: cz + half }));
		out.push(line({ x: cx - half, y, z: cz + k }, { x: cx + half, y, z: cz + k }));
	}
	return out.filter(Boolean);
}

/** The jump range around the current system, as an SVG path on its plane. */
export function rangePath(s: GalaxyMapState, segments = 64): string {
	const c = SYSTEMS[HOME_SYSTEM].at;
	return pathThrough(
		s,
		Array.from({ length: segments + 1 }, (_, n) => {
			const a = (n / segments) * Math.PI * 2;
			return { x: c.x + JUMP_RANGE * Math.cos(a), y: c.y, z: c.z + JUMP_RANGE * Math.sin(a) };
		})
	);
}

/** The plotted route as an SVG path. */
export function routePath(s: GalaxyMapState): string {
	return pathThrough(
		s,
		s.route.map((i) => SYSTEMS[i].at)
	);
}
