<script lang="ts">
	import { onMount } from 'svelte';
	import type { SceneProps } from '#lib/orbital-preflight/flight.ts';
	import type { Analog } from '#lib/orbital-preflight/scene/analog.ts';
	import { srvTargets } from '#lib/orbital-preflight/scene/srv.ts';
	import { partTargets } from '#lib/orbital-preflight/scene/targets.ts';
	import { segmentStates } from '#lib/orbital-preflight/scene/foot.ts';
	import type { Engine } from '#lib/orbital-preflight/scene/three/index.ts';

	/**
	 * The real-time 3D viewport. It implements the placeholder's props (`SceneProps`), plus
	 * the bound stick axes and, on foot, the held binds, and reads them once a frame. It
	 * never writes the flight state. It says whether WebGL came up, so the page can fall
	 * back to the 2D placeholder, and on foot which stop zone the pilot is in. The one
	 * input it handles itself is mouse look on foot, under pointer lock.
	 */
	interface Props extends SceneProps {
		analog: Analog;
		/** A drawer, dialog or the full editor covers the viewport. */
		covered: boolean;
		/** Listening for a rebind: the SRV holds still, and the pilot on foot freezes. */
		frozen: boolean;
		/** On foot: effects whose binds are held down (walk directions, sprint). */
		held: ReadonlySet<string>;
		onstatus: (status: 'ready' | 'failed') => void;
		/** On foot: the pilot entered a stop zone, or left one (null). */
		onstop: (n: number | null) => void;
	}

	let { flight, mode, analog, covered, frozen, held, onstatus, onstop }: Props = $props();

	/**
	 * How long the viewport can sit unseen (a hidden tab, scrolled away) before its scene is
	 * disposed. Coming back builds it again, as a mode switch does, so the on-foot pilot
	 * starts over at the spawn. A drawer over the viewport doesn't count: it only pauses.
	 */
	const RELEASE_AFTER_MS = 30_000;

	// A plain ref rather than an attachment: the engine is created once, after an async
	// import, and disposed with the component.
	let canvas: HTMLCanvasElement;
	let engine = $state.raw<Engine | null>(null);
	let tabVisible = $state(true);
	let onScreen = $state(true);
	let frameMs = $state(0);
	let pixelRatio = $state(1);
	/** GPU resources alive, as `geometries/textures/programs`. */
	let gpu = $state('');
	/** The mode whose 3D scene is built, if any. */
	let shown = $state<string | null>(null);
	/** On foot: target hits so far, and whether the mouse is captured for looking. */
	let hits = $state(0);
	let locked = $state(false);

	// Exposed as data attributes for the smoke test and for measuring on real hardware.
	const targets = $derived(partTargets(flight));
	const srv = $derived(srvTargets(flight, analog));
	const segments = $derived(segmentStates(flight.ammo, null).filter(Boolean).length);

	onMount(() => {
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		// Dev only: `?op-orbit=135` views the ship from another angle (screenshots, modelling).
		const orbit = import.meta.env.DEV
			? Number(new URLSearchParams(location.search).get('op-orbit') ?? 0)
			: 0;
		// Dev only: `?op-overview` views Pad 7 from high in a corner.
		const overview = import.meta.env.DEV && new URLSearchParams(location.search).has('op-overview');
		// `?op-spawn=5` starts on foot at stop 5; `?op-spawn=x,z,yaw` anywhere (screenshots,
		// the smoke test). It only moves where the pilot stands.
		const spawnSpec = new URLSearchParams(location.search).get('op-spawn');
		let gone = false;
		let local: Engine | null = null;
		const firstMode = mode;
		// Mouse look, gathered between frames while the pointer is locked to the viewport.
		let lookX = 0;
		let lookY = 0;
		const takeLook = () => {
			const look = { dx: lookX, dy: lookY };
			lookX = 0;
			lookY = 0;
			return look;
		};
		import('#lib/orbital-preflight/scene/three/index.ts')
			.then(async ({ createEngine, parseSpawn }) => {
				if (gone) return;
				try {
					local = createEngine({
						canvas,
						themeRoot: canvas,
						reducedMotion,
						mode: firstMode,
						spawn: parseSpawn(spawnSpec),
						overview,
						read: () => ({
							flight,
							mode,
							analog,
							reducedMotion,
							orbit,
							frozen,
							held,
							look: takeLook()
						}),
						onscene: (m) => (shown = m),
						onstop: (n) => onstop(n),
						onfail: () => onstatus('failed')
					});
				} catch (error) {
					console.error(error);
					onstatus('failed');
					return;
				}
				local.resize(canvas.clientWidth || 900, canvas.clientHeight || 560);
				await local.ready;
				if (gone) return;
				engine = local;
				onstatus('ready');
			})
			.catch((error) => {
				console.error(error);
				if (!gone) onstatus('failed');
			});

		const onVisibility = () => (tabVisible = document.visibilityState === 'visible');
		onVisibility();
		document.addEventListener('visibilitychange', onVisibility);
		const io = new IntersectionObserver(([entry]) => (onScreen = entry.isIntersecting));
		io.observe(canvas);
		const stats = setInterval(() => {
			if (!local) return;
			const stats = local.stats();
			frameMs = Math.round(stats.frameMs * 100) / 100;
			pixelRatio = stats.pixelRatio;
			gpu = `${stats.gpu.geometries}/${stats.gpu.textures}/${stats.gpu.programs}`;
		}, 1000);
		const footInfo = setInterval(() => {
			if (mode !== 'foot') {
				hits = 0;
				return;
			}
			const info = local?.info();
			hits = typeof info?.hits === 'number' ? info.hits : 0;
		}, 200);

		// Pointer lock only after a click in the viewport, and only on foot. Esc (the
		// browser's) lets go; so do a drawer, a dialog, the editor and listening for a rebind.
		const onDown = () => {
			if (mode !== 'foot' || frozen || covered || document.pointerLockElement === canvas) return;
			try {
				const request = canvas.requestPointerLock?.() as Promise<void> | undefined;
				request?.catch?.(() => undefined);
			} catch {
				// Not allowed here (an iframe, a test browser): the mouse just doesn't look.
			}
		};
		const onLockChange = () => {
			locked = document.pointerLockElement === canvas;
			lookX = 0;
			lookY = 0;
		};
		const onMove = (event: MouseEvent) => {
			if (document.pointerLockElement !== canvas) return;
			lookX += event.movementX;
			lookY += event.movementY;
		};
		canvas.addEventListener('mousedown', onDown);
		document.addEventListener('pointerlockchange', onLockChange);
		document.addEventListener('mousemove', onMove);

		return () => {
			gone = true;
			document.removeEventListener('visibilitychange', onVisibility);
			canvas.removeEventListener('mousedown', onDown);
			document.removeEventListener('pointerlockchange', onLockChange);
			document.removeEventListener('mousemove', onMove);
			if (document.pointerLockElement === canvas) document.exitPointerLock();
			io.disconnect();
			clearInterval(stats);
			clearInterval(footInfo);
			local?.dispose();
			engine = null;
		};
	});

	// Builds the mode's scene and drops the last one as soon as the mode changes, even when
	// the loop is stopped (a drawer covers the viewport, say). The engine reports back through
	// `onscene`, which sets `shown`: a data attribute only, read by no effect.
	$effect(() => {
		engine?.select(mode);
	});

	// Starts and stops the engine's own render loop; it assigns no Svelte state.
	$effect(() => {
		engine?.setRunning(tabVisible && onScreen && !covered && engine.supports(mode));
	});

	// Frees the scene's GPU memory once nobody has seen it for a while; it assigns no Svelte
	// state (`onscene` sets `shown`, a data attribute only).
	$effect(() => {
		if (!engine || (tabVisible && onScreen)) return;
		const idle = engine;
		const timer = setTimeout(() => idle.release(), RELEASE_AFTER_MS);
		return () => clearTimeout(timer);
	});

	// Lets go of the mouse when the pilot freezes (a rebind), something covers the
	// viewport, or the mode changes. It only calls the DOM: `locked` is assigned by the
	// `pointerlockchange` listener, not here.
	$effect(() => {
		if ((frozen || covered || mode !== 'foot') && locked) document.exitPointerLock();
	});
</script>

<canvas
	bind:this={canvas}
	width="900"
	height="560"
	aria-hidden="true"
	data-op-scene="3d"
	data-op-ready={engine !== null}
	data-op-gear={targets.gear}
	data-op-scene-mode={shown ?? 'none'}
	data-op-steer={Math.round((srv.steer * 180) / Math.PI)}
	data-op-jets={srv.jets ? 'boost' : 'idle'}
	data-op-turret={srv.turret ? 'up' : 'stowed'}
	data-op-camera={flight.cam}
	data-op-ammo={segments}
	data-op-hits={hits}
	data-op-pointer-lock={locked}
	data-op-frame-ms={frameMs}
	data-op-pixel-ratio={pixelRatio}
	data-op-gpu={gpu}
	class="absolute inset-0 size-full {(mode === 'foot' ? flight.fNv : flight.nv) ? 'op-nv' : ''}"
></canvas>

<style>
	/* Night vision: a post tint on the rendered image only; the HUD stays as it is. */
	.op-nv {
		filter: sepia(0.5) hue-rotate(185deg) saturate(1.8) brightness(1.4) contrast(1.05);
	}
</style>
