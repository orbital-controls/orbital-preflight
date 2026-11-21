<script lang="ts">
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { leaveSummary } from '#lib/orbital-preflight/leave.ts';

	/**
	 * Leave preflight? (Main · Leave). Only opens when some game has unsaved changes, and
	 * counts them across every game loaded this visit.
	 */
	interface Props {
		onstay: () => void;
	}

	let { onstay }: Props = $props();
	const app = useOrbitalPreflight();
	const summary = $derived(leaveSummary(app.gameRows));
	let exporting = $state(false);
	const btn = 'h-[52px] cursor-pointer font-mono text-[16px] font-bold notch';

	async function exportThenLeave() {
		exporting = true;
		const n = await app.exportAll();
		exporting = false;
		if (n) setTimeout(() => app.leaveNow(), 300);
	}
</script>

<div class="flex flex-col gap-4 p-8">
	<span class="font-mono text-[13px] tracking-[.12em] text-alert uppercase"
		>{summary.total ? 'Unsaved changes' : 'Heading out'}</span
	>
	<h2 id="leave-title" class="font-display text-[52px] leading-[0.9] font-black uppercase">
		Leave preflight?
	</h2>
	<p class="text-ink-500">{summary.body}</p>
	<div class="flex flex-col gap-2">
		{#if summary.total}
			<button
				type="button"
				disabled={exporting}
				onclick={exportThenLeave}
				class="{btn} border-0 bg-trail text-void disabled:cursor-wait disabled:opacity-70"
				>{summary.exportLabel}</button
			>
		{/if}
		<button
			type="button"
			onclick={onstay}
			class="{btn} border border-course bg-transparent text-ink-200">Stay in preflight</button
		>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the external homeUrl from config -->
		<a href={app.config.homeUrl} class="self-center p-[10px] font-mono text-[14px] text-ink-900"
			>{summary.total ? 'Leave without saving' : `Back to ${app.config.siteName}`}</a
		>
	</div>
</div>
