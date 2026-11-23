<script lang="ts">
	import { project, VIEW_H, VIEW_W } from '#lib/orbital-preflight/scene/map-camera.ts';
	import {
		BODIES,
		bodyAt,
		HOME_BODY,
		KIND_NAMES,
		orbitPath,
		SYSTEM_NAME,
		type BodyKind,
		type SystemMapState
	} from '#lib/orbital-preflight/scene/system-map.ts';
	import MapLegend from './MapLegend.svelte';

	/**
	 * The system map over the flight view, while it's open: the orrery of the system the
	 * ship is in, the selected body's card and the map's binds.
	 */
	interface Props {
		map: SystemMapState;
	}

	let { map }: Props = $props();

	const FILL: Record<BodyKind, string> = {
		star: 'var(--color-trail)',
		rocky: 'var(--color-ink-500)',
		earthlike: 'var(--color-course)',
		gas: 'var(--color-ink-200)',
		icy: 'var(--color-ink-900)'
	};

	const orbits = $derived(BODIES.map((_, i) => orbitPath(map, i)));
	/** Far ones first, so near ones draw over them. */
	const bodies = $derived(
		BODIES.map((body, i) => ({ body, i, p: project(map, bodyAt(i)) }))
			.filter(({ p }) => p.depth > 0.1)
			.sort((a, b) => b.p.depth - a.p.depth)
	);
	const sel = $derived(BODIES[map.sel]);

	/** Four corner brackets around a point, `h` out from it: the target marker. */
	function brackets(x: number, y: number, h: number): string {
		const k = 8;
		return [
			[-1, -1],
			[1, -1],
			[1, 1],
			[-1, 1]
		]
			.map(([sx, sy]) => {
				const cx = x + sx * h;
				const cy = y + sy * h;
				return `M${cx} ${cy - sy * k} V${cy} H${cx - sx * k}`;
			})
			.join(' ');
	}

	/** The system map's binds, by what they do. */
	const ROWS: [string, string[]][] = [
		['Pitch', ['mapPitchUp', 'mapPitchDn']],
		['Yaw', ['mapYawL', 'mapYawR']],
		['Forward / back', ['mapFwd', 'mapBack']],
		['Left / right', ['mapLeft', 'mapRight']],
		['Up / down', ['mapUp', 'mapDown', 'mapZHold']],
		['Zoom', ['mapZoomIn', 'mapZoomOut']],
		['Next body', ['uiLeft', 'uiRight']],
		['Target body', ['uiSelect']],
		['Back to ship', ['mapHome']],
		['Close', ['sysmap', 'uiBack']]
	];
</script>

<div class="absolute inset-0 bg-void" data-op-system-map>
	<svg
		class="absolute inset-0"
		viewBox="0 0 {VIEW_W} {VIEW_H}"
		aria-hidden="true"
		data-op-map-yaw={Math.round(map.yaw)}
		data-op-map-sel={map.sel}
	>
		<g fill="none" stroke="var(--color-course)" stroke-opacity="0.35" stroke-width="1">
			{#each orbits as d, i (i)}
				{#if d}<path {d} />{/if}
			{/each}
		</g>
		{#each bodies as { body, i, p } (i)}
			{@const r = Math.max(2, body.radius * p.scale)}
			<circle cx={p.x} cy={p.y} {r} fill={FILL[body.kind]} />
			{#if i === map.sel}
				<circle
					cx={p.x}
					cy={p.y}
					r={r + 7}
					fill="none"
					stroke="var(--color-trail)"
					stroke-width="1.5"
				/>
			{/if}
			{#if i === map.target}
				<path
					d={brackets(p.x, p.y, r + 12)}
					fill="none"
					stroke="var(--color-trail)"
					stroke-width="2"
					data-op-map-target
				/>
			{/if}
			{#if i === HOME_BODY}
				<path d="M{p.x} {p.y - r - 16} l-5 -9 h10 z" fill="var(--color-ink-200)" data-op-map-ship />
			{/if}
			<text
				x={p.x + r + (i === map.sel ? 12 : 6)}
				y={p.y + 4}
				fill={i === map.sel ? 'var(--color-trail)' : 'var(--color-ink-500)'}
				font-family="var(--font-mono)"
				font-size="12">{body.name}</text
			>
		{/each}
	</svg>

	<div class="pointer-events-none absolute top-4 left-[18px] flex flex-col gap-1">
		<span class="op-hud text-trail">System map</span>
		<span class="font-display text-[28px] leading-none font-extrabold uppercase">{SYSTEM_NAME}</span
		>
	</div>

	<div
		class="pointer-events-none absolute bottom-4 left-[18px] flex w-[240px] flex-col gap-1 px-[14px] py-3 glass notch op-notch-xs"
		data-op-map-card
	>
		<span class="op-hud">{map.sel === map.target ? 'Targeted' : 'Selected'}</span>
		<span class="font-display text-[22px] leading-none font-extrabold uppercase">{sel.name}</span>
		<span class="font-mono text-[13px] text-ink-500">{KIND_NAMES[sel.kind]}</span>
		<span class="font-mono text-[13px] text-ink-500"
			>{sel.ls ? `${sel.ls.toLocaleString('en')} ls from the star` : 'Arrival star'}</span
		>
		{#if map.sel === HOME_BODY}<span class="op-hud text-ink-200">Your ship is here</span>{/if}
	</div>

	<MapLegend rows={ROWS} />
</div>
