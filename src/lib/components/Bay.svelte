<script lang="ts">
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';

	/**
	 * Bay select (Main · First visit, from GameB): with no game chosen, the area under the
	 * bar is one tile per sim. A ready one goes to its file drop (or loads the pilot's
	 * preset for it); one coming later is listed, not offered. The only thing focusable
	 * below the bar.
	 */
	const app = useOrbitalPreflight();
</script>

<section
	aria-labelledby="bay-title"
	data-op-bay
	class="flex min-h-[calc(1080px-64px)] flex-col items-center bg-abyss/95 pt-16"
>
	<div class="flex w-[1280px] flex-col gap-7 px-10">
		<div class="flex flex-col gap-2">
			<span class="op-lbl">Preflight</span>
			<h2
				id="bay-title"
				class="font-display text-[76px] leading-[0.84] font-black text-ink-200 uppercase"
			>
				Bring your binds.<br /><span class="text-trail">Take her out.</span>
			</h2>
			<p class="text-[17px] text-ink-500">
				Pick the sim your binds are for. You can add more games once you're in.
			</p>
		</div>

		<ul class="grid grid-cols-4 gap-5">
			{#each app.gameRows as row (row.sim.id)}
				{@const ready = row.sim.status === 'ready'}
				{#snippet card()}
					<span
						class="relative flex h-[190px] items-center justify-center border-b bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--color-course)_6%,transparent)_0_10px,transparent_10px_20px)] {ready
							? 'border-course/35'
							: 'border-ink-950/35'}"
					>
						<span
							aria-hidden="true"
							class="font-display text-[116px] leading-none font-black {ready
								? 'text-ink-200'
								: 'text-ink-950/60'}">{row.sim.short}</span
						>
					</span>
					<span class="flex min-h-[150px] flex-col gap-[10px] px-[18px] pt-4 pb-[18px]">
						<span class="font-display text-[30px] leading-[0.95] font-black uppercase"
							>{row.sim.name}</span
						>
						<span class="font-mono text-[12px] text-ink-900">{row.file}</span>
						{#if row.modeList}
							<span class="font-mono text-[12px] text-ink-500">{row.modeList}</span>
						{/if}
						<span class="mt-auto flex items-center justify-between font-mono text-[13px] font-bold">
							<span
								class={!ready
									? 'text-ink-950'
									: row.changes
										? 'text-trail'
										: row.loaded
											? 'text-ink-500'
											: 'text-ink-900'}>{row.status}</span
							>
							{#if ready}<span class="text-course">Bind {row.sim.short}</span>{/if}
						</span>
					</span>
				{/snippet}
				<li class="flex">
					{#if ready}
						<button
							type="button"
							onclick={() => app.pickInBay(row.sim.id)}
							class="flex w-full cursor-pointer flex-col overflow-hidden border border-course/35 bg-panel/85 p-0 text-left text-ink-200 hover:border-course"
							>{@render card()}</button
						>
					{:else}
						<div
							class="flex w-full flex-col overflow-hidden border border-ink-950/35 bg-panel/85 text-ink-950"
						>
							{@render card()}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
		{#if app.loadError}
			<p role="alert" class="font-mono text-[13px] text-alert">{app.loadError}</p>
		{/if}
		<p class="font-mono text-[13px] text-ink-900">
			Files are read in this tab and never uploaded. There's no account.
		</p>
	</div>
</section>
