/**
 * The SRV's moon surface, as a height function. There is no designed terrain yet, so
 * this is a stand-in for Phil to review: low rolling ground, mounds, craters, rock
 * slab ramps and scattered rocks, repeating forever in a seeded pattern. The drive model
 * samples it under each wheel; the scene builds its meshes from the same numbers, so
 * what the wheels ride over is what you see.
 *
 * World frame: three.js, +Y up, metres. The SRV starts at the origin facing -Z, on a
 * flat patch with a ramp straight ahead and a mound beyond it.
 */

/** Rocks: one chance per cell of this size. */
export const ROCK_CELL = 9;
/** Bigger features (ramp, mound or crater): at most one per cell of this size. */
export const FEATURE_CELL = 56;
/** The flat patch the SRV starts on. */
export const SPAWN_CLEAR = 12;

export interface Rock {
	x: number;
	z: number;
	r: number;
	/** Height above the ground under it. */
	h: number;
	/** Seeded 0..1, for the mesh's turn and shape. */
	seed: number;
}

export interface Ramp {
	kind: 'ramp';
	/** Centre of the footprint. */
	x: number;
	z: number;
	/** The direction you drive up it, as a heading (0 = toward -Z). */
	angle: number;
	length: number;
	width: number;
	height: number;
	/** Surface height at the low end. */
	base: number;
}

export interface Mound {
	kind: 'mound';
	x: number;
	z: number;
	r: number;
	h: number;
}

export interface Crater {
	kind: 'crater';
	x: number;
	z: number;
	r: number;
	depth: number;
}

export type Feature = Ramp | Mound | Crater;

/** Integer hash → 0..1, stable across platforms. */
export function hash(i: number, j: number, salt = 0): number {
	let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(salt, 0x9e3779b1);
	h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(a: number, b: number, x: number): number {
	const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
}

/** The terrain mesh's cell size: the facet noise below sits on the same lattice. */
export const FACET = 2.5;

/** Small per-facet jitter on the mesh lattice, interpolated, so the ground reads faceted. */
function facets(x: number, z: number): number {
	const u = x / FACET;
	const v = z / FACET;
	const i = Math.floor(u);
	const j = Math.floor(v);
	const fu = u - i;
	const fv = v - j;
	const n = (a: number, b: number) => hash(a, b, 21) - 0.5;
	return (
		n(i, j) * (1 - fu) * (1 - fv) +
		n(i + 1, j) * fu * (1 - fv) +
		n(i, j + 1) * (1 - fu) * fv +
		n(i + 1, j + 1) * fu * fv
	);
}

/** The rolling ground under everything, flattened near the start. */
export function baseHeight(x: number, z: number): number {
	const roll =
		0.6 * Math.sin(x * 0.043 + 0.7) * Math.sin(z * 0.037 + 1.9) +
		0.3 * Math.sin(x * 0.11 + z * 0.07 + 0.4) +
		0.12 * Math.sin(x * 0.29 - z * 0.23) +
		0.34 * facets(x, z);
	const r = Math.hypot(x, z);
	return roll * (0.15 + 0.85 * smoothstep(SPAWN_CLEAR, SPAWN_CLEAR + 22, r));
}

/** The features near the start, fixed so the first metres always have something to do. */
function fixedFeature(i: number, j: number): Feature | null | undefined {
	if (i === 0 && j === 0) return null;
	if (i === 0 && j === -1) {
		const x = 0;
		const z = -36;
		return { kind: 'ramp', x, z, angle: 0, length: 8, width: 4.6, height: 1, base: 0 };
	}
	if (i === -1 && j === -1) return { kind: 'mound', x: -38, z: -62, r: 6, h: 1.2 };
	return undefined;
}

/** The feature in feature cell (i, j), if any. Each sits well inside its cell. */
export function featureIn(i: number, j: number): Feature | null {
	const fixed = fixedFeature(i, j);
	if (fixed !== undefined) {
		if (fixed?.kind === 'ramp') fixed.base = baseHeight(fixed.x, fixed.z) - 0.04;
		return fixed;
	}
	const roll = hash(i, j, 1);
	const x = (i + (hash(i, j, 2) - 0.5) * 0.55) * FEATURE_CELL;
	const z = (j + (hash(i, j, 3) - 0.5) * 0.55) * FEATURE_CELL;
	const k = hash(i, j, 4);
	if (roll < 0.36) {
		return {
			kind: 'ramp',
			x,
			z,
			angle: hash(i, j, 5) * Math.PI * 2,
			length: 6 + k * 3,
			width: 4 + hash(i, j, 6) * 1.5,
			height: 0.9 + k * 0.8,
			base: baseHeight(x, z) - 0.04
		};
	}
	if (roll < 0.66) return { kind: 'mound', x, z, r: 4 + k * 4, h: 0.6 + hash(i, j, 6) * 0.9 };
	if (roll < 0.9) return { kind: 'crater', x, z, r: 6 + k * 4, depth: 0.6 + hash(i, j, 6) * 0.5 };
	return null;
}

/** Where on a ramp (x, z) falls: along (0 low end .. length) and across, or null if off it. */
export function onRamp(ramp: Ramp, x: number, z: number): { u: number; v: number } | null {
	const dx = x - ramp.x;
	const dz = z - ramp.z;
	const s = Math.sin(ramp.angle);
	const c = Math.cos(ramp.angle);
	const u = -dx * s - dz * c + ramp.length / 2;
	const v = -dx * c + dz * s;
	if (u < 0 || u > ramp.length || Math.abs(v) > ramp.width / 2) return null;
	return { u, v };
}

function featureHeight(f: Feature, x: number, z: number): number {
	const d = Math.hypot(x - f.x, z - f.z);
	if (f.kind === 'mound') {
		if (d >= f.r) return 0;
		const c = Math.cos(((d / f.r) * Math.PI) / 2);
		return f.h * c * c;
	}
	if (f.kind === 'crater') {
		const t = d / f.r;
		const bowl = t < 1 ? -f.depth * (1 - t * t) : 0;
		const rim = 0.35 * f.depth * Math.exp(-((t - 1) * (t - 1)) / 0.02);
		return bowl + rim;
	}
	return 0;
}

/** The rock in rock cell (i, j), if any. */
export function rockIn(i: number, j: number): Rock | null {
	if (hash(i, j, 11) > 0.3) return null;
	const x = (i + (hash(i, j, 12) - 0.5) * 0.6) * ROCK_CELL;
	const z = (j + (hash(i, j, 13) - 0.5) * 0.6) * ROCK_CELL;
	if (Math.hypot(x, z) < SPAWN_CLEAR - 2) return null;
	// Keep rocks off ramps: a wheel on a rock on a ramp is a launch nobody asked for.
	const f = featureIn(Math.round(x / FEATURE_CELL), Math.round(z / FEATURE_CELL));
	if (f?.kind === 'ramp' && Math.hypot(x - f.x, z - f.z) < f.length) return null;
	const r = 0.25 + hash(i, j, 14) ** 2 * 0.75;
	return { x, z, r, h: r * 0.7, seed: hash(i, j, 15) };
}

function rockHeight(rock: Rock, x: number, z: number): number {
	const d2 = ((x - rock.x) ** 2 + (z - rock.z) ** 2) / (rock.r * rock.r);
	return d2 >= 1 ? 0 : rock.h * (1 - d2);
}

/** Height of the open ground (no ramps), for the terrain mesh. */
export function groundHeight(x: number, z: number): number {
	const f = featureIn(Math.round(x / FEATURE_CELL), Math.round(z / FEATURE_CELL));
	return baseHeight(x, z) + (f ? featureHeight(f, x, z) : 0);
}

/** Height the wheels ride on at (x, z): ground, rocks and ramp slabs. */
export function heightAt(x: number, z: number): number {
	const f = featureIn(Math.round(x / FEATURE_CELL), Math.round(z / FEATURE_CELL));
	let h = baseHeight(x, z) + (f ? featureHeight(f, x, z) : 0);
	const rock = rockIn(Math.round(x / ROCK_CELL), Math.round(z / ROCK_CELL));
	if (rock) h += rockHeight(rock, x, z);
	if (f?.kind === 'ramp') {
		const at = onRamp(f, x, z);
		if (at) {
			// The last 0.5 m each side slopes down, so a ramp's edge isn't a wall.
			const edge = Math.min(1, (f.width / 2 - Math.abs(at.v)) / 0.5);
			h = Math.max(h, f.base + ((f.height * at.u) / f.length) * edge);
		}
	}
	return h;
}

/** Every rock within `radius` of (x, z). */
export function rocksNear(x: number, z: number, radius: number): Rock[] {
	const out: Rock[] = [];
	const n = Math.ceil(radius / ROCK_CELL);
	const ci = Math.round(x / ROCK_CELL);
	const cj = Math.round(z / ROCK_CELL);
	for (let i = ci - n; i <= ci + n; i++)
		for (let j = cj - n; j <= cj + n; j++) {
			const rock = rockIn(i, j);
			if (rock && Math.abs(rock.x - x) <= radius && Math.abs(rock.z - z) <= radius) out.push(rock);
		}
	return out;
}

/** Every ramp within `radius` of (x, z). */
export function rampsNear(x: number, z: number, radius: number): Ramp[] {
	const out: Ramp[] = [];
	const n = Math.ceil(radius / FEATURE_CELL) + 1;
	const ci = Math.round(x / FEATURE_CELL);
	const cj = Math.round(z / FEATURE_CELL);
	for (let i = ci - n; i <= ci + n; i++)
		for (let j = cj - n; j <= cj + n; j++) {
			const f = featureIn(i, j);
			if (f?.kind === 'ramp' && Math.abs(f.x - x) <= radius && Math.abs(f.z - z) <= radius)
				out.push(f);
		}
	return out;
}
