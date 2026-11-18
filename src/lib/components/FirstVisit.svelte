<script lang="ts">
	import { usePreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { simById } from '#lib/orbital-preflight/sims/index.ts';
	import FilePicker from './FilePicker.svelte';
	import SimPicker from './SimPicker.svelte';

	/** First visit with no pilot's preset: load in place (StandFly · First visit). */
	interface Props {
		onwhere: (opener: HTMLElement) => void;
	}

	let { onwhere }: Props = $props();
	const app = usePreflight();
	const sim = $derived(simById(app.sim));
</script>

<div
	class="absolute inset-0 flex flex-col items-center justify-center gap-[18px] bg-abyss/55 p-10 text-center"
>
	<span class="op-lbl">Preflight</span>
	<p class="font-display text-[76px] leading-[0.84] font-black text-ink-200 uppercase">
		Bring your binds.<br /><span class="text-trail">Take her out.</span>
	</p>
	<SimPicker name="first-sim" />
	<div
		class="flex w-[560px] flex-col items-center gap-[10px] border-2 border-dashed border-course/55 bg-course-deep/8 p-6 notch-card"
	>
		{#if sim.status === 'ready'}
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
		{:else}
			<span class="font-display text-[28px] leading-none font-extrabold uppercase"
				>{sim.name} {sim.status === 'soon' ? 'is coming soon' : 'comes later'}</span
			>
			<span class="text-[15px] text-ink-500">Elite Dangerous binds work today.</span>
		{/if}
	</div>
	{#if app.loadError}
		<p role="alert" class="font-mono text-[13px] text-alert">{app.loadError}</p>
	{/if}
	<span class="font-mono text-[12px] text-ink-900">Read in this tab. Nothing is uploaded.</span>
</div>
