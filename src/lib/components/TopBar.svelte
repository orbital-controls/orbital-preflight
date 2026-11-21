<script lang="ts">
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { simById } from '#lib/orbital-preflight/sims/index.ts';
	import { InputHub } from '#lib/orbital-preflight/inputs/hub.svelte.ts';
	import Brand from './Brand.svelte';
	import GameManifest from './GameManifest.svelte';

	/** The stand bar: the only chrome on the page (StandFly). */
	interface Props {
		onopenload: (opener: HTMLElement) => void;
		onopendevices: (opener: HTMLElement) => void;
		onopeneditor: () => void;
		onleave: (opener: HTMLElement) => void;
	}

	let { onopenload, onopendevices, onopeneditor, onleave }: Props = $props();
	const app = useOrbitalPreflight();

	const sim = $derived(simById(app.sim));
	const changes = $derived(app.store.changes);
	const connected = $derived(app.hub.pads.length);
	/**
	 * The unpaired state: this game's file names a device no connected controller is paired
	 * with, and a connected controller is free to pair with it (as after switching to a game
	 * whose devices haven't been paired yet). The drawer is never opened for the pilot.
	 */
	const toPair = $derived.by(() => {
		const devices = app.store.file?.parsed.devices ?? [];
		const free = app.hub.pads.filter((p) => InputHub.unpaired(p)).length;
		const waiting = devices.filter((d) => !app.hub.pads.some((p) => p.deviceId === d.id)).length;
		return Math.min(free, waiting);
	});
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- Leave goes to the external homeUrl -->
<header class="border-b border-course/20 bg-abyss">
	<div class="op-wrap flex h-16 items-center gap-[10px] whitespace-nowrap">
		<span class="mr-2 flex-none"><Brand /></span>

		<GameManifest context="fly" onloadfile={onopenload} />

		<button
			type="button"
			onclick={(e) => onopendevices(e.currentTarget)}
			aria-expanded={app.drawer === 'devices'}
			class="flex h-10 flex-none cursor-pointer items-center gap-[10px] border border-course/40 bg-transparent px-[14px] font-mono text-[13px] font-semibold text-ink-200 notch op-notch-xs"
		>
			<span class="flex gap-1" aria-hidden="true">
				{#each connected ? app.hub.pads : [null] as pad, i (i)}
					<span
						class="size-2 rounded-full {pad && !(toPair && InputHub.unpaired(pad))
							? 'bg-trail'
							: 'bg-ink-950/50'}"
					></span>
				{/each}
			</span>
			<span>{connected ? connected : 'No'} controller{connected === 1 ? '' : 's'} connected</span>
			{#if toPair}<span class="text-course">· {toPair} to pair</span>{/if}
		</button>

		<!-- Per game: the count and the export cover every mode of the current one. -->
		<span class="ml-auto flex-none font-mono text-[13px] text-ink-500">
			{#if app.chosen}<span class="font-bold text-trail">{changes}</span>
				unsaved in {sim.short}{/if}
		</span>
		{#if app.chosen}
			<button
				type="button"
				disabled={!app.loaded}
				onclick={() => app.exportPreset()}
				class="flex h-10 flex-none cursor-pointer items-center border px-[14px] font-mono text-[13px] font-semibold notch op-notch-xs disabled:cursor-not-allowed {changes
					? 'border-trail text-trail'
					: 'border-ink-900/35 text-ink-900'}">Export {sim.short} preset</button
			>
		{/if}
		<button
			type="button"
			disabled={!app.loaded}
			onclick={onopeneditor}
			class="flex h-10 flex-none cursor-pointer items-center gap-[10px] border border-course/40 px-[14px] font-mono text-[13px] font-semibold text-ink-200 notch op-notch-xs disabled:cursor-not-allowed disabled:opacity-60"
		>
			<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"
				><path
					d="M1 4 V1 H4 M8 1 H11 V4 M11 8 V11 H8 M4 11 H1 V8"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
				/></svg
			>Full editor
		</button>
		<a
			href={app.config.homeUrl}
			onclick={(e) => {
				if (!app.games.totalChanges) return;
				e.preventDefault();
				onleave(e.currentTarget);
			}}
			class="flex h-10 flex-none items-center gap-[10px] px-[10px] font-mono text-[13px] font-semibold text-ink-900 no-underline notch op-notch-xs hover:text-course"
		>
			<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"
				><path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" stroke-width="1.6" /></svg
			>Leave
		</a>
	</div>
</header>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
