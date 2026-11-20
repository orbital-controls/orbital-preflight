import {
	AdditiveBlending,
	BoxGeometry,
	BufferGeometry,
	CapsuleGeometry,
	CatmullRomCurve3,
	Color,
	CylinderGeometry,
	DoubleSide,
	Float32BufferAttribute,
	Group,
	Matrix4,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Object3D,
	PlaneGeometry,
	Quaternion,
	SphereGeometry,
	TorusGeometry,
	TubeGeometry,
	Vector3,
	type Material
} from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { TracerPose } from '../foot.ts';
import { TRACER_ROOT } from '../parts.ts';
import {
	ammoSegment,
	aroundGrip,
	BARREL,
	CARTRIDGE_CAP,
	ELBOW,
	EMITTER,
	FINGERS,
	fingerJoints,
	FRAME,
	FRONT_SIGHT,
	GRIP,
	indexJoints,
	INDEX_RADIUS,
	PHALANX_TAPER,
	RAIL_GROOVES,
	REAR_SIGHT,
	ROUNDS,
	SLEEVE,
	SLIDE,
	sub,
	THUMB,
	THUMB_RADIUS,
	TRIGGER,
	TRIGGER_GUARD,
	TRIGGER_GUARD_RADIUS,
	WRIST,
	type V3
} from '../tracer.ts';
import type { Palette } from './palette.ts';

/**
 * The Tracer P1 in the Crew Soft right hand, built procedurally from the v0.1 block-out
 * (Pistol3D). Gun frame, centimetres (see ../tracer.ts). Every part is a named node with
 * a stable pivot (the contract in ../parts.ts), so a Blender glTF can replace it.
 *
 * Rig: `forearmRoll` (elbow) → `wristFlex` (wrist) → the gun and the hand. Only the roll,
 * the flex and the index chain animate; the slide slides, the stripe recolours and the
 * cartridges move. Base orientations live in `userData.base` so a pose is applied on top.
 */

export interface TracerMaterials {
	slide: MeshStandardMaterial;
	frame: MeshStandardMaterial;
	dark: MeshStandardMaterial;
	gold: MeshBasicMaterial;
	emitter: MeshBasicMaterial;
	segOn: MeshStandardMaterial;
	segOff: MeshStandardMaterial;
	glove: MeshStandardMaterial;
	sleeve: MeshStandardMaterial;
	stripe: MeshBasicMaterial;
	seam: MeshStandardMaterial;
	cartridge: MeshStandardMaterial;
	cartridgeCap: MeshBasicMaterial;
	holo: MeshBasicMaterial;
	scan: MeshBasicMaterial;
}

export interface TracerRig {
	root: Group;
	nodes: Record<string, Object3D>;
	materials: TracerMaterials;
	/** Where holo rounds leave, as a node (under `emitter`). */
	muzzle: Object3D;
	setPose(pose: TracerPose): void;
}

const X = new Vector3(1, 0, 0);
const Z = new Vector3(0, 0, 1);
const _q = new Quaternion();
const _qa = new Quaternion();
const _qw = new Quaternion();
const _v = new Vector3();
const _w = new Vector3();
const _m = new Matrix4();

const v3 = (p: V3) => new Vector3(p[0], p[1], p[2]);

export function makeTracerMaterials(p: Palette): TracerMaterials {
	return {
		slide: new MeshStandardMaterial({ color: p.sleeve, roughness: 0.34, metalness: 0.12 }),
		frame: new MeshStandardMaterial({ color: p.steel, roughness: 0.42, metalness: 0.55 }),
		dark: new MeshStandardMaterial({ color: p.glassDark, roughness: 0.3, metalness: 0.7 }),
		gold: new MeshBasicMaterial({ color: p.gold }),
		emitter: new MeshBasicMaterial({ color: p.gold.clone() }),
		segOn: new MeshStandardMaterial({
			color: p.violet,
			emissive: p.violetBright,
			emissiveIntensity: 1.6,
			roughness: 0.4
		}),
		segOff: new MeshStandardMaterial({ color: p.steel, roughness: 0.5, metalness: 0.4 }),
		glove: new MeshStandardMaterial({ color: p.glove, roughness: 0.78, metalness: 0.05 }),
		sleeve: new MeshStandardMaterial({ color: p.sleeve, roughness: 0.92, metalness: 0 }),
		stripe: new MeshBasicMaterial({ color: p.violetBright, side: DoubleSide }),
		seam: new MeshStandardMaterial({ color: p.steel, roughness: 0.6, metalness: 0.3 }),
		cartridge: new MeshStandardMaterial({
			color: p.sleeve,
			roughness: 0.4,
			transparent: true
		}),
		cartridgeCap: new MeshBasicMaterial({ color: p.gold, transparent: true }),
		holo: new MeshBasicMaterial({
			color: p.violetBright,
			transparent: true,
			opacity: 0.42,
			blending: AdditiveBlending,
			depthWrite: false
		}),
		scan: new MeshBasicMaterial({
			color: p.gold,
			transparent: true,
			blending: AdditiveBlending,
			depthWrite: false
		})
	};
}

function named<T extends Object3D>(o: T, name: string): T {
	o.name = name;
	return o;
}

function mesh(geometry: BufferGeometry, material: Material, name = ''): Mesh {
	const m = new Mesh(geometry, material);
	m.name = name;
	return m;
}

/** A box spanning [min, max] on each axis. */
function span(x: readonly number[], y: readonly number[], z: readonly number[], mat: Material) {
	const m = mesh(new BoxGeometry(x[1] - x[0], y[1] - y[0], z[1] - z[0]), mat);
	m.position.set((x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2);
	return m;
}

/** A capsule from the origin along +X, `length` long between its cap centres. */
function phalanx(length: number, radius: number, mat: Material): Mesh {
	const g = new CapsuleGeometry(radius, Math.max(0.01, length), 4, 10);
	g.rotateZ(-Math.PI / 2);
	g.translate(length / 2, 0, 0);
	return mesh(g, mat);
}

/**
 * A three-bone chain: `name`, `name1`, `name2`, each a group at its joint with local +X
 * toward the next joint, a tapered capsule for each phalanx.
 */
function chain(name: string, joints: V3[], radius: number, mat: Material): Group[] {
	const out: Group[] = [];
	for (let i = 0; i < 3; i++) {
		const bone = named(new Group(), i === 0 ? name : `${name}${i}`);
		const r = radius * PHALANX_TAPER[i];
		const length = Math.hypot(...sub(joints[i + 1], joints[i]));
		bone.add(phalanx(length, r, mat));
		bone.userData.length = length;
		if (i > 0) out[i - 1].add(bone);
		out.push(bone);
	}
	return out;
}

/**
 * Poses a chain so each bone's +X runs to the next joint. `joints` are in the frame of the
 * chain root's parent.
 */
function aimChain(bones: Object3D[], joints: V3[], at: Vector3) {
	// Walk down the chain in the root's parent frame; capsules are round, so twist is free.
	_qa.identity();
	for (let i = 0; i < bones.length; i++) {
		const [ax, ay, az] = joints[i];
		const [bx, by, bz] = joints[i + 1];
		_v.set(bx - ax, by - ay, bz - az).normalize();
		_qw.setFromUnitVectors(X, _v);
		const bone = bones[i];
		if (i === 0) {
			bone.position.set(ax - at.x, ay - at.y, az - at.z);
			bone.quaternion.copy(_qw);
		} else {
			bone.position.set(bones[i - 1].userData.length as number, 0, 0);
			// Local = inverse(the parent's accumulated rotation) × wanted.
			bone.quaternion.copy(_q.copy(_qa).invert().multiply(_qw));
		}
		_qa.copy(_qw);
	}
}

/** A narrow band on a frustum's surface, between two angles round its +X axis. */
function frustumStrip(
	x0: number,
	x1: number,
	r0: number,
	r1: number,
	a0: number,
	a1: number,
	lift: number
): BufferGeometry {
	const pos: number[] = [];
	const steps = 4;
	const ring = (x: number, r: number) =>
		Array.from({ length: steps + 1 }, (_, i) => {
			const a = a0 + ((a1 - a0) * i) / steps;
			return [x, Math.cos(a) * (r + lift), Math.sin(a) * (r + lift)];
		});
	const A = ring(x0, r0);
	const B = ring(x1, r1);
	for (let i = 0; i < steps; i++)
		pos.push(...A[i], ...B[i], ...B[i + 1], ...A[i], ...B[i + 1], ...A[i + 1]);
	const g = new BufferGeometry();
	g.setAttribute('position', new Float32BufferAttribute(pos, 3));
	g.computeVertexNormals();
	return g;
}

/**
 * The points the glove's hull wraps, in the gun frame: a ring at the wrist and one inside
 * the cuff (along `fwd`, the forearm's direction), the web under the slide's rear, the
 * backstrap, the right side down to the knuckles, the heel low on the left, the thenar.
 */
function handHull(fwd: Vector3): Vector3[] {
	const pts: Vector3[] = [];
	const wrist = v3(WRIST);
	const side = new Vector3().crossVectors(fwd, new Vector3(0, 1, 0)).normalize();
	const up = new Vector3().crossVectors(side, fwd).normalize();
	for (const [back, r] of [
		[0, 2.6],
		[3.2, 2.45]
	] as const) {
		const c = wrist.clone().addScaledVector(fwd, -back);
		for (let i = 0; i < 10; i++) {
			const a = (i / 10) * Math.PI * 2;
			pts.push(
				c
					.clone()
					.addScaledVector(up, Math.cos(a) * r)
					.addScaledVector(side, Math.sin(a) * r)
			);
		}
	}
	// The web of thumb and index, high on the backstrap under the slide's rear.
	pts.push(v3([-6.7, -0.45, 0.95]), v3([-6.7, -0.45, -0.85]), v3([-4.6, -0.35, 1.55]));
	// Round the backstrap and the right side, top to bottom; knuckles on the front-right.
	for (const s of [0.6, 2.4, 4.3, 6.1, 7.4]) {
		pts.push(v3(aroundGrip(s, 180, 1.0)), v3(aroundGrip(s, 135, 1.25)));
		pts.push(v3(aroundGrip(s, 95, 1.55)), v3(aroundGrip(s, 62, 1.05)));
	}
	// The heel of the hand, low on the left behind the fingertips, and the thenar.
	pts.push(v3(aroundGrip(6.4, -150, 0.95)), v3(aroundGrip(4.2, -165, 0.95)));
	pts.push(v3([-5.7, -2.7, -1.95]), v3([-5.2, -1.0, -1.7]));
	return pts;
}

export function buildTracer(p: Palette, mat: TracerMaterials = makeTracerMaterials(p)): TracerRig {
	const nodes: Record<string, Object3D> = {};
	const keep = (o: Object3D) => {
		if (o.name) nodes[o.name] = o;
		return o;
	};
	const root = named(new Group(), TRACER_ROOT);
	keep(root);

	// The forearm: the elbow, local +X to the wrist, +Y as near gun-up as it can be.
	const elbow = v3(ELBOW);
	const wrist = v3(WRIST);
	const fwd = wrist.clone().sub(elbow);
	const forearmLength = fwd.length();
	fwd.normalize();
	const side = new Vector3().crossVectors(fwd, new Vector3(0, 1, 0)).normalize();
	const up = new Vector3().crossVectors(side, fwd).normalize();
	const forearmQ = new Quaternion().setFromRotationMatrix(_m.makeBasis(fwd, up, side));
	const forearm = keep(named(new Group(), 'forearmRoll'));
	forearm.position.copy(elbow);
	forearm.quaternion.copy(forearmQ);
	forearm.userData.length = forearmLength;
	forearm.userData.base = forearmQ.clone();
	forearm.userData.basePos = elbow.clone();
	root.add(forearm);

	// The wrist: back to the gun frame's axes, so its children are the gun frame minus WRIST.
	const wristQ = forearmQ.clone().invert();
	const flex = keep(named(new Group(), 'wristFlex'));
	flex.position.set(forearmLength, 0, 0);
	flex.quaternion.copy(wristQ);
	flex.userData.base = wristQ.clone();
	forearm.add(flex);
	/** Gun-frame point → `wristFlex` local. */
	const at = wrist;
	const g = (pt: V3) => v3(pt).sub(at);

	// The slide and what rides on it.
	const slide = keep(named(new Group(), 'slide'));
	slide.position.copy(g([0, 0, 0]));
	const slideBody = mesh(
		new RoundedBoxGeometry(
			SLIDE.x[1] - SLIDE.x[0],
			SLIDE.y[1] - SLIDE.y[0],
			SLIDE.z[1] - SLIDE.z[0],
			3,
			SLIDE.radius
		),
		mat.slide
	);
	slideBody.position.set((SLIDE.x[0] + SLIDE.x[1]) / 2, (SLIDE.y[0] + SLIDE.y[1]) / 2, 0);
	slide.add(slideBody);
	for (let i = 0; i < ROUNDS; i++) {
		const s = ammoSegment(i);
		slide.add(keep(named(span(s.x, s.y, s.z, mat.segOn), `ammoSeg${i}`)));
	}
	for (const [name, sign] of [
		['rearSightL', -1],
		['rearSightR', 1]
	] as const) {
		const z = sign * REAR_SIGHT.z;
		const post = span(
			REAR_SIGHT.x,
			REAR_SIGHT.y,
			[z - REAR_SIGHT.width / 2, z + REAR_SIGHT.width / 2],
			mat.gold
		);
		slide.add(keep(named(post, name)));
	}
	slide.add(
		keep(named(span(FRONT_SIGHT.x, FRONT_SIGHT.y, FRONT_SIGHT.z, mat.slide), 'frontSight'))
	);
	flex.add(slide);

	// The frame, with its rail grooves.
	const frame = keep(
		named(
			mesh(
				new RoundedBoxGeometry(
					FRAME.x[1] - FRAME.x[0],
					FRAME.y[1] - FRAME.y[0],
					FRAME.z[1] - FRAME.z[0],
					2,
					0.32
				),
				mat.frame
			),
			'frame'
		)
	);
	frame.position.copy(g([(FRAME.x[0] + FRAME.x[1]) / 2, (FRAME.y[0] + FRAME.y[1]) / 2, 0]));
	for (let x = RAIL_GROOVES.from; x <= RAIL_GROOVES.to + 1e-6; x += RAIL_GROOVES.step) {
		const groove = span([x - 0.12, x + 0.12], [-0.08, 0.02], [-1.0, 1.0], mat.dark);
		groove.position.x -= (FRAME.x[0] + FRAME.x[1]) / 2;
		groove.position.y += FRAME.y[0] - (FRAME.y[0] + FRAME.y[1]) / 2;
		frame.add(groove);
	}
	flex.add(frame);

	const barrelGeo = new CylinderGeometry(
		BARREL.radius,
		BARREL.radius,
		BARREL.x[1] - BARREL.x[0],
		14
	);
	barrelGeo.rotateZ(Math.PI / 2);
	const barrel = keep(named(mesh(barrelGeo, mat.dark), 'barrel'));
	barrel.position.copy(g([(BARREL.x[0] + BARREL.x[1]) / 2, BARREL.y, 0]));
	flex.add(barrel);

	const emitterGeo = new CylinderGeometry(EMITTER.radius, EMITTER.radius, 0.16, 20);
	emitterGeo.rotateZ(Math.PI / 2);
	const emitter = keep(named(mesh(emitterGeo, mat.emitter), 'emitter'));
	emitter.position.copy(g([EMITTER.x, EMITTER.y, 0]));
	const muzzle = new Object3D();
	muzzle.position.set(0.2, 0, 0);
	emitter.add(muzzle);
	flex.add(emitter);

	const guardCurve = new CatmullRomCurve3(TRIGGER_GUARD.map((pt) => g(pt)));
	flex.add(
		keep(
			named(
				mesh(new TubeGeometry(guardCurve, 28, TRIGGER_GUARD_RADIUS, 8), mat.frame),
				'triggerGuard'
			)
		)
	);
	const trigger = keep(
		named(span(TRIGGER.x, [TRIGGER.y[1], TRIGGER.y[0]], [-0.24, 0.24], mat.frame), 'trigger')
	);
	trigger.position.sub(at);
	trigger.rotation.z = 0.18;
	flex.add(trigger);

	// The grip: a group at its top centre, raked back, local −Y down the grip.
	const grip = keep(named(new Group(), 'grip'));
	grip.position.copy(g(GRIP.top));
	grip.rotation.z = -GRIP.rake;
	grip.userData.length = GRIP.size[1];
	const gripBody = mesh(new RoundedBoxGeometry(...GRIP.size, 3, 0.7), mat.frame);
	gripBody.position.y = -GRIP.size[1] / 2;
	grip.add(gripBody);
	flex.add(grip);

	const cartridgeShape = () => {
		const c = new Group();
		const body = mesh(new BoxGeometry(2.9, 8.6, 2.4), mat.cartridge);
		body.position.y = CARTRIDGE_CAP[1] + 4.3;
		const cap = mesh(new BoxGeometry(...CARTRIDGE_CAP), mat.cartridgeCap);
		cap.position.y = CARTRIDGE_CAP[1] / 2;
		c.add(body, cap);
		return c;
	};
	const cartridge = keep(named(cartridgeShape(), 'cartridge'));
	cartridge.position.y = -GRIP.size[1];
	grip.add(cartridge);
	const holo = keep(named(new Group(), 'cartridgeHolo'));
	const holoBody = mesh(new BoxGeometry(3.0, 9.3, 2.5), mat.holo);
	holoBody.position.y = 4.65;
	const scan = mesh(new PlaneGeometry(3.9, 3.3), mat.scan);
	scan.rotation.x = -Math.PI / 2;
	scan.position.y = 0.05;
	scan.scale.set(1, 0.12, 1);
	holo.add(holoBody, scan);
	holo.position.y = -GRIP.size[1];
	holo.visible = false;
	grip.add(holo);

	// The hand. The palm and heel wrap the backstrap and the right side.
	const palmGeo = new SphereGeometry(1, 18, 14);
	palmGeo.scale(2.15, 4.7, 1.85);
	const palm = keep(named(mesh(palmGeo, mat.glove), 'palm'));
	palm.position.copy(g(aroundGrip(4.0, 142, 1.05)));
	palm.rotation.z = -GRIP.rake;
	flex.add(palm);

	for (const f of FINGERS) {
		const joints = fingerJoints(f);
		const bones = chain(f.name, joints, f.radius, mat.glove);
		aimChain(bones, joints, at);
		flex.add(bones[0]);
		for (const b of bones) keep(b);
	}

	const indexBones = chain('index', indexJoints(0), INDEX_RADIUS, mat.glove);
	aimChain(indexBones, indexJoints(0), at);
	flex.add(indexBones[0]);
	for (const b of indexBones) keep(b);

	const thumbBones = chain('thumb', [...THUMB], THUMB_RADIUS, mat.glove);
	aimChain(thumbBones, [...THUMB], at);
	flex.add(thumbBones[0]);
	for (const b of thumbBones) keep(b);

	// The hand's mass, as Pistol3D blocks it: one faceted hull from the wrist (running on
	// into the cuff) over the backstrap and the grip's right side to the knuckle line, the
	// web high under the slide's rear, and the thenar at the rear-left where the thumb starts.
	const hull = new ConvexGeometry(handHull(fwd));
	hull.translate(-at.x, -at.y, -at.z);
	flex.add(keep(named(mesh(hull, mat.glove), 'glove')));

	// The sleeve, the cuff seam and the violet stripe, in the forearm's frame (+X to the wrist).
	const cuffX = forearmLength - SLEEVE.cuffBack;
	const sleeveLen = cuffX + 6;
	const sleeveGeo = new CylinderGeometry(
		SLEEVE.cuffRadius,
		SLEEVE.elbowRadius + 0.4,
		sleeveLen,
		28,
		1,
		true
	);
	sleeveGeo.rotateZ(-Math.PI / 2);
	sleeveGeo.translate(cuffX - sleeveLen / 2, 0, 0);
	forearm.add(keep(named(mesh(sleeveGeo, mat.sleeve), 'sleeve')));
	const seamGeo = new TorusGeometry(SLEEVE.cuffRadius + 0.02, 0.2, 8, 32);
	seamGeo.rotateY(Math.PI / 2);
	const seam = keep(named(mesh(seamGeo, mat.seam), 'cuffSeam'));
	seam.position.x = cuffX;
	forearm.add(seam);
	// Top-outer: just off the forearm's top (+Y) toward its outer side (+Z, the gun's right),
	// where the first-person camera can see it.
	const mid = 0.38;
	const stripeGeo = frustumStrip(
		cuffX - 0.35,
		-6,
		SLEEVE.cuffRadius,
		SLEEVE.elbowRadius + 0.4,
		mid - 0.13,
		mid + 0.13,
		0.04
	);
	forearm.add(keep(named(mesh(stripeGeo, mat.stripe), 'sleeveStripe')));

	const segOn = mat.segOn;
	const segOff = mat.segOff;
	const goldBase = p.gold.clone();
	const flash = new Color();

	return {
		root,
		nodes,
		materials: mat,
		muzzle,
		setPose(pose) {
			forearm.position.copy(forearm.userData.basePos as Vector3).add(_w.set(...pose.lift));
			forearm.quaternion
				.copy(forearm.userData.base as Quaternion)
				.multiply(_q.setFromAxisAngle(X, pose.roll));
			flex.quaternion
				.copy(flex.userData.base as Quaternion)
				.multiply(_q.setFromAxisAngle(Z, pose.flex));
			slide.position.set(-at.x - pose.slide, -at.y, -at.z);
			for (let i = 0; i < ROUNDS; i++)
				(nodes[`ammoSeg${i}`] as Mesh).material = pose.segments[i] ? segOn : segOff;
			mat.emitter.color.copy(goldBase).multiplyScalar(1 + pose.flash * 2.5);
			mat.emitter.color.lerp(flash.setRGB(1, 1, 1), pose.flash * 0.25);

			const ij = indexJoints(pose.index);
			aimChain(indexBones, ij, at);

			cartridge.visible = pose.cartridge.visible;
			cartridge.position.y = -GRIP.size[1] - pose.cartridge.drop;
			mat.cartridge.opacity = pose.cartridge.opacity;
			mat.cartridgeCap.opacity = pose.cartridge.opacity;
			holo.visible = pose.holo.visible;
			holo.position.y = -GRIP.size[1] - pose.holo.below;
			mat.holo.opacity = 0.42 * pose.holo.opacity;
			mat.scan.opacity = pose.holo.scan;
		}
	};
}
