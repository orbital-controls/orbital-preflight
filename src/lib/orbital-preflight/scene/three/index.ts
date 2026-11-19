import {
	ACESFilmicToneMapping,
	Material,
	Mesh,
	PMREMGenerator,
	Scene,
	Texture,
	WebGLRenderer,
	type Object3D
} from 'three';
import type { Mode } from '../../types.ts';
import type { PartTargets } from '../targets.ts';
import { readPalette } from './palette.ts';
import { ShipScene, type FrameInput, type ModeScene } from './ship-scene.ts';
import { glowTexture, reflectionScene } from './space.ts';

/**
 * The 3D viewport's engine, loaded with a dynamic import so three.js stays out of the
 * page's first bundle. It owns the renderer and the loop and reads the page's state once
 * a frame through `read`; it never handles input and never writes state back.
 */

export interface EngineOptions {
	canvas: HTMLCanvasElement;
	/** Where the theme's colours are read from. */
	themeRoot: Element;
	read: () => FrameInput & { mode: Mode };
	/** The context was lost: the page falls back to the 2D placeholder. */
	onlost: () => void;
	/** Cap on the device pixel ratio. */
	maxPixelRatio?: number;
	reducedMotion: boolean;
}

export interface Engine {
	/** Modes with a 3D scene. The others keep their 2D placeholder. */
	supports(mode: Mode): boolean;
	setRunning(running: boolean): void;
	resize(width: number, height: number): void;
	/** Rolling average CPU time per frame (update + render), and the frame interval, in ms. */
	stats(): { frameMs: number; intervalMs: number };
	targets(): PartTargets | null;
	/** The ship model, for the part-contract check. */
	model(): Object3D;
	dispose(): void;
}

export function createEngine(options: EngineOptions): Engine {
	const renderer = new WebGLRenderer({
		canvas: options.canvas,
		antialias: true,
		powerPreference: 'high-performance',
		alpha: false
	});
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.maxPixelRatio ?? 1.5));
	renderer.toneMapping = ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.05;

	const palette = readPalette(options.themeRoot);
	const glow = glowTexture();
	const scene = new Scene();
	scene.background = palette.ground.clone();
	const pmrem = new PMREMGenerator(renderer);
	const room = new Scene();
	room.add(reflectionScene(palette));
	const env = pmrem.fromScene(room, 0.04).texture;
	scene.environment = env;
	pmrem.dispose();
	disposeTree(room);

	const scenes: Partial<Record<Mode, ModeScene>> = {
		ship: new ShipScene(scene, palette, glow, { dust: options.reducedMotion ? 420 : 900 })
	};

	let frame = 0;
	let running = false;
	let last = 0;
	let frameMs = 0;
	let intervalMs = 16.7;

	const loop = (now: number) => {
		frame = requestAnimationFrame(loop);
		const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
		if (last) intervalMs += (now - last - intervalMs) * 0.05;
		last = now;
		const input = options.read();
		const active = scenes[input.mode];
		if (!active) return;
		const t0 = performance.now();
		active.update(input, dt);
		renderer.render(active.scene, active.camera);
		frameMs += (performance.now() - t0 - frameMs) * 0.05;
	};

	const onLost = (event: Event) => {
		event.preventDefault();
		options.onlost();
	};
	options.canvas.addEventListener('webglcontextlost', onLost);

	return {
		supports: (mode) => Boolean(scenes[mode]),
		setRunning(on) {
			if (on === running) return;
			running = on;
			if (on) {
				last = 0;
				frame = requestAnimationFrame(loop);
			} else cancelAnimationFrame(frame);
		},
		resize(width, height) {
			renderer.setSize(width, height, false);
			for (const s of Object.values(scenes)) {
				s.camera.aspect = width / height;
				s.camera.updateProjectionMatrix();
			}
		},
		stats: () => ({ frameMs, intervalMs }),
		targets: () => scenes.ship?.targets() ?? null,
		model: () => (scenes.ship as ShipScene).root,
		dispose() {
			cancelAnimationFrame(frame);
			running = false;
			options.canvas.removeEventListener('webglcontextlost', onLost);
			for (const s of Object.values(scenes)) s.dispose();
			disposeTree(scene);
			env.dispose();
			glow.dispose();
			renderer.dispose();
			renderer.forceContextLoss();
		}
	};
}

/** Frees every geometry, material and texture under `root`. */
function disposeTree(root: Object3D) {
	root.traverse((o) => {
		const mesh = o as Mesh;
		mesh.geometry?.dispose();
		const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		for (const material of materials) {
			if (!(material instanceof Material)) continue;
			for (const value of Object.values(material)) if (value instanceof Texture) value.dispose();
			material.dispose();
		}
	});
}
