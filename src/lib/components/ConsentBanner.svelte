<script lang="ts">
	import type { ConsentState } from '#lib/orbital-preflight/consent.svelte.ts';

	/**
	 * Asks once whether Google Analytics may run. Only shown when the build carries a
	 * Google tag and the visitor hasn't answered on this browser.
	 */
	interface Props {
		consent: ConsentState;
	}

	let { consent }: Props = $props();
	const btn = 'h-[38px] cursor-pointer px-4 font-mono text-[14px] font-bold notch op-notch-xs';
</script>

<div
	class="fixed inset-x-0 bottom-0 z-50 border-t border-course/25 bg-abyss/95 backdrop-blur-sm"
	role="region"
	aria-label="Analytics consent"
>
	<div class="mx-auto flex max-w-[1264px] items-center justify-between gap-6 px-6 py-4">
		<p class="font-mono text-[12px] leading-[1.6] tracking-[.04em] text-ink-500">
			<span class="text-trail uppercase">Telemetry ·</span> This page can record visits and which
			features are used, through Google Analytics. Nothing is recorded until you allow it, and your
			binds files never leave your browser. {#if consent.cookieless}A count of visits is kept either
				way, with no cookie and nothing that identifies you.
			{/if}
		</p>
		<div class="flex shrink-0 gap-[10px]">
			<button
				type="button"
				class="{btn} border border-course bg-transparent text-ink-200"
				onclick={() => consent.answer('denied')}>Decline</button
			>
			<button
				type="button"
				class="{btn} border-0 bg-trail text-void"
				onclick={() => consent.answer('granted')}>Allow</button
			>
		</div>
	</div>
</div>
