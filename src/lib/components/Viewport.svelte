<script lang="ts">
	import type { Snippet } from 'svelte';
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { footHud, shipHud, srvHud, type SceneProps } from '#lib/orbital-preflight/flight.ts';
	import { bindLabel } from '#lib/orbital-preflight/labels.ts';
	import FirstVisit from './FirstVisit.svelte';
	import Hud from './Hud.svelte';
	import PlaceholderScene from './PlaceholderScene.svelte';
	import Scene3D from './Scene3D.svelte';

	/**
	 * The flight view. The ship flies, the SRV drives and the pilot walks Pad 7 in the 3D
	 * scene (`Scene3D`): it gets the mock flight, the mode, the bound axes and the held
	 * binds, renders, and reports back only whether WebGL came up and, on foot, the stop
	 * zone the pilot is in. Where it can't (no WebGL, a lost context) the boards' 2D
	 * placeholder draws. A `scene` snippet still replaces both. The HUD is DOM on top.
	 */
	interface Props {
		scene?: Snippet<[SceneProps]>;
		onwhere: (opener: HTMLElement) => void;
	}

	let { scene, onwhere }: Props = $props();
	const app = useOrbitalPreflight();

	/** WebGL came up. A failure is kept in `app.sceneFailed`, for the rest of the visit. */
	let ready = $state(false);
	/** Modes with a 3D scene. */
	const IN_3D = new Set(['ship', 'srv', 'foot']);
	const live = $derived(!scene && ready && !app.sceneFailed && IN_3D.has(app.mode));
	// The full editor replaces the page, so the viewport unmounts (and the engine is
	// disposed) rather than being covered.
	const covered = $derived(app.drawer !== null || app.leaving);

	const cameraKey = $derived.by(() => {
		const action = app.store.actionsIn(app.mode).find((a) => a.effect === 'camera');
		const slot = action ? app.store.bindings[action.id]?.[0] : null;
		return slot ? bindLabel(slot, app.roles) : null;
	});

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
			if (live) {
				const view = s.cam === 'cockpit' ? 'from the cockpit' : 'chase camera';
				return `3D flight view, ${view}. Throttle ${h.thr} percent, speed ${h.spd} metres per second.`;
			}
			return `Placeholder for the 3D flight view. Throttle ${h.thr} percent, speed ${h.spd} metres per second.`;
		}
		if (app.mode === 'srv') {
			const h = srvHud(s);
			if (live) {
				const view = s.cam === 'cockpit' ? "from the driver's seat" : 'chase camera';
				return `3D driving view, ${view}. Speed ${h.spd} metres per second, ${h.assist}.`;
			}
			return `Placeholder for the 3D SRV driving view. Speed ${h.spd} metres per second, ${h.assist}.`;
		}
		const h = footHud(s);
		if (live) {
			const at = app.footStop ? `, at stop ${app.footStop} of 7` : '';
			return `3D first-person view on Pad 7${at}. Health ${h.health} percent, ${h.ammo} rounds loaded.`;
		}
		return `Placeholder for the 3D first-person view. Health ${h.health} percent, ${h.ammo} rounds loaded.`;
	});

	// The crosshair, as the on-foot placeholder draws it.
	const gap = $derived(app.flight.aim ? 6 : app.flight.walkT > 0 ? 18 : 12);
	const tick = $derived(app.flight.aim ? 8 : 12);
</script>

<!-- The camera button sits outside the mouse zone, so clicking it isn't a mouse bind, and a
     click doesn't focus it, so Space or Enter pressed afterwards fly the ship rather than
     pressing the button again. -->
<div class="relative h-[560px] w-[900px]">
	<div
		data-op-mouse-zone
		class="relative h-[560px] w-[900px] overflow-hidden border border-course/25 bg-abyss space notch-card"
	>
		<div role="img" aria-label={label} class="absolute inset-0">
			{#if app.loaded}
				{#if scene}
					{@render scene({ flight: app.flight, mode: app.mode })}
				{:else}
					{#if !live}
						<PlaceholderScene flight={app.flight} mode={app.mode} />
					{/if}
					{#if !app.sceneFailed}
						<div class={['absolute inset-0', { invisible: !live }]}>
							<Scene3D
								flight={app.flight}
								mode={app.mode}
								analog={app.analog}
								covered={covered || !live}
								frozen={app.cap !== null}
								held={app.held}
								onstatus={(status) => {
									if (status === 'ready') ready = true;
									else app.sceneFailed = true;
								}}
								onstop={(n) => app.enterStop(n)}
							/>
						</div>
					{/if}
					{#if live && app.mode === 'srv' && app.flight.turret}
						<!-- The turret reticle, as the SRV placeholder draws it: the 3D turret aims here. -->
						<svg
							class="pointer-events-none absolute inset-0"
							viewBox="0 0 900 560"
							aria-hidden="true"
							data-op-reticle
						>
							<g stroke="var(--color-trail)" stroke-width="1.5" fill="none"
								><circle cx="450" cy="250" r="24" /><path
									d="M450 214 V234 M450 266 V286 M414 250 H434 M466 250 H486"
								/></g
							>
						</svg>
					{/if}
					{#if live && app.mode === 'foot' && !app.flight.holster}
						<!-- The crosshair, as the on-foot placeholder draws it: rounds go here. -->
						<svg
							class="pointer-events-none absolute inset-0"
							viewBox="0 0 900 560"
							aria-hidden="true"
							data-op-crosshair
						>
							<g stroke="var(--color-ink-200)" stroke-width="1.6"
								><line x1="450" y1={280 - gap - tick} x2="450" y2={280 - gap} /><line
									x1="450"
									y1={280 + gap}
									x2="450"
									y2={280 + gap + tick}
								/><line x1={450 - gap - tick} y1="280" x2={450 - gap} y2="280" /><line
									x1={450 + gap}
									y1="280"
									x2={450 + gap + tick}
									y2="280"
								/></g
							>
						</svg>
					{/if}
				{/if}
			{:else}
				<PlaceholderScene flight={app.flight} mode="ship" empty />
			{/if}
		</div>

		{#if app.loaded}
			{#if !scene && !live}
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
	{#if live && app.mode !== 'foot'}
		<button
			type="button"
			aria-pressed={app.flight.cam === 'cockpit'}
			onclick={() => app.toggleCamera()}
			onmousedown={(event) => event.preventDefault()}
			class="absolute top-4 left-[256px] flex items-center gap-2 border border-course/40 bg-abyss/70 px-[10px] py-[5px] font-mono text-[11px] font-bold tracking-[.1em] text-ink-500 uppercase notch op-notch-xs hover:border-course aria-pressed:border-trail aria-pressed:text-trail"
		>
			<svg
				width="14"
				height="10"
				viewBox="0 0 14 10"
				aria-hidden="true"
				fill="none"
				stroke="currentColor"
				stroke-width="1.4"
				><rect x="0.7" y="1.7" width="8.6" height="6.6" /><path
					d="M9.3 4 L13.3 1.7 V8.3 L9.3 6"
				/></svg
			>
			{app.mode === 'srv' ? "Driver's view" : 'Cockpit view'}{#if cameraKey}<span
					class="text-ink-900">· {cameraKey}</span
				>{/if}
		</button>
	{/if}
</div>
