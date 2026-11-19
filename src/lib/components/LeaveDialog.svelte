<script lang="ts">
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';

	/** Leave preflight? (StandFly · Leave). Only opens when there are unsaved changes. */
	interface Props {
		onstay: () => void;
	}

	let { onstay }: Props = $props();
	const app = useOrbitalPreflight();
	const changes = $derived(app.store.changes);
	const btn = 'h-[52px] cursor-pointer font-mono text-[16px] font-bold notch';
</script>

<div class="flex flex-col gap-4 p-8">
	<span class="font-mono text-[13px] tracking-[.12em] text-alert uppercase"
		>{changes ? 'Unsaved changes' : 'Heading out'}</span
	>
	<h2 id="leave-title" class="font-display text-[52px] leading-[0.9] font-black uppercase">
		Leave preflight?
	</h2>
	<p class="text-ink-500">
		{changes
			? `You’ve changed ${changes} binds across your ship, SRV and on-foot sets and haven’t exported them. Nothing is stored outside this tab, so they go if you leave.`
			: 'Nothing unsaved. Come back any time; your file stays on your machine.'}
	</p>
	<div class="flex flex-col gap-2">
		{#if changes}
			<button
				type="button"
				onclick={() => {
					if (app.exportPreset()) setTimeout(() => app.leaveNow(), 300);
				}}
				class="{btn} border-0 bg-trail text-void">Export, then leave</button
			>
		{/if}
		<button
			type="button"
			onclick={onstay}
			class="{btn} border border-course bg-transparent text-ink-200">Stay in preflight</button
		>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the external homeUrl from config -->
		<a href={app.config.homeUrl} class="self-center p-[10px] font-mono text-[14px] text-ink-900"
			>{changes ? 'Leave without saving' : `Back to ${app.config.siteName}`}</a
		>
	</div>
</div>
