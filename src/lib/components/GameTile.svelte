<script lang="ts">
	import type { GameRow } from '#lib/orbital-preflight/app.svelte.ts';

	/**
	 * A game's letter tile (ED, SC, X4, DCS), standing in for game art until there is art
	 * we're allowed to use. Gold when current, tinted when loaded, outlined otherwise.
	 */
	interface Props {
		row: GameRow;
	}

	let { row }: Props = $props();
	const tone = $derived(
		row.current && row.loaded
			? 'bg-trail text-void'
			: row.loaded
				? 'bg-trail/16 text-trail'
				: row.sim.status === 'ready'
					? 'border border-ink-900/45 text-ink-900'
					: 'border border-ink-950/40 text-ink-950'
	);
</script>

<span
	aria-hidden="true"
	class="flex size-11 items-center justify-center font-display text-[18px] font-black {tone}"
	>{row.sim.short}</span
>
