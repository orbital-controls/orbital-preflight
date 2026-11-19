import {
	AdditiveBlending,
	BoxGeometry,
	BufferGeometry,
	CanvasTexture,
	CircleGeometry,
	Color,
	ConeGeometry,
	CylinderGeometry,
	EdgesGeometry,
	Float32BufferAttribute,
	Group,
	LineBasicMaterial,
	LineSegments,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Object3D,
	PlaneGeometry,
	SpotLight,
	Sprite,
	SpriteMaterial,
	SRGBColorSpace,
	TorusGeometry,
	Vector3,
	type Material,
	type Texture
} from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { ORIGIN_X, WHEEL_RADIUS, WHEELS } from '../drive.ts';
import { WICK_ROOT } from '../parts.ts';
import { convexCorners, grow, prismPlanes, slab, type Plane, type V3 } from './convex.ts';
import { facetGeometry, hexahedron, type Tri } from './geometry.ts';
import type { Palette } from './palette.ts';

/**
 * The Wick LR, built procedurally from the v0.4 block-out numbers (StandWickLR3D). Every
 * part the scene moves is a named node (see ../parts.ts), so a glTF from Blender with the
 * same names and pivots can stand in for this.
 *
 * The numbers below are the block-out's: metres, x forward from the tail, y to the
 * left, z up from the ground. `w()` takes them into three.js, with the origin on the
 * ground between the axles.
 */
export function w(x: number, y: number, z: number): Vector3 {
	return new Vector3(-y, z, -(x - ORIGIN_X));
}

const mirror = (pts: [number, number][]): [number, number][] => [
	...pts,
	...pts
		.slice()
		.reverse()
		.map(([a, b]) => [a, -b] as [number, number])
];

/** Plan (x, y), nose first, left side; mirrored for the right. */
const PLAN = mirror([
	[5.4, 0.34],
	[5.07, 0.82],
	[4.23, 1.03],
	[0.81, 1.03],
	[0.16, 0.8],
	[0, 0.32]
]);
/** Side profile (x, z). */
const PROFILE: [number, number][] = [
	[5.4, 0.965],
	[5.06, 1.38],
	[4.25, 1.51],
	[0.81, 1.59],
	[0.13, 1.41],
	[0, 0.887],
	[0.26, 0.6],
	[5.14, 0.6]
];
/** Front section (y, z). */
const SECTION: [number, number][] = [
	[1.03, 0.93],
	[0.71, 1.59],
	[-0.71, 1.59],
	[-1.03, 0.93],
	[-0.71, 0.6],
	[0.71, 0.6]
];
/** Cabin glass rings (x, z, half-width). */
const CABIN: [number, number, number][] = [
	[4.92, 1.36, 0.5],
	[4.52, 1.9, 0.48],
	[3.55, 1.98, 0.58],
	[2.8, 1.96, 0.6],
	[2.62, 1.78, 0.64],
	[2.62, 1.4, 0.72],
	[4.4, 1.4, 0.66]
];
/** Fender profile per wheel: (x offset from the wheel, inner z, outer z). */
const FENDER: [number, number, number][] = [
	[-0.72, 0.9, 0.66],
	[-0.44, 1.2, 1.02],
	[0.44, 1.2, 1.02],
	[0.72, 0.9, 0.66]
];
const FENDER_Y = { inner: 0.98, outer: 1.62, thick: 0.07 };
export const WHEEL = { major: 0.39, tube: 0.13, glow: 0.25, glowTube: 0.024 };

/** The driver's eye, left front seat, in block-out coordinates. */
export const DRIVER_EYE: V3 = [3.42, 0.32, 1.78];

const BODY_PLANES: Plane[] = [
	...prismPlanes(PLAN, 0, 1),
	...prismPlanes(PROFILE, 0, 2),
	...prismPlanes(SECTION, 1, 2)
];

/** Height of the upper side facet (above the waist crease) at z, as a half-width. */
function upperSideY(z: number): number {
	return 1.03 - ((z - 0.93) * 0.32) / 0.66;
}
function lowerSideY(z: number): number {
	return 1.03 - ((0.93 - z) * 0.32) / 0.33;
}
/** Roof facet of the cabin glass at x, between the front-top edge and the crown. */
function cabinRoofZ(x: number): number {
	return 1.9 + ((4.52 - x) * 0.08) / 0.97;
}

export interface WickMaterials {
	panel: MeshStandardMaterial;
	stripe: MeshStandardMaterial;
	glass: MeshStandardMaterial;
	edges: LineBasicMaterial;
	dark: MeshStandardMaterial;
	metal: MeshStandardMaterial;
	seat: MeshStandardMaterial;
	wheel: MeshStandardMaterial;
	damper: MeshStandardMaterial;
	glowRing: MeshBasicMaterial;
	lamp: MeshBasicMaterial;
	strip: MeshBasicMaterial;
	tail: MeshBasicMaterial;
	seam: MeshBasicMaterial;
	jetCore: MeshBasicMaterial;
	plume: MeshBasicMaterial;
	plumeCore: MeshBasicMaterial;
	jetHalo: SpriteMaterial;
	lampHalo: SpriteMaterial;
	screens: MeshBasicMaterial[];
}

export function makeWickMaterials(p: Palette, glow: Texture): WickMaterials {
	const basic = (color: Color) =>
		new MeshBasicMaterial({ color: color.clone(), toneMapped: false });
	const additive = (color: Color, opacity: number) =>
		new MeshBasicMaterial({
			color: color.clone(),
			transparent: true,
			opacity,
			blending: AdditiveBlending,
			depthWrite: false,
			toneMapped: false
		});
	const halo = (color: Color) =>
		new SpriteMaterial({
			map: glow,
			color: color.clone(),
			blending: AdditiveBlending,
			depthWrite: false,
			transparent: true,
			toneMapped: false
		});
	return {
		panel: new MeshStandardMaterial({
			color: p.hull,
			roughness: 0.5,
			metalness: 0.22,
			flatShading: true
		}),
		stripe: new MeshStandardMaterial({
			color: p.violet,
			emissive: p.violet,
			emissiveIntensity: 0.35,
			roughness: 0.35,
			metalness: 0.2,
			flatShading: true
		}),
		// Dark tint: only the dash glow and the seat tops read through it.
		glass: new MeshStandardMaterial({
			color: p.glass.clone().lerp(p.violet, 0.3),
			roughness: 0.12,
			metalness: 0.3,
			transparent: true,
			opacity: 0.87,
			flatShading: true,
			envMapIntensity: 1.3
		}),
		edges: new LineBasicMaterial({ color: p.ground.clone(), transparent: true, opacity: 0.85 }),
		dark: new MeshStandardMaterial({ color: new Color('#14162E'), roughness: 0.8, metalness: 0.2 }),
		metal: new MeshStandardMaterial({
			color: p.metal,
			roughness: 0.55,
			metalness: 0.45,
			flatShading: true
		}),
		seat: new MeshStandardMaterial({ color: p.trim, roughness: 0.85, metalness: 0.1 }),
		wheel: new MeshStandardMaterial({
			color: p.violet,
			emissive: p.violet,
			emissiveIntensity: 0.3,
			roughness: 0.38,
			metalness: 0.3
		}),
		damper: new MeshStandardMaterial({
			color: p.gold,
			emissive: p.gold,
			emissiveIntensity: 0.15,
			roughness: 0.4,
			metalness: 0.6
		}),
		glowRing: basic(p.gold),
		lamp: basic(p.gold),
		strip: basic(p.gold),
		tail: basic(p.gold),
		seam: basic(p.gold),
		jetCore: basic(p.violetBright),
		plume: additive(p.violet, 0.55),
		plumeCore: additive(p.violetBright, 0.8),
		jetHalo: halo(p.violetBright),
		lampHalo: halo(p.gold),
		screens: []
	};
}

function mesh(geometry: BufferGeometry, material: Material, name = ''): Mesh {
	const out = new Mesh(geometry, material);
	out.name = name;
	return out;
}

/** An axis-aligned box from block-out ranges. */
function box(
	x: [number, number],
	y: [number, number],
	z: [number, number],
	material: Material,
	name = ''
): Mesh {
	const b = new Mesh(new BoxGeometry(y[1] - y[0], z[1] - z[0], x[1] - x[0]), material);
	b.position.copy(w((x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2));
	b.name = name;
	return b;
}

function convex(planes: Plane[]): ConvexGeometry {
	return new ConvexGeometry(convexCorners(planes).map(([x, y, z]) => w(x, y, z)));
}

function outline(geometry: BufferGeometry, mat: WickMaterials, angle = 12): LineSegments {
	return new LineSegments(new EdgesGeometry(geometry, angle), mat.edges);
}

/** Line segments through block-out points, pairs of points per segment. */
function lines(points: V3[], mat: WickMaterials): LineSegments {
	const pos: number[] = [];
	for (const [x, y, z] of points) pos.push(...w(x, y, z).toArray());
	const g = new BufferGeometry();
	g.setAttribute('position', new Float32BufferAttribute(pos, 3));
	return new LineSegments(g, mat.edges);
}

/** A closed outline drawn on a side facet, just proud of it. */
function sideLoop(pts: [number, number][], side: 1 | -1, upper: boolean): V3[] {
	const out: V3[] = [];
	const at = ([x, z]: [number, number]): V3 => [
		x,
		side * ((upper ? upperSideY(z) : lowerSideY(z)) + 0.006),
		z
	];
	for (let i = 0; i < pts.length; i++) out.push(at(pts[i]), at(pts[(i + 1) % pts.length]));
	return out;
}

function body(mat: WickMaterials): Group {
	const g = new Group();
	g.name = 'body';
	const geometry = convex(BODY_PLANES);
	g.add(mesh(geometry, mat.panel), outline(geometry, mat));

	// The driver's door (left side), with its chamfered front-top corner and handle.
	const door: [number, number][] = [
		[4.2, 1.0],
		[3.42, 1.0],
		[3.42, 1.5],
		[3.95, 1.5],
		[4.2, 1.3]
	];
	const detail: V3[] = sideLoop(door, 1, true);
	// Two panel seams down each side, above and below the waist.
	for (const x of [2.64, 1.71])
		for (const side of [1, -1] as const) {
			detail.push([x, side * (upperSideY(0.99) + 0.006), 0.99]);
			detail.push([x, side * (upperSideY(1.56) + 0.006), 1.56]);
			detail.push([x, side * (lowerSideY(0.85) + 0.006), 0.85]);
			detail.push([x, side * (lowerSideY(0.63) + 0.006), 0.63]);
		}
	g.add(lines(detail, mat));
	const handle = box([3.52, 3.68], [0, 0.03], [1.31, 1.34], mat.dark);
	handle.position.x = -(upperSideY(1.325) + 0.012);
	g.add(handle);
	// The step under the door.
	g.add(box([3.45, 4.15], [0.98, 1.12], [0.52, 0.57], mat.dark));
	return g;
}

function stripe(mat: WickMaterials): Mesh {
	return mesh(convex([...grow(BODY_PLANES, 0.015), ...slab(0.86, 0.99)]), mat.stripe, 'stripe');
}

function cabin(mat: WickMaterials): Object3D[] {
	const pts = CABIN.flatMap(([x, z, hw]) => [w(x, hw, z), w(x, -hw, z)]);
	const geometry = new ConvexGeometry(pts);
	const glass = mesh(geometry, mat.glass, 'cabinGlass');
	// The glass edges stay in the driver's view, where the glass itself is hidden.
	const frame = outline(geometry, mat, 8);
	frame.name = 'cabinFrame';
	// Flush on the roof facet: a top face only, so from the seats it doesn't fill the view.
	const strip = mesh(new PlaneGeometry(0.88, 0.2).rotateX(-Math.PI / 2), mat.strip, 'lightStrip');
	strip.position.copy(w(4.4, 0, cabinRoofZ(4.4) + 0.006));
	strip.rotation.x = -Math.atan(0.08 / 0.97);
	// Its front edge wraps the glass's front-top edge: the gold line the driver sees.
	const lip = new Mesh(new CylinderGeometry(0.009, 0.009, 0.86, 6).rotateZ(Math.PI / 2), mat.strip);
	// In the strip's frame (its slight lean doesn't matter for a 2 cm rod).
	lip.position.copy(w(4.51, 0, 1.895)).sub(strip.position);
	strip.add(lip);
	return [glass, frame, strip];
}

function seat(name: string, x: number, y: number, top: number, width: number, mat: WickMaterials) {
	const g = new Group();
	g.name = name;
	g.add(box([x, x + 0.12], [y - width / 2, y + width / 2], [1.1, top], mat.seat));
	g.add(box([x, x + 0.5], [y - width / 2, y + width / 2], [1.05, 1.18], mat.seat));
	return g;
}

function screenTexture(): CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 256;
	canvas.height = 128;
	const t = new CanvasTexture(canvas);
	t.colorSpace = SRGBColorSpace;
	return t;
}

/** The dash and its three screens (violet / gold / violet): Drive, Recall, Range. */
function dash(p: Palette, mat: WickMaterials): Group {
	const g = new Group();
	g.name = 'dash';
	g.add(box([4.3, 4.5], [-0.62, 0.62], [1.47, 1.67], mat.dark));
	const specs: [string, number, number, number, Color][] = [
		['screenDrive', 0.33, 0.3, 0.15, p.violetBright],
		['screenRecall', 0, 0.13, 0.17, p.gold],
		['screenRange', -0.33, 0.3, 0.15, p.violetBright]
	];
	for (const [name, y, width, height, frame] of specs) {
		const material = new MeshBasicMaterial({ map: screenTexture(), toneMapped: false });
		mat.screens.push(material);
		const screen = mesh(new PlaneGeometry(width, height), material, name);
		// On the dash's back face, tipped back toward the driver's eye.
		screen.position.copy(w(4.285, y, 1.62));
		screen.rotation.x = -0.45;
		const border = new Mesh(
			new PlaneGeometry(width + 0.016, height + 0.016),
			new MeshBasicMaterial({ color: frame.clone().multiplyScalar(0.8), toneMapped: false })
		);
		border.position.z = -0.002;
		screen.add(border);
		g.add(screen);
	}
	return g;
}

function rack(mat: WickMaterials): Object3D[] {
	const g = new Group();
	g.name = 'rack';
	for (const y of [0.62, -0.62]) {
		g.add(box([0.55, 2.05], [y - 0.025, y + 0.025], [1.66, 1.71], mat.dark));
		for (const x of [0.62, 1.98])
			g.add(box([x - 0.025, x + 0.025], [y - 0.02, y + 0.02], [1.5, 1.68], mat.dark));
	}
	for (const x of [0.6, 1.62, 2.0])
		g.add(box([x - 0.02, x + 0.02], [-0.62, 0.62], [1.665, 1.705], mat.dark));

	const cell = new Group();
	cell.name = 'spareCell';
	const core = box([0.75, 1.45], [-0.42, 0.42], [1.62, 1.86], mat.metal);
	const coreEdges = outline(core.geometry, mat);
	coreEdges.position.copy(core.position);
	cell.add(core, coreEdges);
	const seam = box([0.742, 1.458], [-0.428, 0.428], [1.79, 1.805], mat.seam, 'cellSeam');
	cell.add(seam);
	return [g, cell];
}

/** A hexahedron per profile segment, merged into one flat-shaded shell. */
function fenderGeometry(cx: number, side: 1 | -1, p: Palette): BufferGeometry {
	const parts: BufferGeometry[] = [];
	const col: [number, number, number] = [p.hull.r, p.hull.g, p.hull.b];
	for (let k = 0; k < FENDER.length - 1; k++) {
		const [a, b] = [FENDER[k], FENDER[k + 1]];
		const top = [
			w(cx + a[0], side * FENDER_Y.inner, a[1]),
			w(cx + a[0], side * FENDER_Y.outer, a[2]),
			w(cx + b[0], side * FENDER_Y.outer, b[2]),
			w(cx + b[0], side * FENDER_Y.inner, b[1])
		];
		const bottom = top.map((v) => v.clone().setY(v.y - FENDER_Y.thick));
		const corners = [...bottom, ...top];
		const centre = corners.reduce((s, v) => s.add(v), new Vector3()).divideScalar(8);
		parts.push(
			facetGeometry(
				hexahedron(corners).map((tri: Tri) => ({ tri, color: col })),
				centre
			)
		);
	}
	return merge(parts);
}

function merge(parts: BufferGeometry[]): BufferGeometry {
	const out = new BufferGeometry();
	for (const key of ['position', 'normal', 'color']) {
		const arrays = parts.map((g) => g.getAttribute(key).array as Float32Array);
		const all = new Float32Array(arrays.reduce((n, a) => n + a.length, 0));
		let o = 0;
		for (const a of arrays) {
			all.set(a, o);
			o += a.length;
		}
		out.setAttribute(key, new Float32BufferAttribute(all, 3));
	}
	for (const g of parts) g.dispose();
	return out;
}

/** An A-arm: two bars meeting at the outer end, pivoting at the inner end. */
function arm(name: string, side: 1 | -1, length: number, mat: WickMaterials): Group {
	const g = new Group();
	g.name = name;
	g.userData = { side, length };
	for (const dz of [-0.16, 0.16]) {
		const bar = new Mesh(new BoxGeometry(Math.hypot(length, dz), 0.045, 0.045), mat.dark);
		bar.position.set((-side * length) / 2, 0, dz / 2);
		bar.rotation.y = -side * Math.atan2(dz, length);
		g.add(bar);
	}
	return g;
}

export const SUSPENSION_MOUNTS = {
	upper: { x: 0.8, y: 0.74, length: 0.4 },
	lower: { x: 0.78, y: 0.4, length: 0.42 },
	damperTop: { x: 0.74, y: 1.02, dz: 0.18 },
	/** Where the damper meets the lower arm, as a share of the arm's length. */
	damperAt: 0.7
} as const;

function corner(
	spec: (typeof WHEELS)[number],
	p: Palette,
	mat: WickMaterials,
	ring: TorusGeometry,
	glow: TorusGeometry
): Object3D[] {
	const { id, side } = spec;
	const wheel = new Group();
	wheel.name = `wheel${id}`;
	wheel.position.set(spec.x, WHEEL_RADIUS, spec.z);
	wheel.rotation.order = 'YXZ';
	wheel.userData = { restY: WHEEL_RADIUS, side };
	wheel.add(new Mesh(ring, mat.wheel));
	wheel.add(mesh(glow, mat.glowRing, `wheelGlow${id}`));

	const M = SUSPENSION_MOUNTS;
	const upper = arm(`armUpper${id}`, side, M.upper.length, mat);
	upper.position.set(-side * M.upper.x, M.upper.y, spec.z);
	const lower = arm(`armLower${id}`, side, M.lower.length, mat);
	lower.position.set(-side * M.lower.x, M.lower.y, spec.z);

	const damper = new Group();
	damper.name = `damper${id}`;
	damper.position.set(-side * M.damperTop.x, M.damperTop.y, spec.z + M.damperTop.dz / 2);
	const bottom = new Vector3(
		-side * (M.lower.x + M.lower.length * M.damperAt),
		M.lower.y,
		spec.z + M.damperTop.dz / 2
	);
	const restLength = bottom.distanceTo(damper.position);
	damper.userData = { restLength };
	const coil = new Mesh(new CylinderGeometry(0.04, 0.04, restLength, 10), mat.damper);
	coil.position.y = -restLength / 2;
	damper.add(coil);

	const fender = new Group();
	fender.name = `fender${id}`;
	fender.position.y = WHEEL_RADIUS;
	fender.userData = { restY: WHEEL_RADIUS };
	const cx = ORIGIN_X - spec.z;
	const geometry = fenderGeometry(cx, side, p);
	geometry.translate(0, -WHEEL_RADIUS, 0);
	fender.add(new Mesh(geometry, mat.panel), outline(geometry, mat, 15));
	return [wheel, upper, lower, damper, fender];
}

function lamps(mat: WickMaterials): { parts: Object3D[]; spots: SpotLight[] } {
	const parts: Object3D[] = [];
	const spots: SpotLight[] = [];
	for (const [name, y] of [
		['noseLampL', 0.19],
		['noseLampR', -0.19]
	] as const) {
		const lamp = new Group();
		lamp.name = name;
		lamp.position.copy(w(5.315, y, 1.06));
		// Set into the upper nose facet, which leans back about 39°.
		lamp.rotation.x = Math.atan(0.34 / 0.415);
		lamp.add(new Mesh(new BoxGeometry(0.13, 0.08, 0.04), mat.lamp));
		const glow = new Sprite(mat.lampHalo);
		glow.scale.setScalar(0.45);
		glow.position.z = -0.03;
		lamp.add(glow);
		parts.push(lamp);

		const spot = new SpotLight(0xfff1cf, 0, 70, 0.42, 0.55, 1.2);
		spot.position.copy(w(5.36, y, 1.06));
		spot.target.position.copy(w(18, y * 2, 0));
		parts.push(spot, spot.target);
		spots.push(spot);
	}
	return { parts, spots };
}

/** Rear: tail strip, hatch, winch and hook, two hop jets with their plumes. */
function rear(mat: WickMaterials): { parts: Object3D[]; halos: Sprite[] } {
	const parts: Object3D[] = [];
	const lean = Math.atan(0.13 / 0.523);
	const onRear = (z: number) => (0.13 * (z - 0.887)) / 0.523;

	const tail = box([0, 0.022], [-0.52, 0.52], [-0.03, 0.03], mat.tail, 'tailLight');
	tail.position.copy(w(onRear(1.3) - 0.012, 0, 1.3));
	tail.rotation.x = -lean;
	parts.push(tail);

	const hatch = new Group();
	hatch.name = 'hatch';
	hatch.position.copy(w(onRear(1.24) - 0.008, 0, 1.24));
	hatch.rotation.x = -lean;
	const plate = new Mesh(new BoxGeometry(0.8, 0.258, 0.012), mat.panel);
	plate.position.y = -0.129;
	const plateEdges = outline(plate.geometry, mat);
	plateEdges.position.copy(plate.position);
	const handle = new Mesh(new BoxGeometry(0.14, 0.022, 0.02), mat.dark);
	handle.position.set(0, -0.205, 0.012);
	hatch.add(plate, plateEdges, handle);
	parts.push(hatch);

	const winch = new Group();
	winch.name = 'winch';
	winch.position.copy(w(-0.1, 0, 0.61));
	const drum = new Mesh(new CylinderGeometry(0.09, 0.09, 0.48, 16).rotateZ(Math.PI / 2), mat.metal);
	winch.add(drum);
	for (const s of [-1, 1]) {
		const cap = new Mesh(new CylinderGeometry(0.1, 0.1, 0.03, 16).rotateZ(Math.PI / 2), mat.seam);
		cap.position.x = s * 0.255;
		const bracket = new Mesh(new BoxGeometry(0.04, 0.06, 0.38), mat.dark);
		bracket.position.set(s * 0.29, 0, -0.17);
		winch.add(cap, bracket);
	}
	const hook = new Group();
	hook.name = 'winchHook';
	hook.position.set(0.06, -0.09, 0.02);
	const line = new Mesh(new CylinderGeometry(0.008, 0.008, 0.14, 6), mat.dark);
	line.position.y = -0.07;
	const claw = new Mesh(new TorusGeometry(0.035, 0.012, 6, 12, Math.PI * 1.3), mat.dark);
	claw.position.y = -0.17;
	claw.rotation.z = Math.PI * 0.85;
	hook.add(line, claw);
	winch.add(hook);
	parts.push(winch);

	const halos: Sprite[] = [];
	for (const [id, y] of [
		['L', 0.42],
		['R', -0.42]
	] as const) {
		const jet = new Group();
		jet.name = `jet${id}`;
		jet.position.copy(w(-0.14, y, 0.8));
		const housing = new Mesh(new BoxGeometry(0.3, 0.28, 0.3), mat.dark);
		housing.position.z = -0.15;
		const housingEdges = outline(housing.geometry, mat);
		housingEdges.position.copy(housing.position);
		const core = new Mesh(new CircleGeometry(0.085, 20), mat.jetCore);
		core.position.z = 0.004;
		const halo = new Sprite(mat.jetHalo);
		halo.position.z = 0.05;
		halos.push(halo);

		const plume = new Group();
		plume.name = `plume${id}`;
		// Angled down and aft: the jets lift as well as push.
		plume.rotation.x = 0.26;
		const outer = new Mesh(
			new ConeGeometry(0.1, 1, 14, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5),
			mat.plume
		);
		const inner = new Mesh(
			new ConeGeometry(0.05, 0.7, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.35),
			mat.plumeCore
		);
		plume.add(outer, inner);
		plume.visible = false;
		jet.add(housing, housingEdges, core, halo, plume);
		parts.push(jet);
	}
	return { parts, halos };
}

export interface Wick {
	root: Group;
	/** The headlights (one per nose lamp), aimed ahead and down. */
	headlights: SpotLight[];
	/** The jets' glow sprites, scaled with the jet glow. */
	jetHalos: Sprite[];
	/** The dash screens' canvas textures: Drive, Recall, Range. */
	screens: { drive: CanvasTexture; recall: CanvasTexture; range: CanvasTexture };
}

export function buildWick(p: Palette, mat: WickMaterials): Wick {
	const root = new Group();
	root.name = WICK_ROOT;
	root.add(body(mat), stripe(mat), ...cabin(mat));
	// The cabin floor, so the deck under the glass reads dark from the seats.
	root.add(box([2.66, 4.28], [-0.62, 0.62], [1.4, 1.56], mat.dark));
	root.add(
		seat('seatL', 3.22, 0.33, 1.88, 0.42, mat),
		seat('seatR', 3.22, -0.33, 1.88, 0.42, mat),
		seat('jumpSeat', 2.7, 0, 1.82, 0.4, mat),
		dash(p, mat)
	);
	root.add(...rack(mat));
	const ring = new TorusGeometry(WHEEL.major, WHEEL.tube, 14, 40).rotateY(Math.PI / 2);
	const glow = new TorusGeometry(WHEEL.glow, WHEEL.glowTube, 6, 40).rotateY(Math.PI / 2);
	for (const spec of WHEELS) root.add(...corner(spec, p, mat, ring, glow));
	const front = lamps(mat);
	root.add(...front.parts);
	const back = rear(mat);
	root.add(...back.parts);
	const tex = (name: string) =>
		((root.getObjectByName(name) as Mesh).material as MeshBasicMaterial).map as CanvasTexture;
	return {
		root,
		headlights: front.spots,
		jetHalos: back.halos,
		screens: { drive: tex('screenDrive'), recall: tex('screenRecall'), range: tex('screenRange') }
	};
}
