<script lang="ts">
	import { usePreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { SIMS } from '#lib/orbital-preflight/sims/index.ts';
	import { chipClass } from './styles.ts';

	/** The sim choice: native radios, drawn as the boards' chips. */
	interface Props {
		name: string;
		layout?: 'row' | 'grid';
	}

	let { name, layout = 'row' }: Props = $props();
	const app = usePreflight();
</script>

<fieldset class={layout === 'grid' ? 'grid grid-cols-2 gap-[6px]' : 'flex gap-[6px]'}>
	<legend class="op-sr-only">Sim</legend>
	{#each SIMS as sim (sim.id)}
		{@const on = app.sim === sim.id}
		<label class="relative">
			<input
				type="radio"
				{name}
				value={sim.id}
				checked={on}
				onchange={() => (app.sim = sim.id)}
				class="peer op-sr-only"
			/>
			<span
				class="flex cursor-pointer flex-col justify-center border font-mono notch op-notch-xs peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-trail {chipClass(
					on
				)} {layout === 'grid'
					? 'min-h-14 px-3 py-2 text-left'
					: 'h-11 px-4 text-[14px] font-semibold'} {!on && sim.status !== 'ready'
					? 'text-ink-900'
					: ''}"
			>
				<span class={layout === 'grid' ? 'text-[14px] font-bold' : ''}>{sim.name}</span>
				{#if layout === 'grid'}<span class="text-[12px] opacity-75">{sim.fileLabel}</span>{/if}
			</span>
		</label>
	{/each}
</fieldset>
