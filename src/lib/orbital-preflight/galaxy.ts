import { axisValueKey } from './bindings.ts';
import { shape } from './scene/analog.ts';
import type { Action, BindingMap, InputId } from './types.ts';

/**
 * The galaxy map, at a much smaller scale: a pocket of 40 made-up systems some 90 light
 * years across instead of 400 billion stars. What it keeps from Elite Dangerous's map:
 *
 * - a camera that orbits a focus point over the galactic plane: pitch, yaw, translate
 *   (forward, sideways, up and down), zoom, and Map home back to where you are;
 * - a cursor at the focus that picks up the nearest system, and a selected system's
 *   details (distance, star class, fuel scoopable, economy, population);
 * - a plotted route of jumps within the ship's jump range, drawn on the map, with the
 *   first system targeted; Target next system in route and the frame shift drive then
 *   follow it from the cockpit;
 * - the plane grid, drop lines from each star to the plane, and the jump range ring.
 *
 * Pure: every function takes a state and returns a new one, as `flight.ts` does.
 * UNVERIFIED (from memory of the game, not a file): the cursor snapping to the nearest
 * system, a second select plotting the route (the game also plots from a button in the
 * system panel, here too), the axis signs, and Translate Z hold turning forward / back
 * into up / down.
 */

export type Vec3 = [x: number, y: number, z: number];

/** Harvard classes, plus white dwarfs (D) and neutron stars (N). */
export type StarClass = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M' | 'D' | 'N';

export interface StarSystem {
	id: string;
	name: string;
	/** Light years from the pocket's centre: x east, y above the plane, z north. */
	pos: Vec3;
	star: StarClass;
	economy: string;
	population: number;
}

/** How far one jump reaches, in light years. */
export const JUMP_RANGE = 14;

/** KGBFOAM: the classes a fuel scoop works on. */
export function scoopable(star: StarClass): boolean {
	return 'KGBFOAM'.includes(star);
}

export const STAR_NAMES: Record<StarClass, string> = {
	O: 'O-type blue giant',
	B: 'B-type blue-white star',
	A: 'A-type white star',
	F: 'F-type yellow-white star',
	G: 'G-type yellow star',
	K: 'K-type orange dwarf',
	M: 'M-type red dwarf',
	D: 'White dwarf',
	N: 'Neutron star'
};

/** Star colours on the map: astronomy's, not the theme's, so a re-theme leaves them. */
export const STAR_COLOURS: Record<StarClass, string> = {
	O: '#9bb0ff',
	B: '#aabfff',
	A: '#cad7ff',
	F: '#f8f7ff',
	G: '#fff4ea',
	K: '#ffd2a1',
	M: '#ffb07a',
	D: '#e8f0ff',
	N: '#b9a8ff'
};

const NAMES = [
	'Halden',
	'Corvane',
	'Ostry',
	'Maru Deep',
	'Kessick',
	'Tarrow',
	'Inver',
	'Lacuna',
	'Brisa',
	'Fennick',
	'Orlo',
	'Sable Rise',
	'Quill',
	'Varrin',
	'Hesk',
	'Dunmore',
	'Ilos',
	'Penhallow',
	'Tamsin',
	'Grey Harbour',
	'Akela',
	'Rook',
	'Morrow',
	'Celandine',
	'Vashti',
	'Ember Gate',
	'Lisle',
	'Norrow',
	'Pell',
	'Shoal',
	'Wester',
	'Juno Reach',
	'Caddis',
	'Thule',
	'Oriel',
	'Marrick',
	'Selk',
	'Tiber Low',
	'Yarrow',
	'Calder'
];

/** Out past every other system's jump range: the route plotter can't reach it. */
const OUTLIER = 'Thule';

const ECONOMIES = ['Extraction', 'Refinery', 'Agriculture', 'Industrial', 'High tech', 'Tourism'];

/** A small seeded generator (mulberry32), so the pocket is the same on every visit. */
export function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function pickClass(r: number): StarClass {
	// Red dwarfs most, giants least, as the sky has them (roughly).
	const table: [number, StarClass][] = [
		[0.4, 'M'],
		[0.62, 'K'],
		[0.74, 'G'],
		[0.84, 'F'],
		[0.91, 'A'],
		[0.95, 'B'],
		[0.965, 'O'],
		[0.99, 'D'],
		[1, 'N']
	];
	return table.find(([p]) => r < p)![1];
}

/**
 * The pocket: home at the centre, the rest scattered at least 4 ly apart in a flat disc,
 * and Thule out on its own.
 */
function generate(): StarSystem[] {
	const random = rng(0x0b17a1);
	const out: StarSystem[] = [];
	for (const [i, name] of NAMES.entries()) {
		let pos: Vec3 = [0, 0, 0];
		if (name === OUTLIER) pos = [48, 9, -38];
		else if (i > 0) {
			for (let tries = 0; tries < 200; tries++) {
				const a = random() * Math.PI * 2;
				const r = 5 + Math.sqrt(random()) * 31;
				pos = [round1(Math.cos(a) * r), round1((random() - 0.5) * 14), round1(Math.sin(a) * r)];
				if (out.every((s) => distance(s.pos, pos) >= 4)) break;
			}
		}
		const star = i === 0 ? 'G' : pickClass(random());
		const inhabited = i === 0 || random() < 0.45;
		out.push({
			id: name.toLowerCase().replace(/\W+/g, '-'),
			name,
			pos,
			star,
			economy: inhabited ? ECONOMIES[Math.floor(random() * ECONOMIES.length)] : 'None',
			population: inhabited ? Math.round(random() ** 3 * 4e9 + 2e4) : 0
		});
	}
	return out;
}

function round1(n: number): number {
	return Math.round(n * 10) / 10;
}

export const SYSTEMS: readonly StarSystem[] = generate();
export const HOME = SYSTEMS[0].id;

const BY_ID = new Map(SYSTEMS.map((s) => [s.id, s]));

export function systemById(id: string | null | undefined): StarSystem | undefined {
	return id ? BY_ID.get(id) : undefined;
}

export function distance(a: Vec3, b: Vec3): number {
	return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Light years between two systems by id. */
export function lightYears(a: string, b: string): number {
	return distance(BY_ID.get(a)!.pos, BY_ID.get(b)!.pos);
}

/**
 * The fewest jumps from `from` to `to` within `range`, then the shortest distance, as
 * the game's fastest route does. The systems after `from`, or null when out of range.
 */
export function plotRoute(from: string, to: string, range = JUMP_RANGE): string[] | null {
	if (from === to || !BY_ID.has(from) || !BY_ID.has(to)) return null;
	const best = new Map<string, { jumps: number; ly: number; prev: string | null }>([
		[from, { jumps: 0, ly: 0, prev: null }]
	]);
	const open = new Set([from]);
	while (open.size) {
		let id = '';
		for (const o of open) {
			const a = best.get(o)!;
			const b = best.get(id);
			if (!b || a.jumps < b.jumps || (a.jumps === b.jumps && a.ly < b.ly)) id = o;
		}
		open.delete(id);
		if (id === to) break;
		const here = best.get(id)!;
		for (const next of SYSTEMS) {
			if (next.id === id) continue;
			const hop = lightYears(id, next.id);
			if (hop > range) continue;
			const cand = { jumps: here.jumps + 1, ly: here.ly + hop, prev: id };
			const seen = best.get(next.id);
			if (!seen || cand.jumps < seen.jumps || (cand.jumps === seen.jumps && cand.ly < seen.ly)) {
				best.set(next.id, cand);
				open.add(next.id);
			}
		}
	}
	if (!best.has(to)) return null;
	const path: string[] = [];
	for (let at: string | null = to; at && at !== from; at = best.get(at)!.prev) path.unshift(at);
	return path;
}

/** Jumps and light years along a route from `from`. */
export function routeLength(from: string, route: readonly string[]): { jumps: number; ly: number } {
	let ly = 0;
	let at = from;
	for (const id of route) {
		ly += lightYears(at, id);
		at = id;
	}
	return { jumps: route.length, ly: round1(ly) };
}

// The camera.

export interface MapCamera {
	/** The point the camera orbits, and where the cursor sits. */
	focus: Vec3;
	/** Radians round the focus; 0 looks north. */
	yaw: number;
	/** Radians above the plane: low skims it, high looks straight down. */
	pitch: number;
	/** Light years from the focus. */
	dist: number;
}

export const PITCH_MIN = 0.12;
export const PITCH_MAX = 1.45;
export const DIST_MIN = 6;
export const DIST_MAX = 160;
/** How far the focus can wander from the centre. */
const REACH = 70;
const HEIGHT = 30;

export function homeCamera(at: string = HOME, cam?: MapCamera): MapCamera {
	const pos = BY_ID.get(at)?.pos ?? [0, 0, 0];
	return { yaw: 0.5, pitch: 0.62, dist: 55, ...cam, focus: [...pos] };
}

/** One frame of map drive, each -1..1. */
export interface MapDrive {
	pitch: number;
	yaw: number;
	/** Right is positive. */
	x: number;
	/** Forward (away from the camera, along the plane) is positive. */
	y: number;
	/** Up is positive. */
	z: number;
	/** In is positive. */
	zoom: number;
}

export const NO_DRIVE: MapDrive = { pitch: 0, yaw: 0, x: 0, y: 0, z: 0, zoom: 0 };

/**
 * Moves the camera by `drive` over `dt` seconds. Translation scales with zoom: 0.6 of
 * the camera's distance a second.
 */
export function steer(cam: MapCamera, drive: MapDrive, dt: number): MapCamera {
	if (Object.values(drive).every((v) => v === 0)) return cam;
	const speed = cam.dist * 0.6 * dt;
	const sin = Math.sin(cam.yaw);
	const cos = Math.cos(cam.yaw);
	// Forward along the plane, away from the camera; right is forward × up.
	const fx = -sin * drive.y + cos * drive.x;
	const fz = -cos * drive.y - sin * drive.x;
	const [x, y, z] = cam.focus;
	const nx = x + fx * speed;
	const nz = z + fz * speed;
	const r = Math.hypot(nx, nz);
	const k = r > REACH ? REACH / r : 1;
	return {
		focus: [nx * k, clamp(y + drive.z * speed, -HEIGHT, HEIGHT), nz * k],
		yaw: cam.yaw + drive.yaw * 1.6 * dt,
		pitch: clamp(cam.pitch + drive.pitch * 1.1 * dt, PITCH_MIN, PITCH_MAX),
		dist: clamp(cam.dist * Math.exp(-drive.zoom * 1.4 * dt), DIST_MIN, DIST_MAX)
	};
}

function clamp(n: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, n));
}

// Projection: what the map draws, and what a click or the cursor picks.

export interface Projected {
	x: number;
	y: number;
	/** Distance ahead of the camera, in light years. */
	depth: number;
}

const FOV = (50 * Math.PI) / 180;

/** Screen pixels for `p` in a `w` × `h` view, or null behind the camera. */
export function project(cam: MapCamera, p: Vec3, w: number, h: number): Projected | null {
	const cp = Math.cos(cam.pitch);
	const off: Vec3 = [
		Math.sin(cam.yaw) * cp * cam.dist,
		Math.sin(cam.pitch) * cam.dist,
		Math.cos(cam.yaw) * cp * cam.dist
	];
	// forward = -off / dist; right = forward × up; camera up = right × forward.
	const f: Vec3 = [-off[0] / cam.dist, -off[1] / cam.dist, -off[2] / cam.dist];
	const rl = Math.hypot(f[2], f[0]);
	const r: Vec3 = [-f[2] / rl, 0, f[0] / rl];
	const u: Vec3 = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
	const d: Vec3 = [
		p[0] - (cam.focus[0] + off[0]),
		p[1] - (cam.focus[1] + off[1]),
		p[2] - (cam.focus[2] + off[2])
	];
	const depth = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
	if (depth < 0.5) return null;
	const focal = h / (2 * Math.tan(FOV / 2));
	const sx = d[0] * r[0] + d[1] * r[1] + d[2] * r[2];
	const sy = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
	return { x: w / 2 + (sx * focal) / depth, y: h / 2 - (sy * focal) / depth, depth };
}

/** The system drawn nearest to (`x`, `y`), within `radius` pixels. */
export function pickAt(
	cam: MapCamera,
	x: number,
	y: number,
	w: number,
	h: number,
	radius = 28
): string | null {
	let best: string | null = null;
	let bestD = radius;
	for (const s of SYSTEMS) {
		const p = project(cam, s.pos, w, h);
		if (!p) continue;
		const d = Math.hypot(p.x - x, p.y - y);
		if (d < bestD) {
			bestD = d;
			best = s.id;
		}
	}
	return best;
}

/** The map's size in the viewport, which the cursor reads in. */
export const MAP_W = 900;
export const MAP_H = 560;

/** The system under the cursor, at the centre of the view. */
export function cursorSystem(cam: MapCamera): string | null {
	return pickAt(cam, MAP_W / 2, MAP_H / 2, MAP_W, MAP_H);
}

// The map's state, and what the cockpit does with its route.

export interface GalaxyState {
	open: boolean;
	cam: MapCamera;
	/** The system the ship is in. */
	location: string;
	selected: string | null;
	/** The plotted route's systems after `location`. */
	route: readonly string[];
	/** The system the frame shift drive will jump to. */
	target: string | null;
	/** Ticks until the jump lands; 0 when not charging. */
	chargeT: number;
}

export function initialGalaxy(): GalaxyState {
	return {
		open: false,
		cam: homeCamera(),
		location: HOME,
		selected: null,
		route: [],
		target: null,
		chargeT: 0
	};
}

/** What happened, for the toast: the state, and a message when there's one to show. */
export interface GalaxyStep {
	g: GalaxyState;
	msg?: string;
}

/** Opening puts the cursor back on the ship's system, as the game does. */
export function toggleMap(g: GalaxyState, open = !g.open): GalaxyState {
	if (open === g.open) return g;
	return open ? { ...g, open, cam: homeCamera(g.location, g.cam) } : { ...g, open };
}

export function mapHome(g: GalaxyState): GalaxyState {
	return { ...g, cam: homeCamera(g.location, g.cam) };
}

/** Picks `id` (by default the system under the cursor) and moves the focus to it. */
export function select(g: GalaxyState, id: string | null = cursorSystem(g.cam)): GalaxyState {
	const sys = systemById(id);
	if (!sys) return g;
	return { ...g, selected: sys.id, cam: { ...g.cam, focus: [...sys.pos] } };
}

/**
 * Menu select on the map: picks the system under the cursor, or plots a route to it
 * when it's already the selected one.
 */
export function mapSelect(g: GalaxyState): GalaxyStep {
	const under = cursorSystem(g.cam);
	if (under && under !== g.selected) return { g: select(g, under) };
	if (g.selected) return plot(g);
	return { g, msg: 'No system under the cursor' };
}

export function plot(g: GalaxyState, to = g.selected): GalaxyStep {
	const sys = systemById(to);
	if (!sys) return { g };
	if (sys.id === g.location) return { g, msg: 'You are here' };
	const route = plotRoute(g.location, sys.id);
	if (!route) return { g, msg: 'Route unavailable · out of jump range' };
	const { jumps } = routeLength(g.location, route);
	return {
		g: { ...g, route, target: route[0], chargeT: 0 },
		msg: `Route plotted · ${jumps} ${jumps === 1 ? 'jump' : 'jumps'}`
	};
}

export function clearRoute(g: GalaxyState): GalaxyState {
	return { ...g, route: [], target: null, chargeT: 0 };
}

/** Target next system in route. */
export function targetNext(g: GalaxyState): GalaxyStep {
	if (!g.route.length) return { g, msg: 'No route plotted' };
	return { g: { ...g, target: g.route[0] }, msg: `${systemById(g.route[0])!.name} targeted` };
}

/** Ticks the frame shift drive charges before a jump lands. */
export const CHARGE_TICKS = 60;

/** The frame shift drive with a system targeted: it charges, then jumps. */
export function engage(g: GalaxyState): GalaxyStep {
	if (!g.target) return { g };
	if (g.chargeT > 0) return { g, msg: 'FSD charging' };
	const name = systemById(g.target)!.name;
	return { g: { ...g, chargeT: CHARGE_TICKS }, msg: `Charging FSD · jumping to ${name}` };
}

/** One step of time: a charging drive counts down, then the ship arrives. */
export function tickGalaxy(g: GalaxyState): GalaxyStep {
	if (g.chargeT <= 0) return { g };
	if (g.chargeT > 1) return { g: { ...g, chargeT: g.chargeT - 1 } };
	const at = g.target!;
	const route = g.route[0] === at ? g.route.slice(1) : [];
	const name = systemById(at)!.name;
	const next: GalaxyState = {
		...g,
		chargeT: 0,
		location: at,
		route,
		// On arrival the game targets the next system in the route.
		target: route[0] ?? null,
		selected: route.length ? g.selected : null,
		cam: g.open ? g.cam : homeCamera(at, g.cam)
	};
	return { g: next, msg: route.length ? `Arrived at ${name}` : `Arrived at ${name} · destination` };
}

// Binds.

/**
 * Which way each map camera action drives: the button pairs one way each, the axes
 * both ways. UNVERIFIED: axis signs (a stick pushed forward reads negative, so it
 * moves the map forward).
 */
const DRIVE: Record<string, [keyof MapDrive, number]> = {
	CamPitchAxis: ['pitch', 1],
	CamPitchUp: ['pitch', 1],
	CamPitchDown: ['pitch', -1],
	CamYawAxis: ['yaw', 1],
	CamYawLeft: ['yaw', -1],
	CamYawRight: ['yaw', 1],
	CamTranslateYAxis: ['y', -1],
	CamTranslateForward: ['y', 1],
	CamTranslateBackward: ['y', -1],
	CamTranslateXAxis: ['x', 1],
	CamTranslateLeft: ['x', -1],
	CamTranslateRight: ['x', 1],
	CamTranslateZAxis: ['z', 1],
	CamTranslateUp: ['z', 1],
	CamTranslateDown: ['z', -1],
	CamZoomAxis: ['zoom', 1],
	CamZoomIn: ['zoom', 1],
	CamZoomOut: ['zoom', -1]
};

/** The map's camera actions: the ones that steer it, and Translate Z hold. */
export function isMapCamera(id: string): boolean {
	return id in DRIVE || id === 'CamTranslateZHold';
}

/**
 * The map drive from the binds held now and the bound axes. Pure: `isDown` says whether
 * an input is down; `axes` are the hub's (`deviceId:axis` → -1..1).
 */
export function mapDrive(
	actions: readonly Action[],
	bindings: BindingMap,
	isDown: (input: InputId) => boolean,
	axes: ReadonlyMap<string, number>
): MapDrive {
	const out: MapDrive = { ...NO_DRIVE };
	let zHold = false;
	for (const action of actions) {
		const drive = DRIVE[action.id];
		if (!drive && action.id !== 'CamTranslateZHold') continue;
		const slots = bindings[action.id] ?? [];
		if (action.axis) {
			const key = axisValueKey(slots[0]?.input);
			const value = key ? axes.get(key) : undefined;
			if (drive && value !== undefined) out[drive[0]] += shape(value) * drive[1];
			continue;
		}
		const down = slots.some(
			(slot) => slot && isDown(slot.input) && (slot.modifiers ?? []).every(isDown)
		);
		if (!down) continue;
		if (drive) out[drive[0]] += drive[1];
		else zHold = true;
	}
	if (zHold) {
		out.z += out.y;
		out.y = 0;
	}
	for (const k of Object.keys(out) as (keyof MapDrive)[]) out[k] = clamp(out[k], -1, 1);
	return out;
}
