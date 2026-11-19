import {
	BufferAttribute,
	BufferGeometry,
	Color,
	DodecahedronGeometry,
	DynamicDrawUsage,
	EdgesGeometry,
	Group,
	InstancedMesh,
	LineBasicMaterial,
	LineSegments,
	Matrix4,
	MeshLambertMaterial,
	Mesh,
	MeshStandardMaterial,
	Points,
	PointsMaterial,
	Quaternion,
	Vector3,
	type Texture
} from 'three';
import { FACET, groundHeight, hash, rampsNear, rocksNear, type Ramp } from '../terrain.ts';
import { facetGeometry, hexahedron } from './geometry.ts';
import type { Palette } from './palette.ts';

/**
 * The SRV's ground, built from the height function in ../terrain.ts: a faceted grid
 * that follows the vehicle (re-laid every few metres, snapped to its cells so the facets
 * never swim), rock instances, ramp slabs, and the dust the wheels kick up.
 */

/** Grid cell size and count: 96 × 2.5 m = 240 m across, fogged out before the edge. */
const CELL = FACET;
const CELLS = 96;
const HALF = (CELLS * CELL) / 2;
/** Re-lay the ground when the vehicle is this far from the grid's centre. */
const SNAP = 10;
const MAX_ROCKS = 320;
const MAX_RAMPS = 10;

/** Fog that hides the grid's edge. */
export const FOG = { near: 55, far: HALF - 8 } as const;

const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();
const UP = new Vector3(0, 1, 0);

export class Surface {
	readonly group = new Group();
	#geometry = new BufferGeometry();
	#positions: Float32Array;
	#colors: Float32Array;
	#rocks: InstancedMesh;
	#ramps: Mesh[] = [];
	#rampEdges: LineSegments[] = [];
	#rampMat: MeshStandardMaterial;
	#rampEdgeMat: LineBasicMaterial;
	#centre: [number, number] = [Number.NaN, Number.NaN];
	#low: Color;
	#high: Color;
	#lift: Color;

	constructor(p: Palette) {
		const n = CELLS + 1;
		this.#positions = new Float32Array(n * n * 3);
		this.#colors = new Float32Array(n * n * 3);
		const index: number[] = [];
		for (let j = 0; j < CELLS; j++)
			for (let i = 0; i < CELLS; i++) {
				const a = j * n + i;
				const b = a + 1;
				const c = a + n;
				const d = c + 1;
				// Alternate the diagonal so the facets don't line up in stripes.
				if ((i + j) % 2) index.push(a, c, b, b, c, d);
				else index.push(a, c, d, a, d, b);
			}
		const pos = new BufferAttribute(this.#positions, 3);
		pos.setUsage(DynamicDrawUsage);
		const col = new BufferAttribute(this.#colors, 3);
		col.setUsage(DynamicDrawUsage);
		this.#geometry.setAttribute('position', pos);
		this.#geometry.setAttribute('color', col);
		this.#geometry.setIndex(index);
		// The ground palette: dark violet-grey, lighter on the crests.
		this.#low = p.ground.clone().lerp(p.trim, 0.3);
		this.#high = p.trim.clone().lerp(p.metal, 0.25);
		this.#lift = p.metal.clone().lerp(p.violet, 0.25);
		// Lambert, not PBR: matte dust needs no reflections, and the ground fills half the
		// frame, so it's the scene's biggest fragment cost.
		const ground = new Mesh(
			this.#geometry,
			new MeshLambertMaterial({ vertexColors: true, flatShading: true })
		);
		ground.name = 'ground';
		ground.frustumCulled = false;

		this.#rocks = new InstancedMesh(
			new DodecahedronGeometry(1, 0),
			new MeshLambertMaterial({
				color: p.metal.clone().lerp(p.hullLower, 0.2),
				flatShading: true
			}),
			MAX_ROCKS
		);
		this.#rocks.name = 'rocks';
		this.#rocks.count = 0;
		this.#rocks.frustumCulled = false;

		this.#rampMat = new MeshStandardMaterial({
			color: p.trim.clone().lerp(p.metal, 0.6),
			flatShading: true,
			roughness: 0.75,
			metalness: 0.15
		});
		this.#rampEdgeMat = new LineBasicMaterial({
			color: p.violetBright.clone(),
			transparent: true,
			opacity: 0.55
		});
		for (let i = 0; i < MAX_RAMPS; i++) {
			const ramp = new Mesh(new BufferGeometry(), this.#rampMat);
			const edges = new LineSegments(new BufferGeometry(), this.#rampEdgeMat);
			ramp.visible = edges.visible = false;
			this.#ramps.push(ramp);
			this.#rampEdges.push(edges);
		}
		this.group.add(ground, this.#rocks, ...this.#ramps, ...this.#rampEdges);
	}

	/** Re-lays the ground around (x, z) when the vehicle has moved far enough. */
	follow(x: number, z: number) {
		const [cx, cz] = this.#centre;
		if (Math.abs(x - cx) < SNAP && Math.abs(z - cz) < SNAP) return;
		const nx = Math.round(x / CELL) * CELL;
		const nz = Math.round(z / CELL) * CELL;
		this.#centre = [nx, nz];
		this.#layGround(nx, nz);
		this.#layRocks(nx, nz);
		this.#layRamps(nx, nz);
	}

	#layGround(cx: number, cz: number) {
		const n = CELLS + 1;
		const pos = this.#positions;
		const col = this.#colors;
		const c = new Color();
		for (let j = 0; j < n; j++)
			for (let i = 0; i < n; i++) {
				const x = cx - HALF + i * CELL;
				const z = cz - HALF + j * CELL;
				const y = groundHeight(x, z);
				const k = (j * n + i) * 3;
				pos[k] = x;
				pos[k + 1] = y;
				pos[k + 2] = z;
				const gi = Math.round(x / CELL);
				const gj = Math.round(z / CELL);
				const t = Math.max(0, Math.min(1, 0.45 + y * 0.35 + (hash(gi, gj, 31) - 0.5) * 0.5));
				c.copy(this.#low).lerp(this.#high, t);
				if (hash(gi, gj, 32) > 0.93) c.lerp(this.#lift, 0.5);
				col[k] = c.r;
				col[k + 1] = c.g;
				col[k + 2] = c.b;
			}
		this.#geometry.attributes.position.needsUpdate = true;
		this.#geometry.attributes.color.needsUpdate = true;
		this.#geometry.computeBoundingSphere();
	}

	#layRocks(cx: number, cz: number) {
		const rocks = rocksNear(cx, cz, HALF).slice(0, MAX_ROCKS);
		rocks.forEach((rock, i) => {
			_q.setFromAxisAngle(UP, rock.seed * Math.PI * 2);
			_s.set(rock.r * (0.9 + rock.seed * 0.3), rock.h, rock.r * (1.15 - rock.seed * 0.3));
			_p.set(rock.x, groundHeight(rock.x, rock.z), rock.z);
			this.#rocks.setMatrixAt(i, _m.compose(_p, _q, _s));
		});
		this.#rocks.count = rocks.length;
		this.#rocks.instanceMatrix.needsUpdate = true;
	}

	#layRamps(cx: number, cz: number) {
		const ramps = rampsNear(cx, cz, HALF + 10).slice(0, MAX_RAMPS);
		this.#ramps.forEach((mesh, i) => {
			const ramp = ramps[i];
			const edges = this.#rampEdges[i];
			mesh.visible = edges.visible = Boolean(ramp);
			if (!ramp) return;
			mesh.geometry.dispose();
			edges.geometry.dispose();
			mesh.geometry = rampGeometry(ramp);
			edges.geometry = new EdgesGeometry(mesh.geometry, 20);
		});
	}
}

/** A ramp as a rock slab: a wedge rising toward its far end, buried at the bottom. */
export function rampGeometry(r: Ramp): BufferGeometry {
	const s = Math.sin(r.angle);
	const c = Math.cos(r.angle);
	const at = (u: number, v: number, y: number) => {
		const du = u - r.length / 2;
		return new Vector3(r.x - s * du - c * v, y, r.z - c * du + s * v);
	};
	const half = r.width / 2;
	const floor = r.base - 1.2;
	const corners = [
		at(0, -half, floor),
		at(r.length, -half, floor),
		at(r.length, half, floor),
		at(0, half, floor),
		at(0, -half, r.base),
		at(r.length, -half, r.base + r.height),
		at(r.length, half, r.base + r.height),
		at(0, half, r.base)
	];
	const centre = corners.reduce((sum, v) => sum.add(v), new Vector3()).divideScalar(8);
	return facetGeometry(
		hexahedron(corners).map((tri) => ({ tri })),
		centre
	);
}

/**
 * Dust kicked up behind the wheels: a pool of soft points in world space, each rising,
 * drifting and fading over about a second.
 */
export class Dust {
	readonly points: Points;
	#pos: Float32Array;
	#col: Float32Array;
	#vel: Float32Array;
	#age: Float32Array;
	#life: Float32Array;
	#next = 0;
	#tint: Color;
	#seed = 1;

	constructor(
		p: Palette,
		glow: Texture,
		readonly count = 420
	) {
		this.#pos = new Float32Array(count * 3);
		this.#col = new Float32Array(count * 4);
		this.#vel = new Float32Array(count * 3);
		this.#age = new Float32Array(count).fill(1);
		this.#life = new Float32Array(count).fill(1);
		this.#tint = p.hullLower.clone().lerp(p.violetBright, 0.15);
		const g = new BufferGeometry();
		const pos = new BufferAttribute(this.#pos, 3);
		pos.setUsage(DynamicDrawUsage);
		const col = new BufferAttribute(this.#col, 4);
		col.setUsage(DynamicDrawUsage);
		g.setAttribute('position', pos);
		g.setAttribute('color', col);
		this.points = new Points(
			g,
			new PointsMaterial({
				size: 0.75,
				map: glow,
				vertexColors: true,
				transparent: true,
				depthWrite: false,
				sizeAttenuation: true
			})
		);
		this.points.name = 'dust';
		this.points.frustumCulled = false;
	}

	#random() {
		this.#seed = (this.#seed * 16807) % 2147483647;
		return this.#seed / 2147483647;
	}

	/** One puff at `at`, carried by `drift` (m/s) and rising at `rise`. */
	emit(at: Vector3, drift: Vector3, rise: number) {
		const i = this.#next;
		this.#next = (i + 1) % this.count;
		const r = () => this.#random() - 0.5;
		this.#pos.set([at.x + r() * 0.4, at.y + 0.05, at.z + r() * 0.4], i * 3);
		this.#vel.set(
			[drift.x + r() * 1.4, rise * (0.6 + this.#random() * 0.8), drift.z + r() * 1.4],
			i * 3
		);
		this.#age[i] = 0;
		this.#life[i] = 0.7 + this.#random() * 0.8;
	}

	update(dt: number) {
		const pos = this.#pos;
		const vel = this.#vel;
		const drag = Math.exp(-1.8 * dt);
		for (let i = 0; i < this.count; i++) {
			const k = i * 3;
			const a = (this.#age[i] += dt / this.#life[i]);
			const alive = a < 1;
			if (alive) {
				vel[k] *= drag;
				vel[k + 1] = vel[k + 1] * drag - 0.6 * dt;
				vel[k + 2] *= drag;
				pos[k] += vel[k] * dt;
				pos[k + 1] += vel[k + 1] * dt;
				pos[k + 2] += vel[k + 2] * dt;
			}
			const fade = alive ? (1 - a) * Math.min(1, a * 6) * 0.42 : 0;
			this.#col.set([this.#tint.r, this.#tint.g, this.#tint.b, fade], i * 4);
		}
		this.points.geometry.attributes.position.needsUpdate = true;
		this.points.geometry.attributes.color.needsUpdate = true;
	}
}
