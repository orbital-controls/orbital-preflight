<script lang="ts">
	import { asset } from '$app/paths';
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { presetHref } from '#lib/orbital-preflight/presets.ts';
	import { simById } from '#lib/orbital-preflight/sims/index.ts';
	import Brand from './Brand.svelte';
	import PoweredBy from './PoweredBy.svelte';

	/** Below 1280 px: what the tool needs, and the pilot's presets to take away. */
	const app = useOrbitalPreflight();
	/** Presets for several games say which game each is for. */
	const several = app.config.presets.some((p) => p.sim !== app.config.presets[0].sim);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- preset downloads are resolved by asset(); homeUrl is external -->
<main class="flex min-h-dvh flex-col gap-6 space px-6 py-10">
	<Brand />
	<div class="flex max-w-[560px] flex-col gap-4 p-6 glass notch-card">
		<span class="op-lbl">Desktop only</span>
		<h2 class="font-display text-[44px] leading-[0.9] font-black text-ink-200 uppercase">
			Preflight needs a desktop: <span class="text-trail">keyboard, stick and throttle</span>
		</h2>
		<p class="text-ink-500">
			Open this page on a computer with a window at least 1280 pixels wide and your gear plugged in.
		</p>
		{#if app.config.presets.length}
			<section aria-labelledby="notice-presets" class="flex flex-col gap-2">
				<h3 id="notice-presets" class="op-lbl">Pilot's binds</h3>
				<ul class="flex flex-col gap-[6px]">
					{#each app.config.presets as preset (preset.path + preset.sim)}
						<li>
							<a
								href={presetHref(preset.path, asset)}
								download={preset.file}
								class="flex h-11 items-center justify-between border border-trail/50 px-3 font-mono text-[14px] font-semibold text-trail no-underline notch op-notch-xs"
								>{several ? `${simById(preset.sim).short} · ` : ''}{preset.label}<span
									>Download</span
								></a
							>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
		<a href={app.config.homeUrl} class="font-mono text-[14px] text-course"
			>Back to {app.config.siteName} →</a
		>
	</div>
	<PoweredBy />
</main>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
