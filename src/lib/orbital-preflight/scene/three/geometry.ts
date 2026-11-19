import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3 } from 'three';

/**
 * Model coordinates are the 2D sheet's: X forward to the nose, Y to port (up the top
 * view), Z up, 1 unit = 10 px. three.js wants Y up and -Z forward, so every point goes
 * through `m()`.
 */
export function m(x: number, y: number, z: number): Vector3 {
	return new Vector3(-y, z, -x);
}

/** A top-view point from the sheet (px) to model X, Y. */
export function sheet(x: number, y: number): [number, number] {
	return [(x - 450) / 10, (210 - y) / 10];
}

export type Tri = [Vector3, Vector3, Vector3];

/**
 * Flat-shaded triangles with one colour each, wound to face away from `centre` (every
 * piece built this way is convex, or close to it, so that's outward).
 */
export function facetGeometry(
	tris: { tri: Tri; color?: [number, number, number] }[],
	centre: Vector3
): BufferGeometry {
	const pos: number[] = [];
	const col: number[] = [];
	const ab = new Vector3();
	const ac = new Vector3();
	const n = new Vector3();
	const mid = new Vector3();
	for (const { tri, color = [1, 1, 1] } of tris) {
		const a = tri[0];
		let [, b, c] = tri;
		n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
		if (n.lengthSq() < 1e-10) continue;
		mid.copy(a).add(b).add(c).divideScalar(3).sub(centre);
		if (n.dot(mid) < 0) [b, c] = [c, b];
		for (const p of [a, b, c]) {
			pos.push(p.x, p.y, p.z);
			col.push(...color);
		}
	}
	const g = new BufferGeometry();
	g.setAttribute('position', new Float32BufferAttribute(pos, 3));
	g.setAttribute('color', new Float32BufferAttribute(col, 3));
	g.computeVertexNormals();
	return g;
}

/** Quads between two rings of the same length, as triangles. */
export function band(a: Vector3[], b: Vector3[], closed = true): Tri[] {
	const out: Tri[] = [];
	const n = a.length;
	for (let i = 0; i < (closed ? n : n - 1); i++) {
		const j = (i + 1) % n;
		out.push([a[i], a[j], b[j]], [a[i], b[j], b[i]]);
	}
	return out;
}

/** A fan from `centre` over a closed ring. */
export function fan(ring: Vector3[], centre: Vector3): Tri[] {
	return ring.map((p, i) => [centre, p, ring[(i + 1) % ring.length]] as Tri);
}

/** Eight corners → the twelve triangles of a (possibly skewed) box. Order: bottom 0-3, top 4-7. */
export function hexahedron(c: Vector3[]): Tri[] {
	const [a, b, cc, d, e, f, g, h] = c;
	return [...band([a, b, cc, d], [e, f, g, h]), [a, b, cc], [a, cc, d], [e, f, g], [e, g, h]];
}

export function centroid(points: Vector3[]): Vector3 {
	const c = new Vector3();
	for (const p of points) c.add(p);
	return c.divideScalar(points.length);
}

/** A closed outline resampled smoothly into `count` points (centripetal Catmull-Rom). */
export function smoothRing(points: Vector3[], count: number): Vector3[] {
	const curve = new CatmullRomCurve3(points, true, 'centripetal');
	return curve.getSpacedPoints(count).slice(0, count);
}

/** `p` moved toward `c` by `d` units (an inward offset, near enough for convex outlines). */
export function inset(p: Vector3, c: Vector3, d: number): Vector3 {
	const v = p.clone().sub(c);
	const len = Math.hypot(v.x, v.z);
	if (len < 1e-6) return p.clone();
	const k = Math.max(0, 1 - d / len);
	return new Vector3(c.x + v.x * k, p.y, c.z + v.z * k);
}

/** Smooth-shaded rings stacked into a skin, with an optional cap fan on the last ring. */
export function skin(rings: Vector3[][], cap?: Vector3): BufferGeometry {
	const pos: number[] = [];
	const index: number[] = [];
	const n = rings[0].length;
	for (const ring of rings) for (const p of ring) pos.push(p.x, p.y, p.z);
	for (let r = 0; r < rings.length - 1; r++) {
		for (let i = 0; i < n; i++) {
			const j = (i + 1) % n;
			const a = r * n + i;
			const b = r * n + j;
			const c = (r + 1) * n + j;
			const d = (r + 1) * n + i;
			index.push(a, b, c, a, c, d);
		}
	}
	if (cap) {
		const ci = pos.length / 3;
		pos.push(cap.x, cap.y, cap.z);
		const last = (rings.length - 1) * n;
		for (let i = 0; i < n; i++) index.push(ci, last + i, last + ((i + 1) % n));
	}
	// Wind every triangle outward from the skin's centre.
	const all = rings.flat();
	const centre = centroid(all);
	centre.y = Math.min(...all.map((p) => p.y));
	const v = (k: number) => new Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
	for (let t = 0; t < index.length; t += 3) {
		const a = v(index[t]);
		const b = v(index[t + 1]);
		const c = v(index[t + 2]);
		const nrm = new Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
		const mid = a.add(b).add(c).divideScalar(3).sub(centre);
		if (nrm.dot(mid) < 0) [index[t + 1], index[t + 2]] = [index[t + 2], index[t + 1]];
	}
	const g = new BufferGeometry();
	g.setAttribute('position', new Float32BufferAttribute(pos, 3));
	g.setIndex(index);
	g.computeVertexNormals();
	return g;
}
