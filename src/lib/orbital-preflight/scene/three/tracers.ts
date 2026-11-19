import {
	AdditiveBlending,
	BoxGeometry,
	Group,
	Mesh,
	MeshBasicMaterial,
	Quaternion,
	Vector3,
	type Color
} from 'three';

/**
 * The SRV turret's tracers, in metres and world space: a small pool of glowing bolts.
 * Gold for primary fire, the warning colour (thicker, slower) for secondary, as on the
 * SRV placeholder and the ship. Pooled up front, so firing allocates nothing.
 */

const POOL = 24;
const FORWARD = new Vector3(0, 0, -1);
const SPEC = {
	primary: { speed: 140, life: 0.6, scale: 1 },
	secondary: { speed: 90, life: 0.8, scale: 2 }
} as const;

interface Bolt {
	mesh: Mesh;
	vel: Vector3;
	life: number;
}

export class Tracers {
	readonly group = new Group();
	#bolts: Bolt[] = [];
	#next = 0;
	#primary: MeshBasicMaterial;
	#secondary: MeshBasicMaterial;

	constructor(gold: Color, warning: Color) {
		const material = (c: Color) =>
			new MeshBasicMaterial({
				color: c.clone().multiplyScalar(1.6),
				blending: AdditiveBlending,
				transparent: true,
				depthWrite: false,
				toneMapped: false
			});
		this.#primary = material(gold);
		this.#secondary = material(warning);
		const bolt = new BoxGeometry(0.16, 0.16, 7);
		for (let i = 0; i < POOL; i++) {
			const mesh = new Mesh(bolt, this.#primary);
			mesh.visible = false;
			mesh.frustumCulled = false;
			this.group.add(mesh);
			this.#bolts.push({ mesh, vel: new Vector3(), life: 0 });
		}
	}

	/** Fires one bolt from `at` along `facing`'s -Z, carried by `carry` (m/s). */
	fire(at: Vector3, facing: Quaternion, carry: Vector3, heavy: boolean) {
		const spec = heavy ? SPEC.secondary : SPEC.primary;
		const b = this.#bolts[this.#next];
		this.#next = (this.#next + 1) % POOL;
		b.mesh.material = heavy ? this.#secondary : this.#primary;
		b.mesh.scale.set(spec.scale, spec.scale, 1);
		b.mesh.quaternion.copy(facing);
		// Start the bolt just ahead of the muzzle, so its tail sits at the barrel tip.
		b.mesh.position.copy(FORWARD).applyQuaternion(facing).multiplyScalar(3.5).add(at);
		b.vel.copy(FORWARD).applyQuaternion(facing).multiplyScalar(spec.speed).add(carry);
		b.life = spec.life;
		b.mesh.visible = true;
	}

	update(dt: number) {
		for (const b of this.#bolts) {
			if (!b.mesh.visible) continue;
			b.life -= dt;
			if (b.life <= 0) {
				b.mesh.visible = false;
				continue;
			}
			b.mesh.position.addScaledVector(b.vel, dt);
		}
	}
}
