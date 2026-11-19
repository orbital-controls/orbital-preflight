/**
 * Convex solids from half-spaces, for the Wick LR's block-out shapes: the body is the
 * intersection of three extruded outlines (plan, side profile, front section), and an
 * extruded convex outline is just its edges' half-spaces. Coordinates are the block-out's
 * (x forward, y left, z up), as plain triples; the caller maps them into three.js.
 */

export type V3 = [number, number, number];

/** n · p ≤ d, with n a unit normal. */
export interface Plane {
	n: V3;
	d: number;
}

/** Axis indices: 0 = x, 1 = y, 2 = z. */
type Axis = 0 | 1 | 2;

/**
 * The side half-spaces of a convex outline in the (a, b) plane, extruded along the third
 * axis. The outline can be in either winding.
 */
export function prismPlanes(outline: readonly [number, number][], a: Axis, b: Axis): Plane[] {
	const cx = outline.reduce((s, p) => s + p[0], 0) / outline.length;
	const cy = outline.reduce((s, p) => s + p[1], 0) / outline.length;
	const planes: Plane[] = [];
	for (let i = 0; i < outline.length; i++) {
		const [x0, y0] = outline[i];
		const [x1, y1] = outline[(i + 1) % outline.length];
		let nx = y1 - y0;
		let ny = -(x1 - x0);
		const len = Math.hypot(nx, ny);
		if (len < 1e-9) continue;
		nx /= len;
		ny /= len;
		// Face away from the centre.
		if (nx * (cx - x0) + ny * (cy - y0) > 0) {
			nx = -nx;
			ny = -ny;
		}
		const n: V3 = [0, 0, 0];
		n[a] = nx;
		n[b] = ny;
		planes.push({ n, d: nx * x0 + ny * y0 });
	}
	return planes;
}

/** A horizontal slab, lo ≤ z ≤ hi. */
export function slab(lo: number, hi: number): Plane[] {
	return [
		{ n: [0, 0, 1], d: hi },
		{ n: [0, 0, -1], d: -lo }
	];
}

/** Every plane pushed out by `by` (a skin just proud of the solid). */
export function grow(planes: readonly Plane[], by: number): Plane[] {
	return planes.map((p) => ({ n: p.n, d: p.d + by }));
}

function dot(a: V3, b: V3): number {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: V3, b: V3): V3 {
	return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** The corners of the solid where all `planes` hold: every three-plane meeting inside the rest. */
export function convexCorners(planes: readonly Plane[]): V3[] {
	const out: V3[] = [];
	const seen = new Set<string>();
	const n = planes.length;
	for (let i = 0; i < n; i++)
		for (let j = i + 1; j < n; j++) {
			const jk = cross(planes[i].n, planes[j].n);
			for (let k = j + 1; k < n; k++) {
				const det = dot(planes[k].n, jk);
				if (Math.abs(det) < 1e-9) continue;
				// p = (d_i (n_j × n_k) + d_j (n_k × n_i) + d_k (n_i × n_j)) / det
				const a = cross(planes[j].n, planes[k].n);
				const b = cross(planes[k].n, planes[i].n);
				const p: V3 = [0, 0, 0];
				for (let c = 0; c < 3; c++)
					p[c] = (planes[i].d * a[c] + planes[j].d * b[c] + planes[k].d * jk[c]) / det;
				if (planes.some((q) => dot(q.n, p) > q.d + 1e-6)) continue;
				const key = p.map((v) => Math.round(v * 1e4)).join();
				if (seen.has(key)) continue;
				seen.add(key);
				out.push(p);
			}
		}
	return out;
}
