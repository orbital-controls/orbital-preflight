<script lang="ts">
	import { onMount } from 'svelte';
	import type { SceneProps } from '#lib/orbital-preflight/flight.ts';
	import type { Analog } from '#lib/orbital-preflight/scene/analog.ts';
	import { srvTargets } from '#lib/orbital-preflight/scene/srv.ts';
	import { partTargets } from '#lib/orbital-preflight/scene/targets.ts';
	import type { Engine } from '#lib/orbital-preflight/scene/three/index.ts';

	/**
	 * The real-time 3D viewport. It implements the placeholder's props (`SceneProps`), plus
	 * the bound stick axes, and reads them once a frame. It never handles input and never
	 * writes state; it only says whether WebGL came up, so the page can fall back to the
	 * 2D placeholder.
	 */
	interface Props extends SceneProps {
		analog: Analog;
		/** A drawer, dialog or the full editor covers the viewport. */
		covered: boolean;
		/** Listening for a rebind: the SRV holds still. */
		frozen: boolean;
		onstatus: (status: 'ready' | 'failed') => void;
	}

	let { flight, mode, analog, covered, frozen, onstatus }: Props = $props();

	// A plain ref rather than an attachment: the engine is created once, after an async
	// import, and disposed with the component.
	let canvas: HTMLCanvasElement;
	let engine = $state.raw<Engine | null>(null);
	let tabVisible = $state(true);
	let onScreen = $state(true);
	let frameMs = $state(0);
	/** The mode whose 3D scene is built, if any. */
	let shown = $state<string | null>(null);

	// Exposed as data attributes for the smoke test and for measuring on real hardware.
	const targets = $derived(partTargets(flight));
	const srv = $derived(srvTargets(flight, analog));

	onMount(() => {
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		// Dev only: `?op-orbit=135` views the ship from another angle (screenshots, modelling).
		const orbit = import.meta.env.DEV
			? Number(new URLSearchParams(location.search).get('op-orbit') ?? 0)
			: 0;
		let gone = false;
		let local: Engine | null = null;
		const firstMode = mode;
		import('#lib/orbital-preflight/scene/three/index.ts')
			.then(async ({ createEngine }) => {
				if (gone) return;
				try {
					local = createEngine({
						canvas,
						themeRoot: canvas,
						reducedMotion,
						mode: firstMode,
						read: () => ({ flight, mode, analog, reducedMotion, orbit, frozen }),
						onscene: (m) => (shown = m),
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
			if (local) frameMs = Math.round(local.stats().frameMs * 100) / 100;
		}, 1000);

		return () => {
			gone = true;
			document.removeEventListener('visibilitychange', onVisibility);
			io.disconnect();
			clearInterval(stats);
			local?.dispose();
			engine = null;
		};
	});

	// Builds the mode's scene and drops the last one as soon as the mode changes, even when
	// the loop is stopped (on foot has no 3D scene yet). The engine reports back through
	// `onscene`, which sets `shown`: a data attribute only, read by no effect.
	$effect(() => {
		engine?.select(mode);
	});

	// Starts and stops the engine's own render loop; it assigns no Svelte state.
	$effect(() => {
		engine?.setRunning(tabVisible && onScreen && !covered && engine.supports(mode));
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
	data-op-scene-mode={shown}
	data-op-steer={Math.round((srv.steer * 180) / Math.PI)}
	data-op-jets={srv.jets ? 'boost' : 'idle'}
	data-op-camera={flight.cam}
	data-op-frame-ms={frameMs}
	class="absolute inset-0 size-full {flight.nv ? 'op-nv' : ''}"
></canvas>

<style>
	/* Night vision: a post tint on the rendered image only; the HUD stays as it is. */
	.op-nv {
		filter: sepia(0.5) hue-rotate(185deg) saturate(1.8) brightness(1.4) contrast(1.05);
	}
</style>
