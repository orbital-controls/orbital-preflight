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
import { SrvScene } from './srv-scene.ts';

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
	/**
	 * The context was lost or a frame threw (a model missing a part, say): the loop has
	 * stopped and the page falls back to the 2D placeholder.
	 */
	onfail: () => void;
	/** Cap on the device pixel ratio. */
	maxPixelRatio?: number;
	reducedMotion: boolean;
	/** The mode whose scene to build first. */
	mode: Mode;
	/** A mode's scene was built (or `null`: none is up). */
	onscene?: (mode: Mode | null) => void;
}

export interface Engine {
	/**
	 * Resolves once the shaders are compiled. Start rendering after it: drawing before
	 * would block the page while the driver compiles (seconds with software WebGL).
	 */
	ready: Promise<void>;
	/** Modes with a 3D scene. The others keep their 2D placeholder. */
	supports(mode: Mode): boolean;
	/**
	 * Shows `mode`: builds its scene and disposes the last one, at once (no transition).
	 * A mode with no 3D scene just disposes the last one.
	 */
	select(mode: Mode): void;
	setRunning(running: boolean): void;
	resize(width: number, height: number): void;
	/** Rolling average CPU time per frame (update + render), and the frame interval, in ms. */
	stats(): { frameMs: number; intervalMs: number };
	targets(): PartTargets | null;
	/** The model on show, for the part-contract check. */
	model(): Object3D | null;
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

	const glow = glowTexture();
	let env: Texture | null = null;
	let palette: ReturnType<typeof readPalette>;
	try {
		palette = readPalette(options.themeRoot);
		const pmrem = new PMREMGenerator(renderer);
		const room = new Scene();
		room.add(reflectionScene(palette));
		env = pmrem.fromScene(room, 0.04).texture;
		pmrem.dispose();
		disposeTree(room);
	} catch (error) {
		env?.dispose();
		glow.dispose();
		renderer.dispose();
		renderer.forceContextLoss();
		throw error;
	}
	// Shared across scenes, so a scene's disposal leaves them alone.
	const shared = new Set<Texture>(env ? [glow, env] : [glow]);

	const stage = () => {
		const scene = new Scene();
		scene.background = palette.ground.clone();
		scene.environment = env;
		return scene;
	};
	const factories: Partial<Record<Mode, () => ModeScene>> = {
		ship: () => new ShipScene(stage(), palette, glow, { dust: options.reducedMotion ? 420 : 900 }),
		srv: () => new SrvScene(stage(), palette, glow, { reducedMotion: options.reducedMotion })
	};
	let active: { mode: Mode; scene: ModeScene } | null = null;
	let size = { width: 900, height: 560 };

	const drop = () => {
		if (!active) return;
		active.scene.dispose();
		disposeTree(active.scene.scene, shared);
		active = null;
	};
	const select = (mode: Mode) => {
		if (active?.mode === mode) return;
		drop();
		const make = factories[mode];
		if (!make) {
			options.onscene?.(null);
			return;
		}
		const scene = make();
		scene.camera.aspect = size.width / size.height;
		scene.camera.updateProjectionMatrix();
		active = { mode, scene };
		options.onscene?.(mode);
	};

	try {
		select(options.mode);
	} catch (error) {
		// Half-built: release the context before the page falls back.
		drop();
		env?.dispose();
		glow.dispose();
		renderer.dispose();
		renderer.forceContextLoss();
		throw error;
	}

	// Compile in the background where the driver can (KHR_parallel_shader_compile). Where
	// it can't, the first frame compiles, as it would anyway.
	const first = active as { scene: ModeScene } | null;
	const ready =
		first && renderer.extensions.has('KHR_parallel_shader_compile')
			? renderer.compileAsync(first.scene.scene, first.scene.camera).then(
					() => undefined,
					() => undefined
				)
			: Promise.resolve();

	let frame = 0;
	let running = false;
	let last = 0;
	let frameMs = 0;
	let intervalMs = 16.7;

	const loop = (now: number) => {
		const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
		if (last) intervalMs += (now - last - intervalMs) * 0.05;
		last = now;
		const input = options.read();
		const t0 = performance.now();
		try {
			select(input.mode);
			const shown = active as { scene: ModeScene } | null;
			if (shown) {
				shown.scene.update(input, dt);
				renderer.render(shown.scene.scene, shown.scene.camera);
				frameMs += (performance.now() - t0 - frameMs) * 0.05;
			}
		} catch (error) {
			// One bad frame would throw on every frame after it: stop and fall back.
			running = false;
			console.error(error);
			options.onfail();
			return;
		}
		if (running) frame = requestAnimationFrame(loop);
	};

	const onLost = (event: Event) => {
		event.preventDefault();
		running = false;
		cancelAnimationFrame(frame);
		options.onfail();
	};
	options.canvas.addEventListener('webglcontextlost', onLost);

	return {
		ready,
		supports: (mode) => Boolean(factories[mode]),
		select(mode) {
			try {
				select(mode);
			} catch (error) {
				running = false;
				cancelAnimationFrame(frame);
				console.error(error);
				options.onfail();
			}
		},
		setRunning(on) {
			if (on === running) return;
			running = on;
			if (on) {
				last = 0;
				frame = requestAnimationFrame(loop);
			} else cancelAnimationFrame(frame);
		},
		resize(width, height) {
			size = { width, height };
			renderer.setSize(width, height, false);
			if (active) {
				active.scene.camera.aspect = width / height;
				active.scene.camera.updateProjectionMatrix();
			}
		},
		stats: () => ({ frameMs, intervalMs }),
		targets: () => active?.scene.targets() ?? null,
		model: () => active?.scene.root ?? null,
		dispose() {
			cancelAnimationFrame(frame);
			running = false;
			options.canvas.removeEventListener('webglcontextlost', onLost);
			drop();
			env?.dispose();
			glow.dispose();
			renderer.dispose();
			renderer.forceContextLoss();
		}
	};
}

/** Frees every geometry, material and texture under `root`, except the `keep` textures. */
function disposeTree(root: Object3D, keep: ReadonlySet<Texture> = new Set()) {
	root.traverse((o) => {
		const mesh = o as Mesh;
		mesh.geometry?.dispose();
		const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		for (const material of materials) {
			if (!(material instanceof Material)) continue;
			for (const value of Object.values(material))
				if (value instanceof Texture && !keep.has(value)) value.dispose();
			material.dispose();
		}
	});
}
