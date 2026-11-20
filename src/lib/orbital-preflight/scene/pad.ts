/**
 * Pad 7 Compact: the on-foot bay, as data. Metres; +x east (Lantern II's nose), +y up,
 * +z south; the origin is the pad centre. These are three.js world coordinates as they
 * stand (north is three's −Z).
 *
 * From the Pad3D v0.1 block-out, which was built from OnFootA3's 2D plan at 1 plan px ≈
 * 0.081 m with plan point (380, 170) at the origin: x = (px − 380) · 0.081, z = (py − 170)
 * · 0.081. Every size is [placeholder scale]. Pad 7 Full (gantry, drill booth, airlock,
 * EVA hull walk) adds stops, boxes and ramps here; nothing else assumes one level.
 *
 * Pure: the bay's builder (three/pad7.ts), the walker (walker.ts) and the stop zones all
 * read this.
 */

export type XZ = readonly [number, number];
export type XYZ = readonly [number, number, number];

/** A solid box: centre, half sizes on the ground plane, a yaw, and its height range. */
export interface Solid {
	id: string;
	cx: number;
	cz: number;
	hx: number;
	hz: number;
	/** Yaw about +Y, radians (rotates local +x toward −z, as three.js does). */
	angle: number;
	y0: number;
	y1: number;
}

/** A walkable slope along x: height h0 at x0 rising to h1 at x1, z0..z1 wide. */
export interface Ramp {
	id: string;
	x0: number;
	x1: number;
	z0: number;
	z1: number;
	h0: number;
	h1: number;
}

/**
 * One line of a stop's prompt. `effects` find the actions that teach it (the first bound
 * one is shown); `names` match actions with no effect of their own (panels). Neither
 * matches → "Not bound". `fixed` is an input that needs no bind (the mouse).
 */
export interface PromptSpec {
	label: string;
	effects?: readonly string[];
	names?: readonly string[];
	fixed?: string;
	hold?: boolean;
}

export interface Stop {
	n: number;
	name: string;
	at: XZ;
	/** Where to face when spawning here (screenshots, the smoke test): a yaw. */
	face: number;
	/** What the stop tests, from OnFootA3. */
	tests: string;
	prompts: readonly PromptSpec[];
}

export const BAY = { x: [-23.5, 23.5] as XZ, z: [-13, 13] as XZ, ceiling: 9 };
export const PAD = { radius: 9.9, dashes: 24 };
/** Ribs every 4 m on the walls, gold light strips at 6.4 m. */
export const WALLS = { ribEvery: 4, stripY: 6.4, tile: 2 };

/**
 * The Lantern II, parked: the procedural model at `scale` metres per model unit, its
 * origin at `at`, nose +x. Gear down; the ramp drops aft to the deck.
 */
export const SHIP = {
	// Fitted to Pad3D's plan: hull from x ≈ −6.4 to the nose at ≈ 6.7, ring ducts at the
	// tail about 3.4 m either side, the ramp a long gentle slope down to x −9.6.
	at: [0.25, 0] as XZ,
	scale: 0.27,
	/** Model units from the origin down to the gear pads (lantern.ts: hinge −2.8, leg 3.4). */
	groundZ: -6.2,
	/** The ramp's hinge, model units (lantern.ts `tailBlock`), and its panel length. */
	rampHinge: { x: -24.6, z: -2.7 },
	rampPanel: 3.05,
	rampHalfWidth: 3,
	/** The hull's footprint, model units: tail to nose, and half its width. */
	hull: { x: [-24.6, 22] as XZ, halfWidth: 8.6, top: 4.4 },
	/** The ring ducts (lantern.ts `RING`): centre, outer radius, length along the hull. */
	ring: { x: -22.2, y: 12.6, z: 3.2, outer: 3.3, length: 8.4 },
	/** Where the ramp meets the deck. */
	rampFootX: -9.6
};

/** A model-unit x on the ship → world x. */
export const shipX = (x: number) => SHIP.at[0] + x * SHIP.scale;

/** The ramp's hinge height above the deck and its world x. */
export function rampHinge(): { x: number; y: number } {
	return { x: shipX(SHIP.rampHinge.x), y: (SHIP.rampHinge.z - SHIP.groundZ) * SHIP.scale };
}

/**
 * How the on-foot scene poses the ship's `rampDoor` so it reaches the deck: the angle
 * from closed (about +X, top swinging aft and down, as in the ship scene) and a stretch
 * along the panel. The Lantern II's panel is too short to reach from gear height; the
 * stretch stands in for an extending ramp until the model has one.
 */
export function rampPose(): { angle: number; stretch: number; length: number } {
	const hinge = rampHinge();
	const run = hinge.x - SHIP.rampFootX;
	const length = Math.hypot(run, hinge.y);
	const angle = Math.PI / 2 + Math.atan2(hinge.y, run);
	return { angle, stretch: length / SHIP.scale / SHIP.rampPanel, length };
}

const hinge = rampHinge();
export const RAMPS: readonly Ramp[] = [
	{
		id: 'shipRamp',
		x0: SHIP.rampFootX,
		x1: hinge.x,
		z0: -SHIP.rampHalfWidth * SHIP.scale,
		z1: SHIP.rampHalfWidth * SHIP.scale,
		h0: 0,
		h1: hinge.y
	}
];

const barrierFrom: XZ = [18.6, 4.0];
const barrierTo: XZ = [21.9, -3.2];

/** The cargo barrier's ends: 1 m tall, 0.6 m deep, with a gold top strip. */
export const BARRIER = { from: barrierFrom, to: barrierTo, height: 1, depth: 0.6 };

/** The target panel on the north wall: three violet holo rings with gold centres. */
export const TARGETS = {
	cx: 18.6,
	width: 8.2,
	y: [0.9, 3.1] as XZ,
	/** The panel's face, just off the north wall. */
	z: BAY.z[0] + 0.14,
	rings: [
		{ x: 15.9, y: 2.0 },
		{ x: 18.6, y: 2.0 },
		{ x: 21.3, y: 2.0 }
	],
	/** A ring's outer radius (a hit counts inside it) and its gold centre dot (Pad3D). */
	radius: 0.72,
	core: 0.12,
	/** The gold firing line on the deck. */
	line: { z: -8.1, length: 6.5 }
};

/** The pad console against the north wall, with a violet screen. */
export const CONSOLE = { cx: -4.05, width: 4.8, depth: 0.9, height: 1.1 };
/** The suit locker against the south wall. */
export const LOCKER = { cx: 12.6, width: 2.4, height: 2.2, depth: 0.6 };
/** The bay door on the west wall, framed in gold. It doesn't open in v1. */
export const DOOR = { width: 4.6, height: 4.8 };
/**
 * The big gold "7": on the north wall above the target panel, so it reads from the
 * firing line and from the ramp, rather than on the pad, where it read oddly.
 */
export const SEVEN = { x: TARGETS.cx, y: [3.8, 5.9] as XZ, z: BAY.z[0] + 0.05 };

const box = (
	id: string,
	cx: number,
	cz: number,
	sx: number,
	sz: number,
	height: number,
	angle = 0,
	y0 = 0
): Solid => ({ id, cx, cz, hx: sx / 2, hz: sz / 2, angle, y0, y1: y0 + height });

const barrierDx = barrierTo[0] - barrierFrom[0];
const barrierDz = barrierTo[1] - barrierFrom[1];

/** Everything the walker can't walk through, other than the bay's own walls. */
export const SOLIDS: readonly Solid[] = [
	box('crateA', -17.3, 7.8, 1.3, 1.3, 1.3),
	box('crateB', -14.7, 8.4, 1.0, 1.0, 1.0),
	box('crateC', -16.9, 5.1, 0.9, 0.9, 1.8),
	box('locker', LOCKER.cx, BAY.z[1] - LOCKER.depth / 2, LOCKER.width, LOCKER.depth, LOCKER.height),
	{
		id: 'barrier',
		cx: (barrierFrom[0] + barrierTo[0]) / 2,
		cz: (barrierFrom[1] + barrierTo[1]) / 2,
		hx: Math.hypot(barrierDx, barrierDz) / 2,
		hz: BARRIER.depth / 2,
		// three.js yaw: local +x toward −z for a positive angle.
		angle: Math.atan2(-barrierDz, barrierDx),
		y0: 0,
		y1: BARRIER.height
	},
	box(
		'console',
		CONSOLE.cx,
		BAY.z[0] + CONSOLE.depth / 2,
		CONSOLE.width,
		CONSOLE.depth,
		CONSOLE.height
	),
	box('targetPanel', TARGETS.cx, BAY.z[0] + 0.07, TARGETS.width, 0.14, TARGETS.y[1], 0, 0),
	box(
		'shipHull',
		(shipX(SHIP.hull.x[0]) + shipX(SHIP.hull.x[1])) / 2,
		SHIP.at[1],
		(SHIP.hull.x[1] - SHIP.hull.x[0]) * SHIP.scale,
		SHIP.hull.halfWidth * 2 * SHIP.scale,
		(SHIP.hull.top - SHIP.groundZ) * SHIP.scale
	),
	// The ring ducts hang low enough to bump a head; crouch to pass under them.
	...[1, -1].map((side) =>
		box(
			side > 0 ? 'shipRingL' : 'shipRingR',
			shipX(SHIP.ring.x),
			SHIP.at[1] - side * SHIP.ring.y * SHIP.scale,
			SHIP.ring.length * SHIP.scale,
			SHIP.ring.outer * 2 * SHIP.scale,
			SHIP.ring.outer * 2 * SHIP.scale,
			0,
			(SHIP.ring.z - SHIP.ring.outer - SHIP.groundZ) * SHIP.scale
		)
	)
];

/** The seven stops, clockwise from the ramp, with the binds each one teaches (OnFootA3). */
export const STOPS: readonly Stop[] = [
	{
		n: 1,
		name: 'Ramp foot',
		at: [-11.3, 0],
		face: -Math.PI / 2,
		tests: 'Move, look, walk and run',
		prompts: [
			{ label: 'Move', effects: ['walkF', 'walkL', 'walkB', 'walkR'] },
			{ label: 'Look', fixed: 'Mouse' },
			{ label: 'Run', effects: ['sprint'] }
		]
	},
	{
		n: 2,
		name: 'Crates',
		at: [-12.8, 5.3],
		face: Math.PI * 0.75,
		tests: 'Crouch and lean',
		prompts: [
			{ label: 'Crouch', effects: ['crouch'] },
			{ label: 'Lean', effects: ['leanL', 'leanR'] }
		]
	},
	{
		n: 3,
		name: 'Suit locker',
		at: [12.6, 9.4],
		face: Math.PI,
		tests: 'Helmet, swap tool or weapon, flashlight',
		prompts: [
			{ label: 'Helmet', effects: ['helmet'] },
			{ label: 'Swap tool or weapon', effects: ['wNext', 'wPrev'] },
			{ label: 'Flashlight', effects: ['flash'] }
		]
	},
	{
		n: 4,
		name: 'Cargo barrier',
		at: [18.6, 0.5],
		face: -Math.PI / 2,
		tests: 'Sprint, jump, vault',
		prompts: [
			{ label: 'Sprint', effects: ['sprint'] },
			{ label: 'Jump', effects: ['jump'] },
			{ label: 'Vault: jump at the barrier', effects: ['jump'] }
		]
	},
	{
		n: 5,
		name: 'Target panel',
		at: [17.8, -6.8],
		// Square on to the middle ring.
		face: -Math.atan2(18.6 - 17.8, -6.8 - (-13 + 0.14)),
		tests: 'Aim, fire, reload, fire mode',
		prompts: [
			{ label: 'Aim', effects: ['aim'] },
			{ label: 'Fire', effects: ['primary'] },
			{ label: 'Reload', effects: ['reload'] },
			{ label: 'Fire mode', effects: ['fireMode'] }
		]
	},
	{
		n: 6,
		name: 'Pad console',
		at: [-4.05, -8.7],
		face: 0,
		tests: 'Interact tap and hold, scan, ping',
		prompts: [
			{ label: 'Use console', effects: ['interact'] },
			{ label: 'Download log', effects: ['interact'], hold: true },
			{ label: 'Scan', effects: ['scan'] },
			{ label: 'Ping', effects: ['ping'] }
		]
	},
	{
		n: 7,
		name: 'Bay door',
		at: [-21.7, 0],
		face: Math.PI / 2,
		tests: 'Wrist menu, emote, recall ship',
		prompts: [
			{ label: 'Wrist menu', effects: ['wrist'] },
			{ label: 'Emote', names: ['Emote wheel'] },
			{ label: 'Recall ship', effects: ['recall'] }
		]
	}
];

/** A stop's trigger zone. */
export const STOP_RADIUS = 2;

/** The stop whose zone holds (x, z), nearest first; null outside them all. */
export function stopAt(x: number, z: number, stops: readonly Stop[] = STOPS): Stop | null {
	let best: Stop | null = null;
	let bestD = STOP_RADIUS;
	for (const s of stops) {
		const d = Math.hypot(x - s.at[0], z - s.at[1]);
		if (d <= bestD) {
			best = s;
			bestD = d;
		}
	}
	return best;
}

/** (x, z) in a solid's own frame. */
export function toLocal(s: Solid, x: number, z: number): [number, number] {
	const dx = x - s.cx;
	const dz = z - s.cz;
	const c = Math.cos(s.angle);
	const n = Math.sin(s.angle);
	// three.js yaw: local +x = (cos, −sin) in world x/z, local +z = (sin, cos).
	return [dx * c - dz * n, dx * n + dz * c];
}

/** Back to world (x, z) from a solid's frame. */
export function toWorld(s: Solid, lx: number, lz: number): [number, number] {
	const c = Math.cos(s.angle);
	const n = Math.sin(s.angle);
	return [s.cx + lx * c + lz * n, s.cz - lx * n + lz * c];
}

/** The ramp's surface height at (x, z), or null off it. */
export function rampHeight(r: Ramp, x: number, z: number): number | null {
	const lo = Math.min(r.x0, r.x1);
	const hi = Math.max(r.x0, r.x1);
	if (x < lo || x > hi || z < r.z0 || z > r.z1) return null;
	return r.h0 + ((x - r.x0) / (r.x1 - r.x0)) * (r.h1 - r.h0);
}

export interface Hit {
	/** Distance along the ray. */
	t: number;
	point: XYZ;
	/** The target ring hit, if one was. */
	ring: number | null;
	/** What was hit: a solid's id, the ramp, `deck`, `ceiling` or `wall`. */
	what: string;
}

/**
 * Casts a holo round from `o` along unit `d`: the nearest of the bay's surfaces, the
 * solids, the ramp and the target rings (a ring counts within its outer radius).
 */
export function castRay(o: XYZ, d: XYZ, maxT = 80): Hit {
	let t = maxT;
	let what = 'none';
	let ring: number | null = null;
	const consider = (tt: number, w: string, r: number | null = null) => {
		if (tt > 1e-4 && tt < t) {
			t = tt;
			what = w;
			ring = r;
		}
	};
	// The bay: deck, ceiling and four walls, from inside.
	const plane = (axis: 0 | 1 | 2, value: number, w: string) => {
		if (Math.abs(d[axis]) < 1e-9) return;
		consider((value - o[axis]) / d[axis], w);
	};
	plane(1, 0, 'deck');
	plane(1, BAY.ceiling, 'ceiling');
	plane(0, BAY.x[0], 'wall');
	plane(0, BAY.x[1], 'wall');
	plane(2, BAY.z[0], 'wall');
	plane(2, BAY.z[1], 'wall');
	for (const s of SOLIDS) consider(raySolid(o, d, s), s.id);
	for (const r of RAMPS) consider(rayRamp(o, d, r), r.id);
	// The rings sit on the panel's face.
	if (Math.abs(d[2]) > 1e-9) {
		const tt = (TARGETS.z - o[2]) / d[2];
		if (tt > 0) {
			const px = o[0] + d[0] * tt;
			const py = o[1] + d[1] * tt;
			TARGETS.rings.forEach((rg, i) => {
				if (Math.hypot(px - rg.x, py - rg.y) <= TARGETS.radius) consider(tt - 1e-3, 'ring', i);
			});
		}
	}
	return { t, point: [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t], ring, what };
}

/** Slab test against a solid in its own frame; Infinity on a miss. */
function raySolid(o: XYZ, d: XYZ, s: Solid): number {
	const [ox, oz] = toLocal(s, o[0], o[2]);
	const c = Math.cos(s.angle);
	const n = Math.sin(s.angle);
	const dx = d[0] * c - d[2] * n;
	const dz = d[0] * n + d[2] * c;
	let t0 = -Infinity;
	let t1 = Infinity;
	const slab = (p: number, v: number, lo: number, hi: number) => {
		if (Math.abs(v) < 1e-12) return p >= lo && p <= hi;
		let a = (lo - p) / v;
		let b = (hi - p) / v;
		if (a > b) [a, b] = [b, a];
		t0 = Math.max(t0, a);
		t1 = Math.min(t1, b);
		return t0 <= t1;
	};
	if (!slab(ox, dx, -s.hx, s.hx)) return Infinity;
	if (!slab(o[1], d[1], s.y0, s.y1)) return Infinity;
	if (!slab(oz, dz, -s.hz, s.hz)) return Infinity;
	return t0 > 1e-4 ? t0 : Infinity;
}

function rayRamp(o: XYZ, d: XYZ, r: Ramp): number {
	// The ramp's surface: y = h0 + (x − x0) · k.
	const k = (r.h1 - r.h0) / (r.x1 - r.x0);
	const denom = d[1] - k * d[0];
	if (Math.abs(denom) < 1e-9) return Infinity;
	const t = (r.h0 + k * (o[0] - r.x0) - o[1]) / denom;
	if (t <= 0) return Infinity;
	const x = o[0] + d[0] * t;
	const z = o[2] + d[2] * t;
	return rampHeight(r, x, z) === null ? Infinity : t;
}

/**
 * The dashed gold route, clockwise from the ramp foot to the bay door, as Pad3D's plan
 * draws it: a smooth open path that swings round the outside of the pad (and over the
 * barrier, which stop 4 vaults). Waypoints are read off the plan (27.2 plan px per metre,
 * centre (640, 360)); the stops are on it. Smoothed by the bay's builder.
 */
export const ROUTE: readonly XZ[] = [
	STOPS[0].at,
	[-11.95, 1.5],
	[-13.4, 2.95],
	STOPS[1].at,
	[-12.9, 9.0],
	[-11.4, 10.0],
	[-7.7, 10.5],
	[0, 10.95],
	[7.7, 10.3],
	[11.4, 9.85],
	STOPS[2].at,
	[16.5, 6.8],
	[17.8, 3.6],
	STOPS[3].at,
	[20.0, -1.1],
	[19.3, -3.3],
	[18.75, -5.3],
	STOPS[4].at,
	[14.9, -7.7],
	[10.65, -9.25],
	[3.7, -9.45],
	[-2.9, -9.5],
	STOPS[5].at,
	[-7.0, -8.5],
	[-10.65, -7.7],
	[-14.35, -6.55],
	[-17.3, -4.4],
	[-20.0, -1.85],
	STOPS[6].at
];
