<script lang="ts">
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { bindLabel } from '#lib/orbital-preflight/labels.ts';

	/**
	 * The open map's binds, as the loaded file has them: one row per job, with every key
	 * the file gives it. Rows with nothing bound don't show.
	 */
	interface Props {
		rows: [label: string, effects: string[]][];
	}

	let { rows }: Props = $props();
	const app = useOrbitalPreflight();

	const legend = $derived(
		rows
			.map(([label, effects]) => {
				const keys = app.mapActions
					.filter((a) => a.effect?.split('|').some((e) => effects.includes(e)))
					.flatMap((a) => app.store.bindings[a.id] ?? [])
					.filter((slot) => slot !== null)
					.map((slot) => bindLabel(slot, app.roles));
				return { label, keys: [...new Set(keys)] };
			})
			.filter((row) => row.keys.length)
	);
</script>

{#if legend.length}
	<dl
		class="pointer-events-none absolute right-4 bottom-4 grid w-[280px] grid-cols-[1fr_auto] gap-x-3 gap-y-[5px] px-[14px] py-3 glass notch op-notch-xs"
		data-op-map-legend
	>
		{#each legend as row (row.label)}
			<dt class="font-mono text-[13px] text-ink-500">{row.label}</dt>
			<dd class="flex flex-wrap justify-end gap-1">
				{#each row.keys as key (key)}
					<span
						class="bg-ink-200 px-[7px] py-[1px] font-mono text-[12px] font-bold text-void notch op-notch-xs"
						>{key}</span
					>
				{/each}
			</dd>
		{/each}
	</dl>
{/if}
