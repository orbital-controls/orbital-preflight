import {
	AdditiveBlending,
	BoxGeometry,
	CanvasTexture,
	CircleGeometry,
	Color,
	DoubleSide,
	EdgesGeometry,
	ExtrudeGeometry,
	Group,
	HemisphereLight,
	LineBasicMaterial,
	LineSegments,
	Mesh,
	MeshBasicMaterial,
	MeshLambertMaterial,
	PlaneGeometry,
	PointLight,
	RepeatWrapping,
	RingGeometry,
	Shape,
	SRGBColorSpace,
	type BufferGeometry,
	type Material
} from 'three';
import {
	BARRIER,
	BAY,
	CONSOLE,
	DOOR,
	LOCKER,
	PAD,
	SEVEN,
	SOLIDS,
	STOPS,
	TARGETS,
	WALLS,
	type Solid
} from '../pad.ts';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Palette } from './palette.ts';

/**
 * Pad 7 Compact in three.js, from the Pad3D v0.1 block-out and the layout in ../pad.ts.
 * The block-out had no ceiling and flat light; this adds a dark ceiling with beams and
 * lamp panels, and lights the bay dark overall with a pool at each stop. Gold is light,
 * violet is power.
 */

export interface TargetRing {
	ring: MeshBasicMaterial;
	core: MeshBasicMaterial;
	/** Seconds left on the hit flash. */
	flash: number;
}

export interface Pad7 {
	group: Group;
	rings: TargetRing[];
	/** Redraws the hit counter on the panel. */
	setHits(hits: number): void;
	/** Base colours, for the ring flash to return to. */
	ringColor: Color;
	coreColor: Color;
}

const W = BAY.x[1] - BAY.x[0];
const D = BAY.z[1] - BAY.z[0];

function mesh(geometry: BufferGeometry, material: Material, name = ''): Mesh {
	const m = new Mesh(geometry, material);
	m.name = name;
	return m;
}

/** A box centred at (x, y, z). */
function boxAt(
	sx: number,
	sy: number,
	sz: number,
	x: number,
	y: number,
	z: number,
	mat: Material
): Mesh {
	const m = mesh(new BoxGeometry(sx, sy, sz), mat);
	m.position.set(x, y, z);
	return m;
}

/** A solid from the layout as a mesh, with outlined edges. */
function solidMesh(s: Solid, mat: Material, edges?: LineBasicMaterial): Group {
	const g = new Group();
	g.name = s.id;
	const b = mesh(new BoxGeometry(s.hx * 2, s.y1 - s.y0, s.hz * 2), mat);
	g.add(b);
	if (edges) g.add(new LineSegments(new EdgesGeometry(b.geometry), edges));
	g.position.set(s.cx, (s.y0 + s.y1) / 2, s.cz);
	g.rotation.y = s.angle;
	return g;
}

/** The deck's tile texture: one 2 m tile, repeated. */
function tileTexture(p: Palette): CanvasTexture {
	const size = 256;
	const c = document.createElement('canvas');
	c.width = c.height = size;
	const ctx = c.getContext('2d')!;
	ctx.fillStyle = `#${p.deck.getHexString()}`;
	ctx.fillRect(0, 0, size, size);
	ctx.strokeStyle = `#${p.ground.getHexString()}`;
	ctx.lineWidth = 6;
	ctx.strokeRect(0, 0, size, size);
	ctx.strokeStyle = `#${p.wall.getHexString()}`;
	ctx.lineWidth = 2;
	ctx.strokeRect(10, 10, size - 20, size - 20);
	const t = new CanvasTexture(c);
	t.colorSpace = SRGBColorSpace;
	t.wrapS = t.wrapT = RepeatWrapping;
	t.repeat.set(W / WALLS.tile, D / WALLS.tile);
	t.anisotropy = 4;
	return t;
}

/** A soft round pool of light, for the deck at each stop. */
function poolTexture(): CanvasTexture {
	const size = 128;
	const c = document.createElement('canvas');
	c.width = c.height = size;
	const ctx = c.getContext('2d')!;
	const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
	g.addColorStop(0, 'rgba(255,240,205,0.9)');
	g.addColorStop(0.45, 'rgba(255,228,170,0.35)');
	g.addColorStop(1, 'rgba(255,220,150,0)');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, size, size);
	const t = new CanvasTexture(c);
	t.colorSpace = SRGBColorSpace;
	return t;
}

/** The big gold "7", as a flat glyph about `h` tall. */
function sevenGeometry(h: number): BufferGeometry {
	const w = h * 0.62;
	const bar = h * 0.17;
	const s = new Shape();
	s.moveTo(-w / 2, h / 2);
	s.lineTo(w / 2, h / 2);
	s.lineTo(w / 2, h / 2 - bar);
	s.lineTo(-w * 0.08, -h / 2);
	s.lineTo(-w * 0.08 - bar * 1.15, -h / 2);
	s.lineTo(w / 2 - bar * 1.25, h / 2 - bar);
	s.lineTo(-w / 2, h / 2 - bar);
	s.closePath();
	return new ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false });
}

export function buildPad7(p: Palette): Pad7 {
	const group = new Group();
	group.name = 'pad7';

	const lambert = (color: Color) => new MeshLambertMaterial({ color });
	const deckMat = new MeshLambertMaterial({ map: tileTexture(p) });
	const wallMat = lambert(p.wall);
	const ribMat = lambert(p.wall.clone().lerp(p.steel, 0.12));
	const ceilMat = lambert(p.ground.clone().lerp(p.wall, 0.5));
	const beamMat = lambert(p.wall.clone().multiplyScalar(0.8));
	const metalMat = lambert(p.metal);
	const darkMat = lambert(p.glassDark);
	const gold = new MeshBasicMaterial({ color: p.gold });
	const goldDim = new MeshBasicMaterial({ color: p.gold.clone().multiplyScalar(0.75) });
	const violet = new MeshBasicMaterial({ color: p.violetBright });
	const routeMat = new MeshBasicMaterial({
		color: p.gold,
		transparent: true,
		opacity: 0.55,
		depthWrite: false
	});
	const lamp = new MeshBasicMaterial({ color: new Color('#d9dcf2').multiplyScalar(0.85) });
	const edges = new LineBasicMaterial({ color: p.steel.clone().multiplyScalar(0.55) });

	// Deck.
	const deck = mesh(new PlaneGeometry(W, D), deckMat, 'deck');
	deck.rotation.x = -Math.PI / 2;
	group.add(deck);

	// Walls, full height all round (the block-out's low south wall was a cutaway).
	const wall = (len: number, x: number, z: number, ry: number) => {
		const m = mesh(new PlaneGeometry(len, BAY.ceiling), wallMat);
		m.position.set(x, BAY.ceiling / 2, z);
		m.rotation.y = ry;
		group.add(m);
	};
	wall(W, 0, BAY.z[0], 0);
	wall(W, 0, BAY.z[1], Math.PI);
	wall(D, BAY.x[0], 0, Math.PI / 2);
	wall(D, BAY.x[1], 0, -Math.PI / 2);

	// Ribs every 4 m and the gold light strip at 6.4 m.
	const ribGeo = new BoxGeometry(0.4, BAY.ceiling, 0.3);
	// Clear of the target panel, the 7 and the console on the north wall, and the locker.
	const clearNorth = (x: number) =>
		Math.abs(x - TARGETS.cx) < TARGETS.width / 2 + 0.5 ||
		Math.abs(x - CONSOLE.cx) < CONSOLE.width / 2 + 0.4;
	const clearSouth = (x: number) => Math.abs(x - LOCKER.cx) < LOCKER.width / 2 + 0.4;
	for (let x = BAY.x[0] + 1.5; x < BAY.x[1]; x += WALLS.ribEvery) {
		for (const z of [BAY.z[0] + 0.15, BAY.z[1] - 0.15]) {
			if (z < 0 ? clearNorth(x) : clearSouth(x)) continue;
			const rib = mesh(ribGeo, ribMat);
			rib.position.set(x, BAY.ceiling / 2, z);
			group.add(rib);
		}
	}
	for (let z = BAY.z[0] + 2.5; z < BAY.z[1]; z += WALLS.ribEvery) {
		for (const x of [BAY.x[0] + 0.15, BAY.x[1] - 0.15]) {
			// Leave the bay door clear.
			if (x < 0 && Math.abs(z) < DOOR.width / 2 + 0.4) continue;
			const rib = mesh(ribGeo, ribMat);
			rib.position.set(x, BAY.ceiling / 2, z);
			rib.rotation.y = Math.PI / 2;
			group.add(rib);
		}
	}
	const y = WALLS.stripY;
	group.add(boxAt(W, 0.1, 0.06, 0, y, BAY.z[0] + 0.33, gold));
	group.add(boxAt(W, 0.1, 0.06, 0, y, BAY.z[1] - 0.33, gold));
	group.add(boxAt(0.06, 0.1, D, BAY.x[0] + 0.33, y, 0, gold));
	group.add(boxAt(0.06, 0.1, D, BAY.x[1] - 0.33, y, 0, gold));

	// Ceiling: dark, with beams across the bay and lamp panels between them (not on the
	// block-out, which had no ceiling).
	const ceil = mesh(new PlaneGeometry(W, D), ceilMat, 'ceiling');
	ceil.rotation.x = Math.PI / 2;
	ceil.position.y = BAY.ceiling;
	group.add(ceil);
	for (let x = BAY.x[0] + 3.5; x < BAY.x[1]; x += 6) {
		group.add(boxAt(0.5, 0.7, D, x, BAY.ceiling - 0.35, 0, beamMat));
	}
	for (let x = BAY.x[0] + 6.5; x < BAY.x[1] - 2; x += 12) {
		for (const z of [-6, 0, 6]) group.add(boxAt(2.2, 0.05, 0.5, x, BAY.ceiling - 0.03, z, lamp));
	}

	// The pad: a darker inner disc, the violet ring, 24 gold dashes just outside.
	const disc = mesh(
		new CircleGeometry(PAD.radius - 0.35, 64),
		lambert(p.ground.clone().lerp(p.deck, 0.4))
	);
	disc.rotation.x = -Math.PI / 2;
	disc.position.y = 0.004;
	group.add(disc);
	const ring = mesh(new RingGeometry(PAD.radius - 0.35, PAD.radius, 96), violet, 'padRing');
	ring.rotation.x = -Math.PI / 2;
	ring.position.y = 0.008;
	group.add(ring);
	const dashGeo = new BoxGeometry(0.95, 0.02, 0.2);
	for (let i = 0; i < PAD.dashes; i++) {
		const a = (i / PAD.dashes) * Math.PI * 2;
		const r = PAD.radius + 0.55;
		const dash = mesh(dashGeo, gold);
		dash.position.set(Math.cos(a) * r, 0.01, Math.sin(a) * r);
		dash.rotation.y = -a + Math.PI / 2;
		group.add(dash);
	}

	// Stops: a gold disc with tick marks for its number, and a pool of light.
	const pool = poolTexture();
	const poolMat = new MeshBasicMaterial({
		map: pool,
		transparent: true,
		blending: AdditiveBlending,
		depthWrite: false,
		opacity: 0.42
	});
	const tickGeo = new BoxGeometry(0.06, 0.02, 0.32);
	for (const s of STOPS) {
		const g = new Group();
		g.name = `stop${s.n}`;
		g.position.set(s.at[0], 0, s.at[1]);
		const d = mesh(new CircleGeometry(0.5, 32), goldDim);
		d.rotation.x = -Math.PI / 2;
		d.position.y = 0.014;
		g.add(d);
		for (let i = 0; i < s.n; i++) {
			const a = -Math.PI / 2 + ((i - (s.n - 1) / 2) * Math.PI) / 9;
			const t = mesh(tickGeo, gold);
			t.position.set(Math.cos(a) * 0.82, 0.014, Math.sin(a) * 0.82);
			t.rotation.y = -a + Math.PI / 2;
			g.add(t);
		}
		const outline = mesh(new RingGeometry(1.08, 1.14, 48), routeMat);
		outline.rotation.x = -Math.PI / 2;
		outline.position.y = 0.012;
		g.add(outline);
		const glow = mesh(new PlaneGeometry(6, 6), poolMat);
		glow.rotation.x = -Math.PI / 2;
		glow.position.y = 0.02;
		g.add(glow);
		group.add(g);
	}

	// The dashed gold route, clockwise, closing back at the ramp.
	const dash = new BoxGeometry(0.6, 0.01, 0.07);
	for (let i = 0; i < STOPS.length; i++) {
		const a = STOPS[i].at;
		const b = STOPS[(i + 1) % STOPS.length].at;
		const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
		const yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
		for (let d = 1.4; d < len - 1.4; d += 1.15) {
			const m = mesh(dash, routeMat);
			const k = d / len;
			m.position.set(a[0] + (b[0] - a[0]) * k, 0.011, a[1] + (b[1] - a[1]) * k);
			m.rotation.y = yaw;
			group.add(m);
		}
	}

	// Props from the layout.
	for (const s of SOLIDS) {
		if (s.id.startsWith('crate')) group.add(solidMesh(s, metalMat, edges));
	}
	const locker = SOLIDS.find((s) => s.id === 'locker')!;
	const lockerG = solidMesh(locker, lambert(p.wall.clone().lerp(p.steel, 0.25)), edges);
	// Two doors, a violet power light on each.
	for (const sx of [-0.6, 0.6]) {
		lockerG.add(boxAt(1.1, 1.9, 0.02, sx, 0, -LOCKER.depth / 2 - 0.01, darkMat));
		lockerG.add(boxAt(0.12, 0.05, 0.03, sx, 0.75, -LOCKER.depth / 2 - 0.02, violet));
	}
	group.add(lockerG);

	const barrier = SOLIDS.find((s) => s.id === 'barrier')!;
	const barrierG = solidMesh(barrier, metalMat, edges);
	barrierG.add(
		boxAt(barrier.hx * 2, 0.05, barrier.hz * 2 + 0.02, 0, BARRIER.height / 2 + 0.025, 0, gold)
	);
	group.add(barrierG);

	// The target panel: dark, gold edges, three violet holo rings with gold centres.
	const panelH = TARGETS.y[1] - TARGETS.y[0];
	const panelY = (TARGETS.y[0] + TARGETS.y[1]) / 2;
	const panelZ = TARGETS.z - 0.07;
	group.add(boxAt(TARGETS.width, panelH, 0.14, TARGETS.cx, panelY, panelZ, darkMat));
	const edgeT = 0.07;
	group.add(boxAt(TARGETS.width + edgeT * 2, edgeT, 0.16, TARGETS.cx, TARGETS.y[1], panelZ, gold));
	group.add(boxAt(TARGETS.width + edgeT * 2, edgeT, 0.16, TARGETS.cx, TARGETS.y[0], panelZ, gold));
	for (const sx of [-1, 1])
		group.add(
			boxAt(edgeT, panelH, 0.16, TARGETS.cx + (sx * TARGETS.width) / 2, panelY, panelZ, gold)
		);
	const ringColor = p.violetBright.clone();
	const coreColor = p.gold.clone();
	const rings: TargetRing[] = TARGETS.rings.map((rg, i) => {
		const ringMat = new MeshBasicMaterial({ color: ringColor.clone(), side: DoubleSide });
		const coreMat = new MeshBasicMaterial({ color: coreColor.clone() });
		const outer = mesh(new RingGeometry(TARGETS.radius - 0.12, TARGETS.radius, 48), ringMat);
		const inner = mesh(new RingGeometry(TARGETS.radius * 0.45, TARGETS.radius * 0.52, 40), ringMat);
		const core = mesh(new CircleGeometry(TARGETS.core, 24), coreMat);
		const g = new Group();
		g.name = `target${i}`;
		g.add(outer, inner, core);
		g.position.set(rg.x, rg.y, TARGETS.z + 0.005);
		group.add(g);
		return { ring: ringMat, core: coreMat, flash: 0 };
	});
	// The hit counter, top left of the panel.
	const counter = document.createElement('canvas');
	counter.width = 256;
	counter.height = 64;
	const counterTex = new CanvasTexture(counter);
	counterTex.colorSpace = SRGBColorSpace;
	const counterMesh = mesh(
		new PlaneGeometry(1.6, 0.4),
		new MeshBasicMaterial({ map: counterTex, transparent: true })
	);
	counterMesh.position.set(
		TARGETS.cx - TARGETS.width / 2 + 1.0,
		TARGETS.y[1] - 0.32,
		TARGETS.z + 0.006
	);
	group.add(counterMesh);
	const goldCss = `#${p.gold.getHexString()}`;
	const setHits = (hits: number) => {
		const ctx = counter.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, 256, 64);
		ctx.fillStyle = goldCss;
		ctx.font = '600 34px ui-monospace, monospace';
		ctx.textBaseline = 'middle';
		ctx.fillText(`HITS ${String(hits).padStart(2, '0')}`, 8, 34);
		counterTex.needsUpdate = true;
	};
	setHits(0);

	// The gold firing line.
	group.add(boxAt(TARGETS.line.length, 0.012, 0.09, TARGETS.cx, 0.012, TARGETS.line.z, gold));

	// The big gold "7" above the target panel.
	const seven = mesh(sevenGeometry(SEVEN.y[1] - SEVEN.y[0]), gold, 'seven');
	seven.position.set(SEVEN.x, (SEVEN.y[0] + SEVEN.y[1]) / 2, SEVEN.z);
	group.add(seven);

	// The pad console with its violet screen.
	const consoleSolid = SOLIDS.find((s) => s.id === 'console')!;
	const consoleG = solidMesh(consoleSolid, lambert(p.wall.clone().lerp(p.steel, 0.2)), edges);
	const screen = mesh(new PlaneGeometry(CONSOLE.width - 0.5, 0.55), violet, 'consoleScreen');
	screen.rotation.x = -Math.PI / 2 + 0.55;
	screen.position.set(0, CONSOLE.height / 2 + 0.02, 0.05);
	consoleG.add(screen);
	consoleG.add(boxAt(CONSOLE.width, 0.05, 0.05, 0, CONSOLE.height / 2, CONSOLE.depth / 2, gold));
	group.add(consoleG);

	// The bay door on the west wall, framed in gold. It doesn't open in v1.
	const doorG = new Group();
	doorG.name = 'bayDoor';
	doorG.position.set(BAY.x[0] + 0.05, 0, 0);
	doorG.rotation.y = Math.PI / 2;
	doorG.add(boxAt(DOOR.width, DOOR.height, 0.1, 0, DOOR.height / 2, 0, darkMat));
	doorG.add(boxAt(0.04, DOOR.height, 0.12, 0, DOOR.height / 2, 0.01, lambert(p.wall)));
	const f = 0.16;
	doorG.add(boxAt(DOOR.width + f * 2, f, 0.14, 0, DOOR.height + f / 2, 0.02, gold));
	for (const sx of [-1, 1])
		doorG.add(
			boxAt(f, DOOR.height, 0.14, (sx * (DOOR.width + f)) / 2, DOOR.height / 2, 0.02, gold)
		);
	group.add(doorG);

	// Light: dark overall, a pool at each stop. A few real lights for the ship and props.
	group.add(new HemisphereLight(new Color('#8c8fd6'), p.ground, 0.55));
	const warm = new Color('#ffe2b0');
	for (const [x, yy, z, power] of [
		[-11.3, 6.5, 0, 26],
		[12.6, 6, 8.5, 18],
		[18.2, 6, -6.5, 22],
		[-4.05, 6, -8.4, 18],
		[1.4, 8.4, 0, 30]
	] as const) {
		const light = new PointLight(warm, power, 16, 1.4);
		light.position.set(x, yy, z);
		group.add(light);
	}

	bake(group);
	return { group, rings, setHits, ringColor, coreColor };
}

/**
 * Merges the bay's unnamed static meshes that sit directly in `group` into one mesh per
 * material: hundreds of ribs, dashes and strips become a handful of draw calls.
 */
function bake(group: Group) {
	const byMaterial = new Map<Material, BufferGeometry[]>();
	for (const child of [...group.children]) {
		const m = child as Mesh;
		if (!m.isMesh || m.name || Array.isArray(m.material)) continue;
		m.updateMatrix();
		const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
		// Merging needs the same attributes everywhere: position and normal (and uv) only.
		for (const name of Object.keys(g.attributes))
			if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
		g.applyMatrix4(m.matrix);
		const list = byMaterial.get(m.material) ?? [];
		list.push(g);
		byMaterial.set(m.material, list);
		group.remove(m);
		m.geometry.dispose();
	}
	for (const [material, list] of byMaterial) {
		const merged = mergeGeometries(list, false);
		for (const g of list) g.dispose();
		if (merged) group.add(new Mesh(merged, material));
	}
}
