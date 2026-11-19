import {
	AdditiveBlending,
	BackSide,
	BufferAttribute,
	BufferGeometry,
	CanvasTexture,
	Color,
	DynamicDrawUsage,
	Float32BufferAttribute,
	Group,
	IcosahedronGeometry,
	LineBasicMaterial,
	LineSegments,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	OctahedronGeometry,
	Points,
	PointsMaterial,
	ShaderMaterial,
	SphereGeometry,
	SRGBColorSpace,
	Vector3
} from 'three';
import type { Palette } from './palette.ts';

/** A seeded random, so the sky is the same every visit. */
export function random(seed = 7): () => number {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** A soft round sprite, for glows, halos and puffs. */
export function glowTexture(): CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = 64;
	const g = canvas.getContext('2d')!;
	const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
	grad.addColorStop(0, 'rgba(255,255,255,1)');
	grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
	grad.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = grad;
	g.fillRect(0, 0, 64, 64);
	const t = new CanvasTexture(canvas);
	t.colorSpace = SRGBColorSpace;
	return t;
}

/** Stars on a far sphere. It rides with the camera, so only turning moves it. */
export function starfield(p: Palette, count = 2600): Points {
	const rnd = random(11);
	const pos = new Float32Array(count * 3);
	const col = new Float32Array(count * 3);
	const tint = [new Color('#FFFFFF'), p.violetBright, new Color('#FFE7A8'), new Color('#C9CCE4')];
	for (let i = 0; i < count; i++) {
		const u = rnd() * 2 - 1;
		const a = rnd() * Math.PI * 2;
		const r = Math.sqrt(1 - u * u);
		pos.set([Math.cos(a) * r * 9000, u * 9000, Math.sin(a) * r * 9000], i * 3);
		const c = tint[Math.floor(rnd() * tint.length)].clone().multiplyScalar(0.35 + rnd() * 0.65);
		col.set([c.r, c.g, c.b], i * 3);
	}
	const g = new BufferGeometry();
	g.setAttribute('position', new BufferAttribute(pos, 3));
	g.setAttribute('color', new BufferAttribute(col, 3));
	const stars = new Points(
		g,
		new PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false })
	);
	stars.name = 'stars';
	stars.frustumCulled = false;
	return stars;
}

/** The pale planet with a violet rim, lit from the sun's side. Also rides with the camera. */
export function planet(p: Palette, sun: Vector3): Group {
	const g = new Group();
	g.name = 'planet';
	const material = new ShaderMaterial({
		uniforms: {
			sun: { value: sun.clone().normalize() },
			base: { value: new Color('#C9CCE4') },
			shade: { value: new Color('#2A2D55') },
			rim: { value: p.violetBright.clone() }
		},
		vertexShader: /* glsl */ `
			varying vec3 vNormal;
			varying vec3 vView;
			void main() {
				vec4 world = modelMatrix * vec4(position, 1.0);
				vNormal = normalize(mat3(modelMatrix) * normal);
				vView = normalize(cameraPosition - world.xyz);
				gl_Position = projectionMatrix * viewMatrix * world;
			}`,
		fragmentShader: /* glsl */ `
			uniform vec3 sun;
			uniform vec3 base;
			uniform vec3 shade;
			uniform vec3 rim;
			varying vec3 vNormal;
			varying vec3 vView;
			void main() {
				float light = clamp(dot(vNormal, sun), 0.0, 1.0);
				float bands = 0.015 * sin(vNormal.y * 30.0 + vNormal.x * 5.0);
				vec3 col = mix(shade, base, smoothstep(-0.15, 0.9, light) + bands);
				float fres = pow(1.0 - clamp(dot(vNormal, vView), 0.0, 1.0), 3.0);
				col += rim * fres * 0.9;
				gl_FragColor = vec4(col, 1.0);
			}`,
		depthWrite: false
	});
	const body = new Mesh(new SphereGeometry(2000, 96, 64), material);
	g.add(body);
	// The violet atmosphere glow just outside the limb.
	const halo = new Mesh(
		new SphereGeometry(2100, 64, 48),
		new ShaderMaterial({
			uniforms: { rim: { value: p.violet.clone() } },
			vertexShader: /* glsl */ `
				varying float vFres;
				void main() {
					vec4 world = modelMatrix * vec4(position, 1.0);
					vec3 n = normalize(mat3(modelMatrix) * normal);
					vec3 v = normalize(cameraPosition - world.xyz);
					vFres = pow(1.0 - abs(dot(n, v)), 2.5);
					gl_Position = projectionMatrix * viewMatrix * world;
				}`,
			fragmentShader: /* glsl */ `
				uniform vec3 rim;
				varying float vFres;
				void main() { gl_FragColor = vec4(rim * vFres * 0.9, vFres); }`,
			side: BackSide,
			blending: AdditiveBlending,
			transparent: true,
			depthWrite: false
		})
	);
	g.add(halo);
	// Off the right edge, mid-height: the one part of the frame the HUD leaves clear.
	g.position.set(5600, -1400, -5600);
	g.renderOrder = -1;
	for (const c of g.children) c.renderOrder = -1;
	return g;
}

/**
 * Fine dust in a box around the ship, so speed reads. Points always; streaks along the
 * motion that grow with speed. Positions wrap inside the box.
 */
export class Dust {
	readonly group = new Group();
	readonly size: number;
	#pos: Float32Array;
	#points: Points;
	#lines: LineSegments;
	#linePos: Float32Array;
	#lineMat: LineBasicMaterial;
	#pointMat: PointsMaterial;

	constructor(p: Palette, count: number, size = 260) {
		this.size = size;
		const rnd = random(23);
		this.#pos = new Float32Array(count * 3);
		for (let i = 0; i < this.#pos.length; i++) this.#pos[i] = (rnd() - 0.5) * size;
		const pg = new BufferGeometry();
		const pa = new BufferAttribute(this.#pos, 3);
		pa.setUsage(DynamicDrawUsage);
		pg.setAttribute('position', pa);
		this.#pointMat = new PointsMaterial({
			color: p.hullMid.clone(),
			size: 1.4,
			sizeAttenuation: false,
			transparent: true,
			opacity: 0.55,
			depthWrite: false
		});
		this.#points = new Points(pg, this.#pointMat);
		this.#points.frustumCulled = false;

		this.#linePos = new Float32Array(count * 6);
		const col = new Float32Array(count * 6);
		const head = p.hullMid.clone();
		for (let i = 0; i < count; i++) col.set([head.r, head.g, head.b, 0, 0, 0], i * 6);
		const lg = new BufferGeometry();
		const la = new BufferAttribute(this.#linePos, 3);
		la.setUsage(DynamicDrawUsage);
		lg.setAttribute('position', la);
		lg.setAttribute('color', new Float32BufferAttribute(col, 3));
		this.#lineMat = new LineBasicMaterial({
			vertexColors: true,
			transparent: true,
			opacity: 0,
			blending: AdditiveBlending,
			depthWrite: false
		});
		this.#lines = new LineSegments(lg, this.#lineMat);
		this.#lines.frustumCulled = false;
		this.group.add(this.#points, this.#lines);
	}

	/**
	 * Moves the dust by `-velocity * dt` (the ship stays at the origin) around `centre`,
	 * with streaks `streak` seconds long.
	 */
	update(velocity: Vector3, dt: number, streak: number, centre: Vector3) {
		const half = this.size / 2;
		const pos = this.#pos;
		const dx = -velocity.x * dt;
		const dy = -velocity.y * dt;
		const dz = -velocity.z * dt;
		const sx = velocity.x * streak;
		const sy = velocity.y * streak;
		const sz = velocity.z * streak;
		const wrap = (v: number, c: number) => {
			const r = v - c;
			return r > half ? v - this.size : r < -half ? v + this.size : v;
		};
		for (let i = 0; i < pos.length; i += 3) {
			const x = wrap(pos[i] + dx, centre.x);
			const y = wrap(pos[i + 1] + dy, centre.y);
			const z = wrap(pos[i + 2] + dz, centre.z);
			pos[i] = x;
			pos[i + 1] = y;
			pos[i + 2] = z;
			const j = i * 2;
			this.#linePos[j] = x;
			this.#linePos[j + 1] = y;
			this.#linePos[j + 2] = z;
			this.#linePos[j + 3] = x + sx;
			this.#linePos[j + 4] = y + sy;
			this.#linePos[j + 5] = z + sz;
		}
		this.#points.geometry.attributes.position.needsUpdate = true;
		this.#lines.geometry.attributes.position.needsUpdate = true;
		const speed = velocity.length();
		this.#lineMat.opacity = Math.min(0.85, speed / 160);
	}

	setDim(k: number) {
		this.#pointMat.opacity = 0.55 * k;
	}
}

/**
 * The contact to lock onto: a small craft at range. It holds the spot the HUD's target
 * bracket draws on, so the DOM HUD needs no change.
 */
export function contact(p: Palette): { group: Group; beacon: MeshBasicMaterial } {
	const group = new Group();
	group.name = 'contact';
	const body = new Mesh(
		new OctahedronGeometry(9, 0),
		new MeshStandardMaterial({ color: new Color('#9396BA'), flatShading: true, roughness: 0.6 })
	);
	body.scale.set(1.6, 0.45, 1);
	const beacon = new MeshBasicMaterial({ color: new Color('#FF9A7A'), toneMapped: false });
	const light = new Mesh(new IcosahedronGeometry(1.3, 0), beacon);
	light.position.y = 4.4;
	group.add(body, light);
	void p;
	return { group, beacon };
}

/** A tiny scene of glowing panels, prefiltered once into the reflections hull and glass use. */
export function reflectionScene(p: Palette): Group {
	const g = new Group();
	const room = new Mesh(
		new SphereGeometry(50, 16, 12),
		new MeshBasicMaterial({ color: p.ground.clone().multiplyScalar(1.6), side: BackSide })
	);
	g.add(room);
	const panel = (color: Color, k: number, pos: Vector3, scale: Vector3) => {
		const mesh = new Mesh(
			new SphereGeometry(1, 12, 8),
			new MeshBasicMaterial({ color: color.clone().multiplyScalar(k) })
		);
		mesh.position.copy(pos);
		mesh.scale.copy(scale);
		g.add(mesh);
	};
	panel(new Color('#FFFFFF'), 2.4, new Vector3(-30, 25, -20), new Vector3(10, 6, 10));
	panel(p.violetBright, 1.6, new Vector3(30, 5, 10), new Vector3(8, 14, 8));
	panel(new Color('#C9CCE4'), 0.9, new Vector3(-26, -18, -32), new Vector3(18, 14, 4));
	panel(p.gold, 0.6, new Vector3(0, -30, 30), new Vector3(16, 3, 16));
	return g;
}
