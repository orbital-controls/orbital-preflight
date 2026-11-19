<script lang="ts">
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';

	/** The framework credit. Off when the config sets `poweredBy: false`. */
	const app = useOrbitalPreflight();
</script>

{#if app.config.poweredBy}
	<p class="font-mono text-[12px] text-ink-900">
		<a
			class="text-ink-900 underline hover:text-course"
			href="https://github.com/orbital-controls/orbital-preflight">Powered by Orbital Preflight</a
		>
	</p>
{/if}
