import {
	AdditiveBlending,
	BoxGeometry,
	CircleGeometry,
	Color,
	CylinderGeometry,
	DoubleSide,
	EdgesGeometry,
	ExtrudeGeometry,
	Group,
	LatheGeometry,
	LineBasicMaterial,
	LineSegments,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Object3D,
	Shape,
	SpotLight,
	Sprite,
	SpriteMaterial,
	Texture,
	Vector2,
	Vector3,
	type BufferGeometry,
	type Material
} from 'three';
import { SHIP_ROOT } from '../parts.ts';
import { TURRET_TRAVEL } from '../targets.ts';
import {
	band,
	centroid,
	facetGeometry,
	fan,
	hexahedron,
	inset,
	m,
	sheet,
	skin,
	smoothRing,
	type Tri
} from './geometry.ts';
import type { Palette } from './palette.ts';

/**
 * The Lantern II, built procedurally from the 2D sheet's block-out numbers. Every part
 * the animation moves is a named node (see ../parts.ts); a glTF with the same names and
 * pivots can stand in for this.
 */

/** The hull outline, top view, nose first (the sheet's px). */
const OUTLINE_PX: [number, number][] = [
	[690, 210],
	[650, 140],
	[560, 124],
	[300, 124],
	[238, 150],
	[222, 210],
	[238, 270],
	[300, 296],
	[560, 296],
	[650, 280]
];
const CANOPY_PX: [number, number][] = [
	[664, 210],
	[636, 158],
	[588, 152],
	[572, 168],
	[572, 252],
	[588, 268],
	[636, 262]
];

const OUTLINE = OUTLINE_PX.map(([x, y]) => sheet(x, y));
const CENTRE: [number, number] = [0.6, 0];

export const ROOF = 4.4;
export const BELLY = -3.6;
export const RING = { x: -22.2, y: 12.6, z: 3.2, radius: 2.7, wall: 0.6, length: 8.4 };

/** The hull's layers, bottom to top: height, scale toward the centre, and nose drop. */
const LAYERS = [
	{ z: BELLY, s: 0.8, drop: [0, 0] },
	{ z: -1.6, s: 1, drop: [0, 0] },
	{ z: 2.4, s: 1, drop: [1.0, 0.3] },
	{ z: ROOF, s: 0.84, drop: [1.4, 0.6] }
];

function layerRing(layer: (typeof LAYERS)[number], grow = 0): Vector3[] {
	return OUTLINE.map(([x, y], i) => {
		const s = layer.s + grow;
		const px = CENTRE[0] + (x - CENTRE[0]) * s;
		const py = CENTRE[1] + (y - CENTRE[1]) * s;
		// Nose chamfered down: the tip drops most, its neighbours a little.
		const drop = i === 0 ? layer.drop[0] : i === 1 || i === OUTLINE.length - 1 ? layer.drop[1] : 0;
		return m(px, py, layer.z - drop);
	});
}

interface Built {
	root: Group;
	materials: ShipMaterials;
	/** Muzzles for tracers, in ring-local space under each turret. */
	muzzles: Object3D[];
	/** Ring glow halo sprites, scaled with the glow. */
	halos: Sprite[];
	noseSpot: SpotLight;
}

export interface ShipMaterials {
	hull: MeshStandardMaterial;
	trim: MeshStandardMaterial;
	violet: MeshStandardMaterial;
	stripe: MeshStandardMaterial;
	glass: MeshStandardMaterial;
	ring: MeshStandardMaterial;
	glow: MeshBasicMaterial;
	core: MeshBasicMaterial;
	intake: MeshBasicMaterial;
	dark: MeshStandardMaterial;
	running: MeshBasicMaterial;
	nose: MeshBasicMaterial;
	tail: MeshBasicMaterial;
	edges: LineBasicMaterial;
	halo: SpriteMaterial;
	/** The hull colour for plain boxes (the hull itself uses per-face colours). */
	panel: MeshStandardMaterial;
	hullMid: MeshStandardMaterial;
	hullLower: MeshStandardMaterial;
}

function rgb(c: Color): [number, number, number] {
	return [c.r, c.g, c.b];
}

function mesh(geometry: BufferGeometry, material: Material, name = ''): Mesh {
	const out = new Mesh(geometry, material);
	out.name = name;
	return out;
}

function hull(p: Palette, mat: ShipMaterials): Group {
	const rings = LAYERS.map((l) => layerRing(l));
	const centre = m(0.6, 0, 0.4);
	const tris: { tri: Tri; color: [number, number, number] }[] = [];
	const colors = [rgb(p.hullLower), rgb(p.hullMid), rgb(p.hull)];
	for (let i = 0; i < rings.length - 1; i++)
		for (const tri of band(rings[i], rings[i + 1])) tris.push({ tri, color: colors[i] });
	for (const tri of fan(rings[0], centroid(rings[0]))) tris.push({ tri, color: rgb(p.hullLower) });
	const roofCentre = centroid(rings[3]);
	roofCentre.y = ROOF;
	for (const tri of fan(rings[3], roofCentre)) tris.push({ tri, color: rgb(p.hull) });
	const geometry = facetGeometry(tris, centre);
	const group = new Group();
	group.name = 'hull';
	group.add(mesh(geometry, mat.hull));
	// The facets are the look: a faint line on every crease.
	group.add(new LineSegments(new EdgesGeometry(geometry, 18), mat.edges));
	return group;
}

/** The violet waist stripe, a band just proud of the side. */
function stripe(mat: ShipMaterials): Mesh {
	const ring = (z: number) =>
		OUTLINE.map(([x, y]) => {
			const k = 1.006;
			return m(CENTRE[0] + (x - CENTRE[0]) * k, CENTRE[1] + (y - CENTRE[1]) * k, z);
		});
	const geometry = facetGeometry(
		band(ring(0.1), ring(0.85)).map((tri) => ({ tri })),
		m(0.6, 0, 0.45)
	);
	return mesh(geometry, mat.stripe, 'stripe');
}

/** One smooth, seamless glass surface: no frame bars, no centre strut. */
function canopy(mat: ShipMaterials): Mesh {
	const base = CANOPY_PX.map(([x, y], i) => {
		const [mx, my] = sheet(x, y);
		const z = i === 0 ? 2.6 : i === 1 || i === 6 ? 3.95 : ROOF - 0.05;
		return m(mx, my, z);
	});
	const top = CANOPY_PX.map((_, i) => (i === 0 ? 4.8 : i === 1 || i === 6 ? 5.85 : 6.2));
	const smoothBase = smoothRing(base, 40);
	const smoothTopZ = smoothRing(
		base.map((b, i) => new Vector3(b.x, top[i], b.z)),
		40
	).map((v) => v.y);
	const c = centroid(smoothBase);
	const rings = [
		{ d: 0, h: 0 },
		{ d: 0.12, h: 0.45 },
		{ d: 0.33, h: 0.8 },
		{ d: 0.7, h: 1 }
	].map(({ d, h }) =>
		smoothBase.map((b, i) => {
			const v = inset(b, c, d);
			v.y = b.y + (smoothTopZ[i] - b.y) * h;
			return v;
		})
	);
	const capCentre = centroid(rings[3]);
	capCentre.y += 0.06;
	return mesh(skin(rings, capCentre), mat.glass, 'canopyGlass');
}

/** A short duct: the elongated-torus section revolved, axis along Z. */
function ductGeometry(): LatheGeometry {
	const r0 = RING.radius - RING.wall;
	const t = RING.wall / 2;
	const rc = r0 + t;
	const half = RING.length / 2 - t;
	const pts: Vector2[] = [];
	const arc = (cx: number, cy: number, from: number, to: number) => {
		for (let i = 0; i <= 8; i++) {
			const a = from + ((to - from) * i) / 8;
			pts.push(new Vector2(cx + Math.cos(a) * t, cy + Math.sin(a) * t));
		}
	};
	// Inner wall front to back, the rear lip, outer wall back to front, the front lip.
	arc(rc, -half, Math.PI, Math.PI * 1.5);
	arc(rc, -half, Math.PI * 1.5, Math.PI * 2);
	arc(rc, half, 0, Math.PI / 2);
	arc(rc, half, Math.PI / 2, Math.PI);
	pts.push(pts[0].clone());
	const g = new LatheGeometry(pts, 48);
	// Lathe's axis is Y; the duct's is Z (forward is -Z).
	g.rotateX(Math.PI / 2);
	return g;
}

function ring(side: 1 | -1, p: Palette, mat: ShipMaterials, built: Built): Group {
	const g = new Group();
	g.name = side > 0 ? 'ringL' : 'ringR';
	g.position.copy(m(RING.x, RING.y * side, RING.z));
	g.add(mesh(ductGeometry(), mat.ring));

	const r0 = RING.radius - RING.wall;
	// Gold glow deep inside, a hotter core, and a dark intake at the front.
	const glow = new Group();
	glow.name = side > 0 ? 'ringGlowL' : 'ringGlowR';
	const disc = mesh(new CircleGeometry(r0 * 0.98, 40), mat.glow);
	disc.position.z = 0.6;
	const core = mesh(new CircleGeometry(r0 * 0.45, 32), mat.core);
	core.position.z = 0.65;
	glow.add(disc, core);
	g.add(glow);
	const intake = mesh(new CircleGeometry(r0 * 0.98, 40), mat.intake);
	intake.position.z = -1.2;
	intake.rotation.y = Math.PI;
	g.add(intake);

	const halo = new Sprite(mat.halo);
	halo.position.z = RING.length / 2 + 0.4;
	halo.scale.setScalar(6);
	g.add(halo);
	built.halos.push(halo);

	// Running lights: two markers on top of the duct.
	for (const z of [-3.2, 3.2]) {
		const light = mesh(new BoxGeometry(0.35, 0.18, 0.6), mat.running);
		light.position.set(0, RING.radius + 0.05, z);
		g.add(light);
	}

	// The turret sits in the ring's lower wall and slides forward out of the front lip.
	const turret = new Group();
	turret.name = side > 0 ? 'turretL' : 'turretR';
	turret.position.set(0, -(r0 + RING.wall / 2), -1.6);
	const housing = mesh(new BoxGeometry(0.62, 0.5, 1.6), mat.trim);
	housing.position.z = -0.4;
	const barrel = mesh(new CylinderGeometry(0.15, 0.18, 2.4, 10), mat.dark);
	barrel.rotation.x = Math.PI / 2;
	barrel.position.z = -1.4;
	const muzzle = new Object3D();
	muzzle.position.z = -2.7;
	turret.add(housing, barrel, muzzle);
	turret.userData.stowedZ = turret.position.z;
	turret.userData.travel = TURRET_TRAVEL;
	g.add(turret);
	built.muzzles.push(muzzle);
	void p;
	return g;
}

/** Wing-like pylon, swept back from the hull side to the ring's inner side. */
function pylon(side: 1 | -1, mat: ShipMaterials): Group {
	const g = new Group();
	g.name = side > 0 ? 'pylonL' : 'pylonR';
	const y = (v: number) => v * side;
	const rootZ = 2.1;
	const tipZ = RING.z;
	const rootT = 0.55;
	const tipT = 0.4;
	const tipY = RING.y - RING.radius + 0.35;
	const corners = [
		m(-13, y(8.2), rootZ - rootT),
		m(-20, y(6.2), rootZ - rootT),
		m(-24.6, y(tipY), tipZ - tipT),
		m(-19.6, y(tipY), tipZ - tipT),
		m(-13, y(8.2), rootZ + rootT),
		m(-20, y(6.2), rootZ + rootT),
		m(-24.6, y(tipY), tipZ + tipT),
		m(-19.6, y(tipY), tipZ + tipT)
	];
	const body = facetGeometry(
		hexahedron(corners).map((tri) => ({ tri })),
		centroid(corners)
	);
	g.add(mesh(body, mat.hull));
	g.add(new LineSegments(new EdgesGeometry(body, 18), mat.edges));
	// The violet leading edge.
	const le = [
		m(-12.6, y(8.3), rootZ - rootT * 0.7),
		m(-13.2, y(8.15), rootZ - rootT * 0.7),
		m(-19.8, y(tipY), tipZ - tipT * 0.7),
		m(-19.2, y(tipY), tipZ - tipT * 0.7),
		m(-12.6, y(8.3), rootZ + rootT * 0.7),
		m(-13.2, y(8.15), rootZ + rootT * 0.7),
		m(-19.8, y(tipY), tipZ + tipT * 0.7),
		m(-19.2, y(tipY), tipZ + tipT * 0.7)
	];
	g.add(
		mesh(
			facetGeometry(
				hexahedron(le).map((tri) => ({ tri })),
				centroid(le)
			),
			mat.violet
		)
	);
	return g;
}

/** A box from model-space extents. */
function box(
	x: [number, number],
	y: [number, number],
	z: [number, number],
	material: Material
): Mesh {
	const b = mesh(new BoxGeometry(y[1] - y[0], z[1] - z[0], x[1] - x[0]), material);
	b.position.copy(m((x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2));
	return b;
}

/** The stepped tail block, with the ramp, three vent slats and the amber tail lights. */
function tail(mat: ShipMaterials): Group {
	const g = new Group();
	g.name = 'tailBlock';
	const lower = box([-24.6, -20.4], [-4.5, 4.5], [-2.8, 0.6], mat.hullMid);
	const upper = box([-23.6, -20.4], [-3.4, 3.4], [0.6, 1.6], mat.panel);
	for (const b of [lower, upper]) {
		g.add(b);
		const edges = new LineSegments(new EdgesGeometry(b.geometry), mat.edges);
		edges.position.copy(b.position);
		g.add(edges);
	}
	// The opening behind the ramp, seen when it drops.
	const opening = mesh(new BoxGeometry(5.8, 2.9, 0.02), mat.dark);
	opening.position.copy(m(-24.615, 0, -1.2));
	g.add(opening);

	const ramp = new Group();
	ramp.name = 'rampDoor';
	ramp.position.copy(m(-24.6, 0, -2.7));
	const panel = mesh(new BoxGeometry(6, 3.05, 0.14), mat.hullMid);
	panel.position.set(0, 1.525, 0.07);
	ramp.add(panel);
	const seam = new LineSegments(new EdgesGeometry(panel.geometry), mat.edges);
	seam.position.copy(panel.position);
	ramp.add(seam);
	g.add(ramp);

	for (const z of [0.85, 1.1, 1.35])
		g.add(box([-23.72, -23.58], [-2.4, 2.4], [z, z + 0.14], mat.dark));

	const lights = new Group();
	lights.name = 'tailLights';
	lights.add(box([-24.68, -24.58], [3.1, 4.1], [0.05, 0.4], mat.tail));
	lights.add(box([-24.68, -24.58], [-4.1, -3.1], [0.05, 0.4], mat.tail));
	g.add(lights);
	return g;
}

/** Cargo-bay doors on the roof, hinged at their outer edges, and the violet panels aft. */
function bay(mat: ShipMaterials): Group[] {
	const out: Group[] = [];
	const x: [number, number] = [-12, 6];
	const cx = (x[0] + x[1]) / 2;
	const len = x[1] - x[0];
	const half = 3.4;
	for (const side of [1, -1] as const) {
		const door = new Group();
		door.name = side > 0 ? 'bayDoorL' : 'bayDoorR';
		door.position.copy(m(cx, half * side, ROOF));
		// From the hinge inward to the centre line (three's +X is starboard, so port doors grow +X).
		const panel = mesh(new BoxGeometry(half - 0.05, 0.14, len), mat.panel);
		panel.position.set((side * (half - 0.05)) / 2, 0.07, 0);
		door.add(panel);
		const seam = new LineSegments(new EdgesGeometry(panel.geometry), mat.edges);
		seam.position.copy(panel.position);
		door.add(seam);
		// Rotating about Z by openSign × angle lifts the inner edge: +1 on port, −1 starboard.
		door.userData.openSign = side;
		out.push(door);
	}
	return out;
}

function bayDetail(mat: ShipMaterials): Group {
	const g = new Group();
	// The hold under the doors.
	const hold = mesh(new BoxGeometry(6.7, 0.02, 17.8), mat.dark);
	hold.position.copy(m(-3, 0, ROOF + 0.005));
	g.add(hold);
	// Violet cut-corner panels behind the doors.
	for (const side of [1, -1]) {
		const s = new Shape();
		const w = 3.0;
		const l = 5.4;
		const c = 0.8;
		s.moveTo(c, 0);
		s.lineTo(w - c, 0);
		s.lineTo(w, c);
		s.lineTo(w, l - c);
		s.lineTo(w - c, l);
		s.lineTo(c, l);
		s.lineTo(0, l - c);
		s.lineTo(0, c);
		s.closePath();
		const plate = mesh(new ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false }), mat.violet);
		// Shape X → across the ship, shape Y → aft; lying on the roof.
		plate.rotation.x = Math.PI / 2;
		// Extruded downward, so it sits just proud of the roof; aft of X -12.6.
		plate.position.set(side > 0 ? -3.6 : 0.6, ROOF + 0.09, 12.6);
		g.add(plate);
	}
	return g;
}

/** Four short legs under the flat belly, each behind a door hinged at its outer edge. */
function gear(mat: ShipMaterials): Group[] {
	const out: Group[] = [];
	const spots: [string, number, number][] = [
		['FL', 12, 3.8],
		['FR', 12, -3.8],
		['RL', -11, 4.6],
		['RR', -11, -4.6]
	];
	for (const [id, x, y] of spots) {
		const leg = new Group();
		leg.name = `gear${id}`;
		leg.position.copy(m(x, y, -2.8));
		const strut = mesh(new CylinderGeometry(0.22, 0.28, 3.3, 10), mat.trim);
		strut.position.y = -1.65;
		const pad = mesh(new CylinderGeometry(0.62, 0.7, 0.2, 14), mat.dark);
		pad.position.y = -3.3;
		leg.add(strut, pad);
		out.push(leg);

		const side = y > 0 ? 1 : -1;
		const door = new Group();
		door.name = `gearDoor${id}`;
		// Hinge on the outer edge; the panel reaches inward and covers the stowed leg.
		door.position.copy(m(x - 1.75, y + 0.85 * side, BELLY));
		const plate = mesh(new BoxGeometry(1.7, 0.1, 3.9), mat.hullLower);
		plate.position.set(0.85 * side, -0.05, 0);
		door.add(plate);
		// Rotating about Z by openSign × angle drops the inner edge: −1 on port, +1 starboard.
		door.userData.openSign = -side;
		out.push(door);
	}
	return out;
}

function nose(mat: ShipMaterials, built: Built): Group {
	const g = new Group();
	g.name = 'noseLight';
	g.position.copy(m(24.02, 0, -0.1));
	const lamp = mesh(new BoxGeometry(1.3, 0.42, 0.12), mat.nose);
	g.add(lamp);
	const spot = new SpotLight(0xfff1cc, 0, 220, Math.PI / 7, 0.5, 1.4);
	spot.position.set(0, 0, -0.2);
	const target = new Object3D();
	target.position.set(0, -2, -40);
	g.add(spot, target);
	spot.target = target;
	built.noseSpot = spot;
	return g;
}

export function makeShipMaterials(p: Palette, glowTexture: Texture): ShipMaterials {
	const hullMid = new MeshStandardMaterial({ color: p.hullMid, roughness: 0.5, metalness: 0.25 });
	const hullLower = new MeshStandardMaterial({
		color: p.hullLower,
		roughness: 0.55,
		metalness: 0.25
	});
	const mats = {
		hull: new MeshStandardMaterial({
			vertexColors: true,
			flatShading: true,
			roughness: 0.48,
			metalness: 0.28
		}),
		trim: new MeshStandardMaterial({ color: p.trim, roughness: 0.6, metalness: 0.5 }),
		violet: new MeshStandardMaterial({
			color: p.violet,
			emissive: p.violet,
			emissiveIntensity: 0.25,
			roughness: 0.4,
			metalness: 0.3
		}),
		stripe: new MeshStandardMaterial({
			color: p.violet,
			emissive: p.violet,
			emissiveIntensity: 0.35,
			roughness: 0.35,
			metalness: 0.2,
			flatShading: true
		}),
		glass: new MeshStandardMaterial({
			color: p.glass,
			roughness: 0.06,
			metalness: 0.6,
			transparent: true,
			opacity: 0.94,
			side: DoubleSide,
			envMapIntensity: 1.4
		}),
		ring: new MeshStandardMaterial({
			color: p.violet,
			emissive: p.violet,
			emissiveIntensity: 0.12,
			roughness: 0.32,
			metalness: 0.45
		}),
		glow: new MeshBasicMaterial({ color: p.gold.clone(), toneMapped: false }),
		core: new MeshBasicMaterial({ color: new Color('#FFF4D6'), toneMapped: false }),
		intake: new MeshBasicMaterial({ color: p.ground }),
		dark: new MeshStandardMaterial({ color: new Color('#14162E'), roughness: 0.8, metalness: 0.2 }),
		running: new MeshBasicMaterial({ color: p.violetBright.clone(), toneMapped: false }),
		nose: new MeshBasicMaterial({ color: p.gold.clone(), toneMapped: false }),
		tail: new MeshBasicMaterial({ color: p.amber.clone(), toneMapped: false }),
		edges: new LineBasicMaterial({ color: new Color('#3A3D6B'), transparent: true, opacity: 0.5 }),
		halo: new SpriteMaterial({
			map: glowTexture,
			color: p.gold.clone(),
			blending: AdditiveBlending,
			depthWrite: false,
			transparent: true,
			toneMapped: false
		})
	};
	const panel = new MeshStandardMaterial({
		color: p.hull,
		roughness: 0.48,
		metalness: 0.28,
		flatShading: true
	});
	return { ...mats, panel, hullMid, hullLower };
}

export function buildLantern(p: Palette, mat: ShipMaterials): Built {
	const root = new Group();
	root.name = SHIP_ROOT;
	const built: Built = {
		root,
		materials: mat,
		muzzles: [],
		halos: [],
		noseSpot: undefined as unknown as SpotLight
	};
	root.add(hull(p, mat), stripe(mat), canopy(mat), bayDetail(mat));
	root.add(pylon(1, mat), pylon(-1, mat));
	root.add(ring(1, p, mat, built), ring(-1, p, mat, built));
	root.add(tail(mat));
	root.add(...bay(mat), ...gear(mat));
	root.add(nose(mat, built));
	return built;
}
