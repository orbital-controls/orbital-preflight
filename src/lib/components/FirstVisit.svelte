<script lang="ts">
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { simById } from '#lib/orbital-preflight/sims/index.ts';
	import FilePicker from './FilePicker.svelte';

	/**
	 * The in-place file drop (Main · First visit · file): a game is picked, its file isn't
	 * in yet. Reached from the bay, or from "Add a game" in the manifest.
	 */
	interface Props {
		onwhere: (opener: HTMLElement) => void;
	}

	let { onwhere }: Props = $props();
	const app = useOrbitalPreflight();
	const sim = $derived(simById(app.sim));
</script>

<div
	class="absolute inset-0 flex flex-col items-center justify-center gap-[18px] bg-abyss/55 p-10 text-center"
>
	<h2 class="font-display text-[56px] leading-[0.9] font-black text-ink-200 uppercase">
		Now your <span class="text-trail">{sim.extensions[0]}</span> file.
	</h2>
	<span
		class="flex items-center gap-[10px] border border-trail/50 bg-panel/85 py-[6px] pr-3 pl-[6px] font-mono text-[14px] notch op-notch-xs"
	>
		<span
			aria-hidden="true"
			class="flex size-[30px] items-center justify-center bg-trail font-display text-[14px] font-black text-void"
			>{sim.short}</span
		>
		<span class="font-semibold text-ink-200">{sim.name}</span>
		<button
			type="button"
			onclick={() => app.openBay()}
			class="min-h-9 cursor-pointer border-0 bg-transparent px-1 text-[13px] text-course underline"
			>Pick another game</button
		>
	</span>
	<div
		class="flex w-[560px] flex-col items-center gap-[10px] border-2 border-dashed border-course/55 bg-course-deep/8 p-6 notch-card"
	>
		<span class="font-display text-[28px] leading-none font-extrabold uppercase"
			>Drop your {sim.extensions[0]} file anywhere</span
		>
		<span class="flex items-center gap-[10px]">
			<FilePicker id="first-file" />
			<button
				type="button"
				onclick={(e) => onwhere(e.currentTarget)}
				class="min-h-11 cursor-pointer border-0 bg-transparent font-mono text-[14px] text-course underline"
				>Where's my file?</button
			>
		</span>
	</div>
	{#if sim.defaults}
		<button
			type="button"
			onclick={() => app.loadDefaults()}
			class="min-h-11 cursor-pointer border-0 bg-transparent font-mono text-[14px] text-ink-200 underline"
			>No file handy? Fly with the {sim.name} defaults</button
		>
	{/if}
	{#if app.loadError}
		<p role="alert" class="font-mono text-[13px] text-alert">{app.loadError}</p>
	{/if}
	<span class="font-mono text-[12px] text-ink-900">Read in this tab. Nothing is uploaded.</span>
</div>
