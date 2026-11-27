import {
	DIST_MAX,
	DIST_MIN,
	homeCamera,
	MAP_H,
	MAP_W,
	project,
	rng,
	STAR_NAMES,
	steer,
	systemById,
	type MapCamera,
	type MapDrive,
	type StarClass,
	type Vec3
} from './galaxy.ts';

/**
 * The system map: the bodies of the system the ship is in, made up but the same on
 * every visit. What it keeps from Elite Dangerous's system map:
 *
 * - Map mode, the flat view: the star on the left, what orbits it in a row to the right
 *   in order of distance, and what orbits each of those hanging below it, each joined to
 *   what it orbits by a straight line. It shows what orbits what and how far out, not
 *   where things are. Landable bodies carry a light blue arc on their left side.
 * - Orrery mode: every body at its place on its orbit round the star, orbit lines drawn,
 *   on a camera that orbits as the galaxy map's does.
 * - It is steered by the galaxy map's camera binds (the game has no separate ones). In
 *   Map mode forward and back move the view up and down, as the game does.
 * - A cursor at the centre that picks up the nearest body, a selected body's details,
 *   and targeting it; in supercruise the ship then closes on it, and dropping out when
 *   it's near puts the ship there.
 *
 * Pure: every function takes a state and returns a new one, as `galaxy.ts` does.
 * UNVERIFIED (from memory of the game and forum posts, not a file): the body naming
 * ("Halden 2 a", "Halden A Belt"), the details panel's fields, that a second select
 * targets the body, that Map home goes back to the ship, the supercruise approach, and
 * that forward and back move Map mode up and down.
 */

export type BodyKind = 'star' | 'planet' | 'moon' | 'belt' | 'station' | 'beacon';

export interface Body {
	id: string;
	name: string;
	kind: BodyKind;
	/** What it orbits; null for the star. */
	parent: string | null;
	/** What the details panel calls it: "Rocky body", "Coriolis starport"… */
	type: string;
	/** Where it is now, in light seconds from the star: x east, z north, on the plane. */
	pos: [x: number, z: number];
	/** Its orbit round its parent, in light seconds. */
	orbit: number;
	/** Days for one orbit. */
	period: number;
	/** Kilometres. 0 for belts, stations and beacons. */
	radius: number;
	/** In g. */
	gravity: number;
	/** Kelvin. */
	temp: number;
	atmosphere: string;
	landable: boolean;
	/** Stations: the largest landing pad. */
	pad?: 'L' | 'M';
	/** Stations: what the system's economy makes there. */
	economy?: string;
}

/** Light seconds from the star: what the game calls the distance from the arrival point. */
export function arrival(b: Body): number {
	return Math.hypot(b.pos[0], b.pos[1]);
}

export function lsBetween(a: [number, number], b: [number, number]): number {
	return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

// Making a system.

interface StarFacts {
	mass: number;
	/** Suns. */
	lum: number;
	temp: number;
	/** Draw size, in map pixels. */
	size: number;
}

const STARS: Record<StarClass, StarFacts> = {
	O: { mass: 30, lum: 30000, temp: 38000, size: 40 },
	B: { mass: 6, lum: 800, temp: 17000, size: 38 },
	A: { mass: 2, lum: 20, temp: 8500, size: 34 },
	F: { mass: 1.3, lum: 3, temp: 6600, size: 32 },
	G: { mass: 1, lum: 1, temp: 5700, size: 30 },
	K: { mass: 0.7, lum: 0.3, temp: 4500, size: 27 },
	M: { mass: 0.3, lum: 0.03, temp: 3200, size: 24 },
	D: { mass: 0.6, lum: 0.01, temp: 12000, size: 16 },
	N: { mass: 1.4, lum: 0.001, temp: 600000, size: 12 }
};

/** A string's FNV-1a hash, to seed each system's bodies. */
function hash(s: string): number {
	let h = 0x811c9dc5;
	for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
	return h >>> 0;
}

/** What a world at `temp` kelvin is, given a roll. */
function worldType(temp: number, r: number): string {
	if (temp > 800) return r < 0.6 ? 'Metal-rich body' : 'High metal content world';
	if (temp > 400) return r < 0.5 ? 'High metal content world' : 'Rocky body';
	if (temp > 230 && temp < 330 && r > 0.82) return r > 0.92 ? 'Earth-like world' : 'Water world';
	if (temp > 200) return r < 0.55 ? 'Rocky body' : 'High metal content world';
	if (temp > 120) return r < 0.5 ? 'Rocky ice world' : r < 0.6 ? 'Ammonia world' : 'Rocky body';
	return r < 0.7 ? 'Icy body' : 'Rocky ice world';
}

function giantType(temp: number): string {
	if (temp < 150) return 'Class I gas giant';
	if (temp < 250) return 'Class II gas giant';
	if (temp < 800) return 'Class III gas giant';
	if (temp < 1400) return 'Class IV gas giant';
	return 'Class V gas giant';
}

export function isGiant(b: Body): boolean {
	return b.type.endsWith('gas giant');
}

/** How dense each kind of world is next to Earth, for its gravity. */
const DENSITY: Record<string, number> = {
	'Metal-rich body': 1.6,
	'High metal content world': 1.2,
	'Rocky body': 0.9,
	'Rocky ice world': 0.7,
	'Icy body': 0.45,
	'Earth-like world': 1,
	'Water world': 0.95,
	'Ammonia world': 0.85
};

const THICK = new Set(['Earth-like world', 'Water world', 'Ammonia world']);

function atmosphereOf(type: string, temp: number, r: number): string {
	if (type === 'Earth-like world') return 'Suitable for water-based life';
	if (type === 'Water world') return r < 0.5 ? 'Nitrogen' : 'Carbon dioxide';
	if (type === 'Ammonia world') return 'Ammonia';
	if (type.endsWith('gas giant')) return 'Hydrogen and helium';
	if (r < 0.75) return 'None';
	return temp > 400 ? 'Thin sulphur dioxide' : temp > 150 ? 'Thin carbon dioxide' : 'Thin nitrogen';
}

const STATION_NAMES = [
	'Okafor',
	'Lindqvist',
	'Ferrante',
	'Abara',
	'Hollis',
	'Varga',
	'Mbeki',
	'Castellan',
	'Sato',
	'Reyes',
	'Kowal',
	'Achterberg',
	'Duarte',
	'Ivanova',
	'Nakamura',
	'Brandt'
];
const STATION_KINDS = ['Coriolis starport', 'Orbis starport', 'Ocellus starport', 'Outpost'];
const STATION_ENDS = ['Hub', 'Port', 'Dock', 'Station', 'Terminal', 'Ring'];

function round(n: number, places = 1): number {
	const k = 10 ** places;
	return Math.round(n * k) / k;
}

/** Days per orbit, by Kepler, for `ls` round `mass` suns. */
function kepler(ls: number, mass: number): number {
	const au = ls / 499;
	return round(Math.sqrt(au ** 3 / mass) * 365.25, 1);
}

function at(parent: [number, number], r: number, angle: number): [number, number] {
	return [round(parent[0] + Math.cos(angle) * r), round(parent[1] + Math.sin(angle) * r)];
}

function make(systemId: string): Body[] {
	const sys = systemById(systemId);
	if (!sys) return [];
	const random = rng(hash(systemId));
	const facts = STARS[sys.star];
	const starId = `${sys.id}-a`;
	const out: Body[] = [
		{
			id: starId,
			name: sys.name,
			kind: 'star',
			parent: null,
			type: STAR_NAMES[sys.star],
			pos: [0, 0],
			orbit: 0,
			period: 0,
			radius: Math.round(696000 * facts.mass ** 0.8),
			gravity: 0,
			temp: facts.temp,
			atmosphere: 'None',
			landable: false
		},
		{
			id: `${sys.id}-beacon`,
			name: 'Nav beacon',
			kind: 'beacon',
			parent: starId,
			type: 'Nav beacon',
			pos: [round(Math.cos(random() * 6.3) * 8), round(Math.sin(random() * 6.3) * 8)],
			orbit: 8,
			period: 0,
			radius: 0,
			gravity: 0,
			temp: 0,
			atmosphere: 'None',
			landable: false
		}
	];

	// Planets on orbits that widen outwards, the first some way out, as most systems have.
	const planets = 3 + Math.floor(random() * 5);
	let orbit = (90 + random() * 220) * Math.sqrt(Math.max(facts.lum, 0.05));
	const beltAfter = random() < 0.55 ? Math.floor(random() * planets) : -1;
	const populated = sys.population > 0;
	const worlds: Body[] = [];
	for (let i = 0; i < planets; i++) {
		const angle = random() * Math.PI * 2;
		const temp = Math.round((278 * facts.lum ** 0.25) / Math.sqrt(orbit / 499));
		const giant = i >= 1 && random() < 0.25 + i * 0.12;
		const type = giant ? giantType(temp) : worldType(temp, random());
		const radius = giant
			? Math.round(30000 + random() * 45000)
			: type === 'Earth-like world' || type === 'Water world'
				? Math.round(5200 + random() * 2000)
				: Math.round(900 + random() ** 1.6 * 6200);
		const gravity = giant
			? round(1.2 + random() * 2, 2)
			: round((DENSITY[type] * radius) / 6371, 2);
		const atmosphere = atmosphereOf(type, temp, random());
		const planet: Body = {
			id: `${sys.id}-${i + 1}`,
			name: `${sys.name} ${i + 1}`,
			kind: 'planet',
			parent: starId,
			type,
			pos: at([0, 0], orbit, angle),
			orbit: Math.round(orbit),
			period: kepler(orbit, facts.mass),
			radius,
			gravity,
			temp,
			atmosphere,
			landable: !giant && !THICK.has(type) && !atmosphere.startsWith('Thin') && gravity < 2.5
		};
		out.push(planet);
		worlds.push(planet);

		// Moons: gas giants have the most.
		const moons = giant ? 1 + Math.floor(random() * 4) : random() < 0.4 ? 1 : 0;
		for (let m = 0; m < moons; m++) {
			const r = round(1.5 + m * 1.6 + random(), 1);
			const mTemp = temp;
			const mType = worldType(Math.min(mTemp, 399), random());
			const mRadius = Math.round(400 + random() ** 2 * 2600);
			const mGravity = round(((DENSITY[mType] ?? 0.8) * mRadius) / 6371, 2);
			const mAtmos = THICK.has(mType) ? atmosphereOf(mType, mTemp, random()) : 'None';
			const moon: Body = {
				id: `${planet.id}-${String.fromCharCode(97 + m)}`,
				name: `${planet.name} ${String.fromCharCode(97 + m)}`,
				kind: 'moon',
				parent: planet.id,
				type: mType,
				pos: at(planet.pos, r, random() * Math.PI * 2),
				orbit: r,
				period: round(1 + m * 2.2 + random() * 3, 1),
				radius: mRadius,
				gravity: mGravity,
				temp: mTemp,
				atmosphere: mAtmos,
				landable: !THICK.has(mType)
			};
			out.push(moon);
			worlds.push(moon);
		}

		if (i === beltAfter) {
			const r = Math.round(orbit * (1.3 + random() * 0.2));
			const kinds = ['Metallic', 'Metal-rich', 'Rocky', 'Icy'];
			out.push({
				id: `${sys.id}-belt`,
				name: `${sys.name} A Belt`,
				kind: 'belt',
				parent: starId,
				type: `${kinds[temp > 600 ? Math.floor(random() * 2) : temp > 200 ? 2 : 3]} asteroid belt`,
				pos: at([0, 0], r, random() * Math.PI * 2),
				orbit: r,
				period: kepler(r, facts.mass),
				radius: 0,
				gravity: 0,
				temp,
				atmosphere: 'None',
				landable: false
			});
		}
		orbit *= 1.6 + random() * 0.9;
	}

	// Stations round some of the worlds, in a system people live in.
	if (populated) {
		const count = 1 + Math.floor(random() * 3);
		const used = new Set<string>();
		for (let s = 0; s < count; s++) {
			const host = worlds[Math.floor(random() * worlds.length)];
			const surname = STATION_NAMES[Math.floor(random() * STATION_NAMES.length)];
			if (used.has(surname)) continue;
			used.add(surname);
			const planetary = host.landable && random() < 0.35;
			const kind = planetary
				? 'Planetary port'
				: STATION_KINDS[Math.floor(random() * STATION_KINDS.length)];
			const r = planetary ? 0 : round(0.6 + random() * 0.8, 1);
			out.push({
				id: `${sys.id}-${surname.toLowerCase()}`,
				name: `${surname} ${planetary ? 'City' : STATION_ENDS[Math.floor(random() * STATION_ENDS.length)]}`,
				kind: 'station',
				parent: host.id,
				type: kind,
				pos: planetary ? host.pos : at(host.pos, r, random() * Math.PI * 2),
				orbit: r,
				period: planetary ? 0 : round(0.1 + random() * 0.3, 2),
				radius: 0,
				gravity: 0,
				temp: 0,
				atmosphere: 'None',
				landable: false,
				pad: kind === 'Outpost' ? 'M' : 'L',
				economy: sys.economy
			});
		}
	}
	return out;
}

const CACHE = new Map<string, readonly Body[]>();

/** A system's bodies: the star first, then each body after what it orbits. */
export function bodiesOf(systemId: string): readonly Body[] {
	let bodies = CACHE.get(systemId);
	if (!bodies) {
		bodies = make(systemId);
		CACHE.set(systemId, bodies);
	}
	return bodies;
}

export function bodyIn(systemId: string, id: string | null | undefined): Body | undefined {
	return id ? bodiesOf(systemId).find((b) => b.id === id) : undefined;
}

export function starOf(systemId: string): Body {
	return bodiesOf(systemId)[0];
}

// Map mode: the flat layout.

export interface Placed {
	body: Body;
	/** Map pixels at zoom 1, the star at (0, 0); y grows down. */
	x: number;
	y: number;
	/** Draw radius, in map pixels at zoom 1. */
	r: number;
}

/** How big a body draws in Map mode. */
function drawSize(b: Body, star: StarClass): number {
	if (b.kind === 'star') return STARS[star].size;
	if (b.kind === 'belt') return 9;
	if (b.kind === 'station' || b.kind === 'beacon') return 5;
	if (isGiant(b)) return Math.min(22, 13 + (b.radius - 30000) / 5000);
	return Math.max(4, Math.min(12, Math.sqrt(b.radius / 6371) * 11));
}

const ROW_GAP = 46;
const COLUMN_GAP = 34;

/**
 * Map mode's layout: the star, then what orbits it in a row by distance, and below
 * each of those what orbits it, in a column. Stations and beacons hang with the moons.
 */
export function layout(systemId: string): Placed[] {
	const bodies = bodiesOf(systemId);
	const sys = systemById(systemId)!;
	const kids = (id: string) =>
		bodies.filter((b) => b.parent === id).sort((a, b) => a.orbit - b.orbit);
	const star = bodies[0];
	const out: Placed[] = [{ body: star, x: 0, y: 0, r: drawSize(star, sys.star) }];
	const column = (parent: Placed) => {
		let y = parent.y + parent.r + COLUMN_GAP;
		for (const child of kids(parent.body.id)) {
			const r = drawSize(child, sys.star);
			const placed = { body: child, x: parent.x, y: y + r, r };
			out.push(placed);
			y += r * 2 + COLUMN_GAP;
			// A moon's own stations hang under it in the same column.
			for (const grand of kids(child.id)) {
				const gr = drawSize(grand, sys.star);
				out.push({ body: grand, x: parent.x, y: y + gr, r: gr });
				y += gr * 2 + COLUMN_GAP;
			}
		}
	};
	// The beacon hangs under the star; everything else that orbits the star is in the row.
	const row = kids(star.id).filter((b) => b.kind !== 'beacon');
	for (const beacon of kids(star.id).filter((b) => b.kind === 'beacon')) {
		const r = drawSize(beacon, sys.star);
		out.push({ body: beacon, x: 0, y: out[0].r + COLUMN_GAP + r, r });
	}
	let x = out[0].r;
	for (const b of row) {
		const r = drawSize(b, sys.star);
		x += ROW_GAP + r;
		const placed = { body: b, x, y: 0, r };
		out.push(placed);
		column(placed);
		x += r;
	}
	return out;
}

export interface FlatCamera {
	/** The map point at the centre of the view, where the cursor sits. */
	x: number;
	y: number;
	zoom: number;
}

export const ZOOM_MIN = 0.3;
export const ZOOM_MAX = 3;

/** Map mode's view, centred on `id`. */
export function flatCamera(systemId: string, id: string, zoom = 1): FlatCamera {
	const p = layout(systemId).find((v) => v.body.id === id) ?? layout(systemId)[0];
	return { x: p.x, y: p.y, zoom };
}

/** Screen pixels for a Map mode point. */
export function toScreen(cam: FlatCamera, x: number, y: number): { x: number; y: number } {
	return { x: MAP_W / 2 + (x - cam.x) * cam.zoom, y: MAP_H / 2 + (y - cam.y) * cam.zoom };
}

/**
 * Moves Map mode's view. Forward and back move it up and down (so do up and down);
 * pitch and yaw do nothing on a flat map. 520 screen pixels a second, whatever the zoom.
 */
export function steerFlat(
	systemId: string,
	cam: FlatCamera,
	drive: MapDrive,
	dt: number
): FlatCamera {
	const up = Math.max(-1, Math.min(1, drive.y + drive.z));
	if (drive.x === 0 && up === 0 && drive.zoom === 0) return cam;
	const speed = (520 / cam.zoom) * dt;
	const all = layout(systemId);
	const maxX = Math.max(...all.map((p) => p.x)) + 100;
	const maxY = Math.max(...all.map((p) => p.y)) + 100;
	return {
		x: clamp(cam.x + drive.x * speed, -200, maxX),
		y: clamp(cam.y - up * speed, -200, maxY),
		zoom: clamp(cam.zoom * Math.exp(drive.zoom * 1.4 * dt), ZOOM_MIN, ZOOM_MAX)
	};
}

function clamp(n: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, n));
}

// Orrery mode.

/** Light seconds out to orrery units: a log scale, so the far planets fit in view. */
function scale(ls: number): number {
	return 6 * Math.log(1 + ls / 50);
}

/**
 * Where a body sits in the orrery, in the galaxy map's 3D units (x east, y up, z north).
 * Planets and belts at their place on a log-scaled orbit; what orbits them close by,
 * spread out so it can be told apart.
 */
export function orreryPos(systemId: string, b: Body): Vec3 {
	if (!b.parent) return [0, 0, 0];
	const parent = bodyIn(systemId, b.parent)!;
	if (!parent.parent) {
		const d = arrival(b) || 1;
		const k = scale(d) / d;
		return [b.pos[0] * k, 0, b.pos[1] * k];
	}
	const base = orreryPos(systemId, parent);
	const dx = b.pos[0] - parent.pos[0];
	const dz = b.pos[1] - parent.pos[1];
	const d = Math.hypot(dx, dz) || 1;
	const r = 0.9 + b.orbit * 0.35;
	return [base[0] + (dx / d) * r, 0, base[2] + (dz / d) * r];
}

/** The orrery radius of a body's orbit round its parent, for its orbit line. */
export function orreryOrbit(systemId: string, b: Body): number {
	const parent = bodyIn(systemId, b.parent);
	if (!parent) return 0;
	return parent.parent ? 0.9 + b.orbit * 0.35 : scale(b.orbit);
}

/** Where a point in the system (light seconds) sits in the orrery. */
export function orreryPoint(p: [number, number]): Vec3 {
	const d = Math.hypot(p[0], p[1]);
	if (d < 0.01) return [0, 0, 0];
	const k = scale(d) / d;
	return [p[0] * k, 0, p[1] * k];
}

/** The orrery's view of a whole system: on the star, far enough out to see every orbit. */
export function orreryCamera(systemId: string, cam?: MapCamera): MapCamera {
	const out = Math.max(...bodiesOf(systemId).map((b) => scale(arrival(b))));
	return {
		...homeCamera(undefined, cam),
		focus: [0, 0, 0],
		pitch: 0.75,
		dist: clamp(out * 2.6, DIST_MIN, DIST_MAX)
	};
}

// Picking.

/** The body drawn nearest to screen (`x`, `y`) in the current view, within `radius` px. */
export function pickBody(s: SystemMapState, x: number, y: number, radius = 30): string | null {
	let best: string | null = null;
	let bestD = radius;
	const consider = (id: string, px: number, py: number) => {
		const d = Math.hypot(px - x, py - y);
		if (d < bestD) {
			bestD = d;
			best = id;
		}
	};
	if (s.view === 'map') {
		for (const p of layout(s.system)) {
			const at = toScreen(s.flat, p.x, p.y);
			consider(p.body.id, at.x, at.y);
		}
	} else {
		for (const b of bodiesOf(s.system)) {
			const at = project(s.cam, orreryPos(s.system, b), MAP_W, MAP_H);
			if (at) consider(b.id, at.x, at.y);
		}
	}
	return best;
}

/** The body under the cursor, at the centre of the view. */
export function cursorBody(s: SystemMapState): string | null {
	return pickBody(s, MAP_W / 2, MAP_H / 2, 34);
}

// The map's state, and what the cockpit does with its target.

export type SystemView = 'map' | 'orrery';

export interface SystemMapState {
	open: boolean;
	view: SystemView;
	/** The system shown: the one the ship is in. */
	system: string;
	flat: FlatCamera;
	cam: MapCamera;
	selected: string | null;
	/** The body the ship is heading for. */
	target: string | null;
	/** Where the ship is, in light seconds from the star. It arrives at the star. */
	ship: [number, number];
	/** The body the ship dropped out at, if any. */
	at: string | null;
}

/** A system the ship has just arrived in: at the star, nothing targeted. */
export function arriveIn(systemId: string, s?: SystemMapState): SystemMapState {
	const star = starOf(systemId);
	return {
		open: s?.open ?? false,
		view: s?.view ?? 'map',
		system: systemId,
		flat: flatCamera(systemId, star.id, s?.flat.zoom ?? 1),
		cam: orreryCamera(systemId, s?.cam),
		selected: null,
		target: null,
		ship: [0, 0],
		at: star.id
	};
}

/** What happened, for the toast: the state, and a message when there's one to show. */
export interface SystemStep {
	s: SystemMapState;
	msg?: string;
}

/** The body nearest the ship, to centre on: where it dropped out, or the star. */
function shipBody(s: SystemMapState): string {
	return s.at ?? starOf(s.system).id;
}

/** Opening centres on the ship, as the galaxy map does. */
export function toggleSystemMap(s: SystemMapState, open = !s.open): SystemMapState {
	if (open === s.open) return s;
	return open ? systemHome({ ...s, open }) : { ...s, open };
}

/** Map home: both views back to the ship. */
export function systemHome(s: SystemMapState): SystemMapState {
	const body = bodyIn(s.system, shipBody(s))!;
	return {
		...s,
		flat: flatCamera(s.system, body.id, s.flat.zoom),
		cam: { ...s.cam, focus: orreryPos(s.system, body) }
	};
}

export function setView(s: SystemMapState, view: SystemView): SystemMapState {
	if (view === s.view) return s;
	const centred = s.selected ?? shipBody(s);
	const body = bodyIn(s.system, centred)!;
	return {
		...s,
		view,
		flat: flatCamera(s.system, body.id, s.flat.zoom),
		cam: { ...s.cam, focus: orreryPos(s.system, body) }
	};
}

/** Picks `id` (by default the body under the cursor) and centres on it. */
export function selectBody(s: SystemMapState, id: string | null = cursorBody(s)): SystemMapState {
	const body = bodyIn(s.system, id);
	if (!body) return s;
	return {
		...s,
		selected: body.id,
		flat: flatCamera(s.system, body.id, s.flat.zoom),
		cam: { ...s.cam, focus: orreryPos(s.system, body) }
	};
}

/**
 * Menu select on the map: picks the body under the cursor, or targets it when it's
 * already the selected one.
 */
export function systemSelect(s: SystemMapState): SystemStep {
	const under = cursorBody(s);
	if (under && under !== s.selected) return { s: selectBody(s, under) };
	if (s.selected) return targetBody(s);
	return { s, msg: 'No body under the cursor' };
}

export function targetBody(s: SystemMapState, id = s.selected): SystemStep {
	const body = bodyIn(s.system, id);
	if (!body) return { s };
	if (body.id === s.at) return { s, msg: 'You are here' };
	return { s: { ...s, target: body.id }, msg: `${body.name} targeted` };
}

export function clearTarget(s: SystemMapState): SystemMapState {
	return { ...s, target: null };
}

/** Light seconds from the ship to its target, or null with nothing targeted. */
export function toTarget(s: SystemMapState): number | null {
	const body = bodyIn(s.system, s.target);
	return body ? lsBetween(s.ship, body.pos) : null;
}

/** Close enough to drop out at the target. */
export const NEAR_LS = 1;

/**
 * One step of time. In supercruise with a body targeted, the ship closes on it faster
 * the farther it is, as supercruise does, by `throttle` (0..1); `dt` is in seconds.
 */
export function tickSystem(
	s: SystemMapState,
	supercruise: boolean,
	throttle: number,
	dt: number
): SystemStep {
	const body = bodyIn(s.system, s.target);
	if (!supercruise || !body || throttle <= 0) return { s };
	const left = lsBetween(s.ship, body.pos);
	if (left <= NEAR_LS) return { s };
	// At full throttle a little over half the way a second, never under 2 ls a second.
	const step = Math.max(left * 0.7 * throttle * dt, 2 * throttle * dt);
	const k = Math.min(1, step / left);
	const ship: [number, number] = [
		s.ship[0] + (body.pos[0] - s.ship[0]) * k,
		s.ship[1] + (body.pos[1] - s.ship[1]) * k
	];
	const near = lsBetween(ship, body.pos) <= NEAR_LS;
	return {
		s: { ...s, ship, at: null },
		...(near && { msg: `Approaching ${body.name} · drop when ready` })
	};
}

/**
 * Dropping out of supercruise: near the target the ship is there; elsewhere it's
 * nowhere in particular. Null when the target isn't near (the flight's own message).
 */
export function dropAt(s: SystemMapState): SystemStep | null {
	const body = bodyIn(s.system, s.target);
	if (!body || lsBetween(s.ship, body.pos) > NEAR_LS) return null;
	return {
		s: { ...s, ship: [...body.pos], at: body.id, target: null },
		msg: `Dropped at ${body.name}`
	};
}

/** The drive from the galaxy map's camera binds, for whichever view is up. */
export function steerSystem(s: SystemMapState, drive: MapDrive, dt: number): SystemMapState {
	if (s.view === 'map') {
		const flat = steerFlat(s.system, s.flat, drive, dt);
		return flat === s.flat ? s : { ...s, flat };
	}
	const cam = steer(s.cam, drive, dt);
	return cam === s.cam ? s : { ...s, cam };
}
