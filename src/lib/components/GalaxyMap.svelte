<script lang="ts">
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import {
		distance,
		gridPaths,
		HOME_SYSTEM,
		JUMP_RANGE,
		rangePath,
		routePath,
		SYSTEMS,
		underReticle,
		type GalaxyMapState,
		type StarClass
	} from '#lib/orbital-preflight/scene/galaxy-map.ts';
	import { bindLabel } from '#lib/orbital-preflight/labels.ts';
	import { pathThrough, project, VIEW_H, VIEW_W } from '#lib/orbital-preflight/scene/map-camera.ts';
	import MapLegend from './MapLegend.svelte';

	/**
	 * The galaxy map over the flight view, while it's open: the star systems around the
	 * ship on a grid that follows the camera, the jump range, the reticle, the plotted
	 * route, the selected system's card and the map's binds.
	 */
	interface Props {
		map: GalaxyMapState;
	}

	let { map }: Props = $props();
	const app = useOrbitalPreflight();

	const COLOUR: Record<StarClass, string> = {
		M: '#ff9a6b',
		K: '#ffc48a',
		G: '#fff1c4',
		F: '#f4f6ff',
		A: '#cfdcff',
		B: '#9fb8ff'
	};

	const grid = $derived(gridPaths(map));
	const range = $derived(rangePath(map));
	const route = $derived(routePath(map));
	const under = $derived(underReticle(map));
	const onRoute = $derived(new Set(map.route));

	/** Far ones first, so near ones draw over them; a stalk drops each nearby one to the grid. */
	const stars = $derived(
		SYSTEMS.map((sys, i) => {
			const p = project(map, sys.at);
			const near = distance(sys.at, map.focus) < 30;
			const stalk = near ? pathThrough(map, [sys.at, { ...sys.at, y: map.focus.y }]) : '';
			const named =
				i === HOME_SYSTEM ||
				i === map.sel ||
				i === under ||
				onRoute.has(i) ||
				distance(sys.at, map.focus) < 16;
			return { sys, i, p, stalk, named };
		})
			.filter(({ p }) => p.depth > 0.1)
			.sort((a, b) => b.p.depth - a.p.depth)
	);

	const sel = $derived(map.sel === null ? null : SYSTEMS[map.sel]);
	const selLy = $derived(sel ? distance(sel.at, SYSTEMS[HOME_SYSTEM].at) : 0);
	const plotted = $derived(map.sel !== null && map.route.at(-1) === map.sel);
	const focusLy = $derived(distance(map.focus, SYSTEMS[HOME_SYSTEM].at));

	/** Menu select's key, for the card's "plot route" hint. */
	const selectKey = $derived.by(() => {
		const action = app.mapActions.find((a) => a.effect === 'uiSelect');
		const slot = action ? app.store.bindings[action.id]?.find((b) => b !== null) : null;
		return slot ? bindLabel(slot, app.roles) : null;
	});

	/** The galaxy map's binds, by what they do. */
	const ROWS: [string, string[]][] = [
		['Pitch', ['mapPitchUp', 'mapPitchDn']],
		['Yaw', ['mapYawL', 'mapYawR']],
		['Forward / back', ['mapFwd', 'mapBack']],
		['Left / right', ['mapLeft', 'mapRight']],
		['Up / down', ['mapUp', 'mapDown', 'mapZHold']],
		['Zoom', ['mapZoomIn', 'mapZoomOut']],
		['Select · plot route', ['uiSelect']],
		['Back to your system', ['mapHome']],
		['Close', ['galmap', 'uiBack']]
	];

	const fmt = (ly: number) => ly.toFixed(2);
</script>

<div class="absolute inset-0 bg-void" data-op-galaxy-map>
	<svg
		class="absolute inset-0"
		viewBox="0 0 {VIEW_W} {VIEW_H}"
		aria-hidden="true"
		data-op-map-yaw={Math.round(map.yaw)}
		data-op-map-under={under ?? ''}
		data-op-map-route={map.route.length}
	>
		<g fill="none" stroke="var(--color-course)" stroke-opacity="0.16" stroke-width="1">
			{#each grid as d, i (i)}<path {d} />{/each}
		</g>
		<path
			d={range}
			fill="none"
			stroke="var(--color-course)"
			stroke-opacity="0.55"
			stroke-dasharray="4 5"
		/>
		{#each stars as { stalk, i } (i)}
			{#if stalk}<path
					d={stalk}
					stroke="var(--color-ink-900)"
					stroke-opacity="0.45"
					stroke-width="1"
				/>{/if}
		{/each}
		{#if route}
			<path d={route} fill="none" stroke="var(--color-trail)" stroke-width="2.5" data-op-route />
		{/if}
		{#each stars as { sys, i, p, named } (i)}
			{@const r = Math.max(1.6, 0.7 * p.scale)}
			<circle cx={p.x} cy={p.y} {r} fill={COLOUR[sys.star]} />
			{#if onRoute.has(i)}
				<circle
					cx={p.x}
					cy={p.y}
					r={r + 4}
					fill="none"
					stroke="var(--color-trail)"
					stroke-width="1.5"
				/>
			{/if}
			{#if i === map.sel}
				<circle
					cx={p.x}
					cy={p.y}
					r={r + 9}
					fill="none"
					stroke="var(--color-trail)"
					stroke-width="2"
				/>
			{/if}
			{#if i === HOME_SYSTEM}
				<path d="M{p.x} {p.y - r - 8} l-5 -9 h10 z" fill="var(--color-ink-200)" />
			{/if}
			{#if named}
				<text
					x={p.x + r + 7}
					y={p.y + 4}
					fill={i === map.sel || i === under ? 'var(--color-trail)' : 'var(--color-ink-500)'}
					font-family="var(--font-mono)"
					font-size="12">{sys.name}</text
				>
			{/if}
		{/each}
		<!-- The reticle: Menu select picks what's under it. -->
		<g
			fill="none"
			stroke={under === null ? 'var(--color-ink-500)' : 'var(--color-trail)'}
			stroke-width="1.5"
			transform="translate({VIEW_W / 2} {VIEW_H / 2})"
		>
			<path
				d="M-20 -12 V-20 H-12 M12 -20 H20 V-12 M20 12 V20 H12 M-12 20 H-20 V12 M-4 0 H4 M0 -4 V4"
			/>
		</g>
	</svg>

	<div class="pointer-events-none absolute top-4 left-[18px] flex flex-col gap-1">
		<span class="op-hud text-trail">Galaxy map</span>
		<span class="font-display text-[28px] leading-none font-extrabold uppercase"
			>{under === null ? 'Deep space' : SYSTEMS[under].name}</span
		>
		<span class="font-mono text-[13px] text-ink-500"
			>{fmt(focusLy)} ly from {SYSTEMS[HOME_SYSTEM].name} · jump range {JUMP_RANGE} ly</span
		>
	</div>

	<div
		class="pointer-events-none absolute bottom-4 left-[18px] flex w-[250px] flex-col gap-1 px-[14px] py-3 glass notch op-notch-xs"
		data-op-map-card
	>
		{#if sel}
			<span class="op-hud">{plotted ? 'Route plotted' : 'Selected'}</span>
			<span class="font-display text-[22px] leading-none font-extrabold uppercase">{sel.name}</span>
			<span class="font-mono text-[13px] text-ink-500">{sel.star}-class star</span>
			{#if map.sel === HOME_SYSTEM}
				<span class="op-hud text-ink-200">You are here</span>
			{:else}
				<span class="font-mono text-[13px] text-ink-500">{fmt(selLy)} ly from you</span>
				{#if plotted}
					<span class="font-mono text-[13px] text-trail"
						>{map.route.length - 1} jump{map.route.length === 2 ? '' : 's'}</span
					>
				{:else if selectKey && map.sel === under}
					<span class="flex items-center gap-2 font-mono text-[13px] text-ink-200"
						><span
							class="bg-ink-200 px-[7px] py-[1px] text-[12px] font-bold text-void notch op-notch-xs"
							>{selectKey}</span
						>Plot route</span
					>
				{/if}
			{/if}
		{:else}
			<span class="op-hud">No system selected</span>
			<span class="font-mono text-[13px] text-ink-500">
				{selectKey
					? `Put a system under the reticle and press ${selectKey}.`
					: 'Bind Menu select to pick a system.'}
			</span>
		{/if}
	</div>

	<MapLegend rows={ROWS} />
</div>
