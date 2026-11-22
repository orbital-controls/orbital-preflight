<script lang="ts">
	import { asset } from '$app/paths';
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { presetHref } from '#lib/orbital-preflight/presets.ts';
	import { simById } from '#lib/orbital-preflight/sims/index.ts';
	import FilePicker from './FilePicker.svelte';
	import PoweredBy from './PoweredBy.svelte';

	/**
	 * Load binds (Main · Load drawer): a new file for the current game only, plus the
	 * pilot's presets for it. Other games are switched to from the manifest, not here.
	 */
	interface Props {
		onclose: () => void;
	}

	let { onclose }: Props = $props();
	const app = useOrbitalPreflight();
	const sim = $derived(simById(app.sim));
	const changes = $derived(app.store.changes);
	const current = $derived(app.store.file?.origin);
	const btn = 'cursor-pointer font-mono notch op-notch-xs';
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- preset downloads are resolved by asset() -->
<div class="flex flex-col gap-[18px] px-7 py-6">
	<div class="flex items-center justify-between">
		<h2 id="load-title" class="font-display text-[40px] leading-[0.9] font-black uppercase">
			Load binds
		</h2>
		<button
			type="button"
			onclick={onclose}
			aria-label="Close"
			class="flex size-11 items-center justify-center border border-course/40 bg-transparent text-ink-200 {btn}"
		>
			<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"
				><path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" stroke-width="1.8" /></svg
			>
		</button>
	</div>

	{#if changes > 0}
		<div class="flex flex-col gap-2 border border-alert bg-alert/8 px-[14px] py-3 notch">
			<span class="text-[15px] text-ink-100"
				>Loading a new file replaces your {sim.name} binds, including
				<b>{changes} unsaved {changes === 1 ? 'change' : 'changes'}</b>. Your other games are not
				touched.</span
			>
			<button
				type="button"
				onclick={() => app.exportPreset()}
				class="h-9 self-start border-0 bg-trail px-3 text-[12px] font-bold text-void {btn}"
				>Export them first</button
			>
		</div>
	{/if}

	<p class="text-[15px] text-ink-500">
		A new file for <b class="text-ink-200">{sim.name}</b>. To bind another game, use Switch game in
		the bar.
	</p>

	{#if app.presets.length}
		<section aria-labelledby="presets-title" class="flex flex-col gap-2">
			<h3 id="presets-title" class="op-lbl">Pilot's binds</h3>
			<ul class="flex flex-col gap-[6px]">
				{#each app.presets as preset (preset.index)}
					{@const i = preset.index}
					{@const loaded = current?.kind === 'preset' && current.index === i}
					<li
						class="flex items-center gap-3 border px-3 py-2 notch op-notch-xs {loaded
							? 'border-trail/45 bg-panel/85'
							: 'border-course/25'}"
					>
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="font-mono text-[14px] font-bold">{preset.label}</span>
							<span class="truncate font-mono text-[12px] text-ink-900">{preset.file}</span>
						</span>
						{#if loaded}
							<span class="font-mono text-[12px] font-bold text-trail">Loaded</span>
						{:else}
							<button
								type="button"
								onclick={() => app.loadPreset(i)}
								class="h-9 border border-course/40 bg-transparent px-3 text-[12px] font-semibold text-ink-200 {btn}"
								>Test these</button
							>
						{/if}
						<a
							href={presetHref(preset.path, asset)}
							download={preset.file}
							class="flex h-9 items-center border border-trail/50 px-3 text-[12px] font-semibold text-trail no-underline {btn}"
							>Download<span class="op-sr-only"> {preset.label}</span></a
						>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<div
		class="flex flex-col items-center gap-[10px] border-2 border-dashed border-course/55 bg-course-deep/6 px-5 py-[26px] text-center notch-card"
	>
		<span class="font-display text-[26px] leading-none font-extrabold uppercase"
			>Drop your {sim.extensions[0]} file</span
		>
		<FilePicker id="drawer-file" />
		{#if sim.defaults}
			<button
				type="button"
				onclick={() => app.loadDefaults()}
				class="min-h-10 cursor-pointer border-0 bg-transparent font-mono text-[13px] text-course underline"
				>Use the {sim.name} defaults instead</button
			>
		{/if}
		{#if app.loadError}<p role="alert" class="font-mono text-[13px] text-alert">
				{app.loadError}
			</p>{/if}
	</div>

	<section aria-labelledby="where-title" class="flex flex-col gap-2 px-[18px] py-4 glass notch">
		<h3
			id="where-title"
			class="font-mono text-[12px] font-semibold tracking-[.08em] text-course uppercase"
		>
			Where's my file? · {sim.name}
		</h3>
		{#if sim.help.step}<p class="text-[15px] text-ink-500">{sim.help.step}</p>{/if}
		<code
			class="block border border-course/20 bg-void px-3 py-[10px] font-mono text-[13px] [overflow-wrap:anywhere]"
			>{sim.help.path}</code
		>
		<p class="text-[14px] text-ink-900">{sim.help.tip}</p>
	</section>

	<label class="flex min-h-11 cursor-pointer items-center gap-3 font-mono text-[14px] text-ink-500">
		<input
			type="checkbox"
			checked={app.remember}
			onchange={(e) => app.setRemember(e.currentTarget.checked)}
			class="size-5 accent-course"
		/>Remember this layout on this browser
	</label>
	<p class="-mt-3 font-mono text-[12px] text-ink-900">
		{app.remember
			? `${sim.name} is saved in this browser only. Untick to forget it.`
			: 'Read in this tab. Nothing is uploaded and there’s no account.'}
	</p>
	<PoweredBy />
</div>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
