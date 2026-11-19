<script lang="ts">
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';

	/**
	 * The mark and wordmark from the config. The framework default is the wordmark alone;
	 * a fork's mark is its own SVG, trusted as part of its config.
	 */
	interface Props {
		size?: number;
	}

	let { size = 28 }: Props = $props();
	const app = useOrbitalPreflight();
	const brand = $derived(app.config.brand);
</script>

<span class="flex items-center gap-[10px]">
	{#if brand.mark}
		<span
			class="op-mark flex-none"
			style:width="{size}px"
			style:height="{size}px"
			aria-hidden="true"
		>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- the fork's own SVG from its config -->
			{@html brand.mark}
		</span>
	{/if}
	<span class="font-display text-[20px] font-black tracking-[.04em] text-ink-200 uppercase">
		{brand.wordmark}
	</span>
</span>

<style>
	.op-mark :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
