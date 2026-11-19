import {
	BoxGeometry,
	CanvasTexture,
	CatmullRomCurve3,
	Color,
	CylinderGeometry,
	Group,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PlaneGeometry,
	SphereGeometry,
	SRGBColorSpace,
	TubeGeometry,
	type Material
} from 'three';
import { m } from './geometry.ts';
import { ROOF } from './lantern.ts';
import type { Palette } from './palette.ts';

/**
 * The cockpit from the pilot's (left) seat, after StandCockpit3D: one clear windshield
 * framed only by the sill, the header rail and the canopy's outer edges; a violet light
 * arch with a gold core along the header; a dash with Pilot, Shared and Co-pilot screen
 * clusters; a centre console; stick and throttle.
 *
 * Built in ship space and parented to the ship, so it banks with it. Only shown in the
 * cockpit camera.
 */

/** The pilot's eye, model space (X forward, Y port, Z up). */
export const EYE = { x: 14.6, y: 2.3, z: 5.55 };

export interface Cockpit {
	group: Group;
	stick: Group;
	throttle: Group;
	/** Throttle grip travel along the console, units, from idle to full. */
	throttleTravel: number;
	screens: { pilot: CanvasTexture; shared: CanvasTexture; copilot: CanvasTexture };
	arch: MeshBasicMaterial;
	archCore: MeshBasicMaterial;
	screenMaterials: MeshBasicMaterial[];
}

function box(
	x: [number, number],
	y: [number, number],
	z: [number, number],
	material: Material,
	name = ''
): Mesh {
	const b = new Mesh(new BoxGeometry(y[1] - y[0], z[1] - z[0], x[1] - x[0]), material);
	b.position.copy(m((x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2));
	b.name = name;
	return b;
}

function screenTexture(): CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 256;
	canvas.height = 160;
	const t = new CanvasTexture(canvas);
	t.colorSpace = SRGBColorSpace;
	return t;
}

export function buildCockpit(p: Palette): Cockpit {
	const group = new Group();
	group.name = 'cockpit';
	const shell = new MeshStandardMaterial({
		color: new Color('#1A1C3A'),
		roughness: 0.75,
		metalness: 0.3
	});
	const panel = new MeshStandardMaterial({
		color: new Color('#23264A'),
		roughness: 0.6,
		metalness: 0.35
	});
	const grip = new MeshStandardMaterial({
		color: new Color('#2A2D4E'),
		roughness: 0.5,
		metalness: 0.2
	});

	// Floor, side consoles and the sill under the windshield.
	group.add(box([12.3, 19.8], [-5.2, 5.2], [ROOF, ROOF + 0.04], shell));
	group.add(box([12.6, 18.4], [4.3, 5.3], [ROOF, 4.95], panel));
	group.add(box([12.6, 18.4], [-5.3, -4.3], [ROOF, 4.95], panel));
	group.add(box([18.5, 18.85], [-4.9, 4.9], [4.93, 5.04], shell, 'sill'));

	// The dash, leaning back toward the crew, with three screen clusters.
	const dash = box([17.3, 18.8], [-4.6, 4.6], [ROOF, 4.95], panel, 'dash');
	group.add(dash);
	const screenMaterials: MeshBasicMaterial[] = [];
	const screens = { pilot: screenTexture(), shared: screenTexture(), copilot: screenTexture() };
	const clusters: [keyof typeof screens, number, number][] = [
		['pilot', 2.3, 1.5],
		['shared', 0, 1.25],
		['copilot', -2.3, 1.5]
	];
	for (const [key, y, w] of clusters) {
		const material = new MeshBasicMaterial({ map: screens[key], toneMapped: false });
		screenMaterials.push(material);
		const screen = new Mesh(new PlaneGeometry(w, w * 0.62), material);
		screen.name = `screen${key[0].toUpperCase()}${key.slice(1)}`;
		screen.position.copy(m(16.98, y, 4.78));
		// Face the crew (aft, +Z in three), tilted back.
		screen.rotation.x = -0.35;
		group.add(screen);
		// Small side screens either side of each cluster.
		for (const dy of [-1, 1]) {
			const side = new Mesh(
				new PlaneGeometry(0.42, 0.36),
				new MeshBasicMaterial({ color: p.violet.clone().multiplyScalar(0.55), toneMapped: false })
			);
			side.position.copy(m(16.99, y + dy * (w / 2 + 0.3), 4.76));
			side.rotation.x = -0.35;
			group.add(side);
		}
	}

	// The header rail across the top of the windshield, and the light arch under it.
	group.add(box([15.8, 16.2], [-4.9, 4.9], [6.02, 6.18], shell, 'header'));
	const curve = new CatmullRomCurve3([
		m(16.3, 5.0, 4.95),
		m(16.15, 4.3, 5.85),
		m(16.05, 0, 5.99),
		m(16.15, -4.3, 5.85),
		m(16.3, -5.0, 4.95)
	]);
	const arch = new MeshBasicMaterial({ color: p.violet.clone(), toneMapped: false });
	const archCore = new MeshBasicMaterial({ color: p.gold.clone(), toneMapped: false });
	const archMesh = new Mesh(new TubeGeometry(curve, 48, 0.05, 8), arch);
	archMesh.name = 'lightArch';
	const coreMesh = new Mesh(new TubeGeometry(curve, 48, 0.022, 6), archCore);
	coreMesh.position.y = -0.035;
	group.add(archMesh, coreMesh);

	// Centre console between the seats.
	group.add(box([13.4, 17.2], [-0.6, 0.6], [ROOF, 4.85], panel, 'console'));
	for (let i = 0; i < 6; i++) {
		const key = box(
			[14.0 + i * 0.5, 14.28 + i * 0.5],
			[-0.4 + (i % 2) * 0.5, -0.12 + (i % 2) * 0.5],
			[4.85, 4.88],
			new MeshBasicMaterial({ color: i % 3 === 0 ? p.gold.clone() : p.violetBright.clone() })
		);
		group.add(key);
	}

	// Stick (right hand) and throttle (left hand). Pivots at their bases.
	const stick = new Group();
	stick.name = 'stick';
	stick.position.copy(m(15.6, 1.5, ROOF + 0.05));
	const shaft = new Mesh(new CylinderGeometry(0.035, 0.05, 0.5, 10), grip);
	shaft.position.y = 0.25;
	const head = new Mesh(new SphereGeometry(0.065, 12, 8), grip);
	head.scale.set(1, 1.5, 1);
	head.position.y = 0.56;
	const hat = new Mesh(
		new BoxGeometry(0.04, 0.03, 0.04),
		new MeshBasicMaterial({ color: p.gold.clone() })
	);
	hat.position.set(0, 0.68, -0.03);
	stick.add(shaft, head, hat);
	group.add(stick);

	const throttle = new Group();
	throttle.name = 'throttleGrip';
	throttle.position.copy(m(15.0, 3.9, 4.95));
	const lever = new Mesh(new BoxGeometry(0.07, 0.3, 0.07), grip);
	lever.position.y = 0.15;
	const handle = new Mesh(new BoxGeometry(0.22, 0.12, 0.17), grip);
	handle.position.y = 0.33;
	throttle.add(lever, handle);
	throttle.userData.idleZ = throttle.position.z;
	group.add(throttle);
	group.add(box([14.4, 16.0], [3.8, 4.0], [4.95, 4.97], shell));

	group.visible = false;
	return {
		group,
		stick,
		throttle,
		throttleTravel: 0.8,
		screens,
		arch,
		archCore,
		screenMaterials
	};
}

export interface ScreenData {
	thr: number;
	pips: readonly number[];
	heat: number;
	speed: number;
}

/** Redraws the dash screens: throttle on the pilot's, power pips on the shared one. */
export function drawScreens(c: Cockpit, p: Palette, d: ScreenData) {
	const violet = `#${p.violetBright.getHexString()}`;
	const gold = `#${p.gold.getHexString()}`;
	const ground = '#0B0D22';
	const draw = (t: CanvasTexture, fn: (g: CanvasRenderingContext2D) => void) => {
		const canvas = t.image as HTMLCanvasElement;
		const g = canvas.getContext('2d');
		if (!g) return;
		g.fillStyle = ground;
		g.fillRect(0, 0, canvas.width, canvas.height);
		g.font = 'bold 18px monospace';
		fn(g);
		t.needsUpdate = true;
	};
	draw(c.screens.pilot, (g) => {
		g.fillStyle = violet;
		g.fillText('THROTTLE', 16, 30);
		g.fillText(`${Math.round(d.thr * 100)}%`, 180, 30);
		g.fillStyle = 'rgba(139,136,255,0.2)';
		g.fillRect(16, 46, 224, 20);
		g.fillStyle = violet;
		g.fillRect(16, 46, 224 * d.thr, 20);
		g.font = 'bold 40px monospace';
		g.fillStyle = '#E6E8F6';
		g.fillText(String(d.speed), 16, 120);
		g.font = 'bold 16px monospace';
		g.fillStyle = violet;
		g.fillText('M/S', 16, 146);
	});
	draw(c.screens.shared, (g) => {
		['SYS', 'ENG', 'WEP'].forEach((name, i) => {
			const x = 22 + i * 78;
			g.fillStyle = violet;
			g.fillText(name, x, 32);
			for (let k = 0; k < 4; k++) {
				g.fillStyle = k < (d.pips[i] ?? 0) ? violet : 'rgba(139,136,255,0.18)';
				g.fillRect(x, 130 - k * 22, 50, 16);
			}
		});
	});
	draw(c.screens.copilot, (g) => {
		g.fillStyle = gold;
		g.fillText('HEAT', 16, 30);
		g.fillText(`${Math.round(d.heat * 100)}%`, 180, 30);
		g.fillStyle = 'rgba(255,154,122,0.2)';
		g.fillRect(16, 46, 224, 20);
		g.fillStyle = '#FF9A7A';
		g.fillRect(16, 46, 224 * d.heat, 20);
	});
}
