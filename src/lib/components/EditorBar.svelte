<script lang="ts">
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { simById } from '#lib/orbital-preflight/sims/index.ts';
	import Brand from './Brand.svelte';

	/** The editor mode bar (StandBar). */
	interface Props {
		onexit: () => void;
	}

	let { onexit }: Props = $props();
	const app = useOrbitalPreflight();
	const devices = $derived([
		{ name: 'Keyboard', ready: true },
		...app.roles.map((r) => ({
			name: r.long,
			ready: app.hub.pads.some((p) => p.deviceId === r.id)
		}))
	]);
</script>

<header class="border-b border-course/20 bg-abyss font-mono text-ink-200">
	<div class="op-wrap flex h-14 items-center gap-[18px]">
		<button
			type="button"
			onclick={onexit}
			aria-label="{app.config.brand.label}, back to flight"
			class="cursor-pointer border-0 bg-transparent p-0"><Brand /></button
		>
		<span aria-hidden="true" class="h-6 w-px bg-course/30"></span>
		<span class="text-[13px] text-ink-500">{simById(app.sim).name} · {app.fileLine}</span>
		<ul class="ml-3 flex gap-[14px] text-[12px] tracking-[.08em] text-ink-900 uppercase">
			{#each devices as d (d.name)}
				<li class="flex items-center gap-[6px]">
					<span
						class="size-[7px] rounded-full {d.ready ? 'bg-trail' : 'bg-ink-950/50'}"
						aria-hidden="true"
					></span>{d.name}
				</li>
			{/each}
		</ul>
		<span class="ml-auto text-[12px] text-ink-900">Full editor · same session as the flight</span>
		<button
			type="button"
			onclick={onexit}
			class="flex h-9 cursor-pointer items-center gap-2 border border-course/40 bg-transparent px-[14px] text-[13px] font-semibold text-ink-200 [--notch:8px] notch"
		>
			<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"
				><path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" stroke-width="1.6" /></svg
			>Exit full editor
		</button>
	</div>
</header>
