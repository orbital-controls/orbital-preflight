<script lang="ts">
	import type { Snippet } from 'svelte';
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { footHud, shipHud, srvHud, type SceneProps } from '#lib/orbital-preflight/flight.ts';
	import FirstVisit from './FirstVisit.svelte';
	import Hud from './Hud.svelte';
	import PlaceholderScene from './PlaceholderScene.svelte';

	/**
	 * The flight view. `scene` is where the 3D scene plugs in later: it gets the mock
	 * flight and the mode, renders, and reports nothing back. Until then the boards' 2D
	 * placeholder draws. The HUD is DOM on top and doesn't depend on the scene.
	 */
	interface Props {
		scene?: Snippet<[SceneProps]>;
		onwhere: (opener: HTMLElement) => void;
	}

	let { scene, onwhere }: Props = $props();
	const app = useOrbitalPreflight();

	const SCENE_COPY = {
		ship: {
			tag: 'SHIP',
			text: 'Real-time 3D flight view, chase camera. Ship, gear, hardpoints, lights, flame and weapon fire all react to live input.'
		},
		srv: {
			tag: 'SRV',
			text: 'Real-time 3D surface drive, third person. Wheels, suspension, thrusters, headlights and turret react to live input.'
		},
		foot: {
			tag: 'ON FOOT',
			text: 'Real-time first-person view inside a station. Movement, crouch, weapon, flashlight and prompts react to live input.'
		}
	};

	const label = $derived.by(() => {
		if (!app.loaded) return 'No binds loaded yet.';
		const s = app.flight;
		if (app.mode === 'ship') {
			const h = shipHud(s);
			return `Placeholder for the 3D flight view. Throttle ${h.thr} percent, speed ${h.spd} metres per second.`;
		}
		if (app.mode === 'srv') {
			const h = srvHud(s);
			return `Placeholder for the 3D SRV driving view. Speed ${h.spd} metres per second, ${h.assist}.`;
		}
		const h = footHud(s);
		return `Placeholder for the 3D first-person view. Health ${h.health} percent, ${h.ammo} rounds loaded.`;
	});
</script>

<div
	data-op-mouse-zone
	class="relative h-[560px] w-[900px] overflow-hidden border border-course/25 bg-abyss space notch-card"
>
	<div role="img" aria-label={label} class="absolute inset-0">
		{#if app.loaded}
			{#if scene}
				{@render scene({ flight: app.flight, mode: app.mode })}
			{:else}
				<PlaceholderScene flight={app.flight} mode={app.mode} />
			{/if}
		{:else}
			<PlaceholderScene flight={app.flight} mode="ship" empty />
		{/if}
	</div>

	{#if app.loaded}
		{#if !scene}
			<div
				class="pointer-events-none absolute top-24 left-1/2 flex -translate-x-1/2 flex-col items-center gap-[6px] text-center"
				aria-hidden="true"
			>
				<span
					class="border border-dashed border-course/60 bg-abyss/60 px-[10px] py-1 font-mono text-[11px] font-bold tracking-[.14em] text-course notch op-notch-xs"
					>PLACEHOLDER · 3D SCENE · {SCENE_COPY[app.mode].tag}</span
				>
				<span class="max-w-[440px] font-mono text-[13px] text-ink-900"
					>{SCENE_COPY[app.mode].text}</span
				>
			</div>
		{/if}
		<Hud />
	{:else}
		<FirstVisit {onwhere} />
	{/if}
</div>
