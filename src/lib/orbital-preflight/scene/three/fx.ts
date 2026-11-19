import {
	AdditiveBlending,
	BoxGeometry,
	BufferAttribute,
	BufferGeometry,
	Color,
	DynamicDrawUsage,
	Group,
	Mesh,
	MeshBasicMaterial,
	Points,
	PointsMaterial,
	Quaternion,
	Sprite,
	SpriteMaterial,
	Vector3,
	type Texture
} from 'three';
import type { Palette } from './palette.ts';
import { random } from './space.ts';

/**
 * One-off effects: tracers from the turrets, the chaff burst and the heat-sink puff.
 * Everything is pooled up front, so firing allocates nothing. World space with the ship
 * at the origin: each update subtracts the ship's own motion.
 */

const FORWARD = new Vector3(0, 0, -1);

interface Tracer {
	mesh: Mesh;
	vel: Vector3;
	life: number;
}

export class Effects {
	readonly group = new Group();
	#tracers: Tracer[] = [];
	#next = 0;
	#chaff: Points;
	#chaffVel: Float32Array;
	#chaffLife = 0;
	#chaffMat: PointsMaterial;
	#puffs: { sprite: Sprite; vel: Vector3; life: number }[] = [];
	#puffMat: SpriteMaterial;
	#primary: MeshBasicMaterial;
	#secondary: MeshBasicMaterial;
	#rnd = random(5);
	#flashes: { sprite: Sprite; life: number }[] = [];

	constructor(p: Palette, glow: Texture) {
		this.#primary = new MeshBasicMaterial({
			color: p.gold.clone(),
			blending: AdditiveBlending,
			transparent: true,
			depthWrite: false,
			toneMapped: false
		});
		this.#secondary = new MeshBasicMaterial({
			color: new Color('#FF9A7A'),
			blending: AdditiveBlending,
			transparent: true,
			depthWrite: false,
			toneMapped: false
		});
		const thin = new BoxGeometry(0.5, 0.5, 16);
		for (let i = 0; i < 32; i++) {
			const mesh = new Mesh(thin, this.#primary);
			mesh.visible = false;
			this.group.add(mesh);
			this.#tracers.push({ mesh, vel: new Vector3(), life: 0 });
		}

		for (let i = 0; i < 4; i++) {
			const sprite = new Sprite(
				new SpriteMaterial({
					map: glow,
					color: p.gold.clone(),
					blending: AdditiveBlending,
					transparent: true,
					depthWrite: false,
					toneMapped: false
				})
			);
			sprite.visible = false;
			this.group.add(sprite);
			this.#flashes.push({ sprite, life: 0 });
		}

		const count = 140;
		const pos = new Float32Array(count * 3);
		this.#chaffVel = new Float32Array(count * 3);
		const g = new BufferGeometry();
		const attr = new BufferAttribute(pos, 3);
		attr.setUsage(DynamicDrawUsage);
		g.setAttribute('position', attr);
		// Gold glints: white would vanish against the pale hull.
		this.#chaffMat = new PointsMaterial({
			color: p.gold.clone(),
			size: 3.2,
			sizeAttenuation: false,
			transparent: true,
			opacity: 0,
			depthWrite: false
		});
		this.#chaff = new Points(g, this.#chaffMat);
		this.#chaff.frustumCulled = false;
		this.#chaff.visible = false;
		this.group.add(this.#chaff);

		this.#puffMat = new SpriteMaterial({
			map: glow,
			color: new Color('#FF9A7A'),
			transparent: true,
			opacity: 0,
			blending: AdditiveBlending,
			depthWrite: false
		});
		for (let i = 0; i < 7; i++) {
			const sprite = new Sprite(this.#puffMat);
			sprite.visible = false;
			this.group.add(sprite);
			this.#puffs.push({ sprite, vel: new Vector3(), life: 0 });
		}
	}

	/** A tracer from `from` along the ship's facing `q`, carried at the ship's `velocity`. */
	fire(from: Vector3, q: Quaternion, velocity: Vector3, heavy: boolean) {
		const t = this.#tracers[this.#next];
		this.#next = (this.#next + 1) % this.#tracers.length;
		t.mesh.material = heavy ? this.#secondary : this.#primary;
		t.mesh.scale.set(heavy ? 2.2 : 1, heavy ? 2.2 : 1, heavy ? 0.8 : 1);
		t.mesh.quaternion.copy(q);
		t.mesh.position.copy(from).addScaledVector(FORWARD.clone().applyQuaternion(q), 8);
		t.vel
			.copy(FORWARD)
			.applyQuaternion(q)
			.multiplyScalar(heavy ? 300 : 380)
			.add(velocity);
		t.life = heavy ? 1.4 : 1.2;
		t.mesh.visible = true;
		const flash = this.#flashes[this.#next % this.#flashes.length];
		flash.sprite.position.copy(from);
		(flash.sprite.material as SpriteMaterial).color.copy(
			(t.mesh.material as MeshBasicMaterial).color
		);
		flash.life = 0.08;
		flash.sprite.visible = true;
	}

	chaff(from: Vector3, velocity: Vector3, gentle: boolean) {
		const pos = this.#chaff.geometry.attributes.position.array as Float32Array;
		const spread = gentle ? 14 : 26;
		for (let i = 0; i < pos.length; i += 3) {
			pos[i] = from.x;
			pos[i + 1] = from.y;
			pos[i + 2] = from.z;
			const u = this.#rnd() * 2 - 1;
			const a = this.#rnd() * Math.PI * 2;
			const r = Math.sqrt(1 - u * u);
			const s = spread * (0.4 + this.#rnd());
			this.#chaffVel[i] = velocity.x + Math.cos(a) * r * s;
			this.#chaffVel[i + 1] = velocity.y + u * s;
			this.#chaffVel[i + 2] = velocity.z + Math.sin(a) * r * s + spread * 0.6;
		}
		this.#chaffLife = 2.2;
		this.#chaff.visible = true;
	}

	puff(from: Vector3, up: Vector3, velocity: Vector3) {
		for (const p of this.#puffs) {
			p.sprite.position.copy(from);
			p.vel
				.copy(up)
				.multiplyScalar(6 + this.#rnd() * 6)
				.add(new Vector3(this.#rnd() - 0.5, 0, this.#rnd() - 0.5).multiplyScalar(8))
				.add(velocity);
			p.life = 1.4;
			p.sprite.visible = true;
		}
	}

	update(dt: number, shipVelocity: Vector3) {
		for (const f of this.#flashes) {
			if (f.life <= 0) continue;
			f.life -= dt;
			f.sprite.scale.setScalar(2.5 + f.life * 30);
			if (f.life <= 0) f.sprite.visible = false;
		}
		for (const t of this.#tracers) {
			if (t.life <= 0) continue;
			t.life -= dt;
			t.mesh.position.addScaledVector(t.vel, dt).addScaledVector(shipVelocity, -dt);
			if (t.life <= 0) t.mesh.visible = false;
		}
		if (this.#chaffLife > 0) {
			this.#chaffLife -= dt;
			const pos = this.#chaff.geometry.attributes.position.array as Float32Array;
			for (let i = 0; i < pos.length; i++) {
				const v = this.#chaffVel[i];
				const sv = i % 3 === 0 ? shipVelocity.x : i % 3 === 1 ? shipVelocity.y : shipVelocity.z;
				this.#chaffVel[i] = v * (1 - 0.6 * dt);
				pos[i] += (this.#chaffVel[i] - sv) * dt;
			}
			this.#chaff.geometry.attributes.position.needsUpdate = true;
			// Glints: chaff flickers as it tumbles.
			this.#chaffMat.opacity =
				Math.min(1, this.#chaffLife / 1.2) * (0.7 + 0.3 * Math.sin(this.#chaffLife * 40));
			if (this.#chaffLife <= 0) this.#chaff.visible = false;
		}
		let alive = 0;
		for (const p of this.#puffs) {
			if (p.life <= 0) continue;
			p.life -= dt;
			alive = Math.max(alive, p.life);
			p.sprite.position.addScaledVector(p.vel, dt).addScaledVector(shipVelocity, -dt);
			p.sprite.scale.setScalar(2 + (1.4 - p.life) * 9);
			if (p.life <= 0) p.sprite.visible = false;
		}
		this.#puffMat.opacity = Math.min(0.7, alive / 1.4);
	}
}
