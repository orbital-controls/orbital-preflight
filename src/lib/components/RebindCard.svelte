<script lang="ts">
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { bindLabel } from '#lib/orbital-preflight/labels.ts';
	import type { Action } from '#lib/orbital-preflight/types.ts';

	/** The inline rebind card under a row (StandFly · Rebind · listening / free / taken). */
	interface Props {
		action: Action;
	}

	let { action }: Props = $props();
	const app = useOrbitalPreflight();

	const cap = $derived(app.cap!);
	const slot = $derived(cap.target.slot);
	const now = $derived(app.store.bindings[action.id]?.[slot] ?? null);
	const file = $derived(app.store.original[action.id]?.[slot] ?? null);
	const holder = $derived(app.holderOf(cap.target, cap.cand));
	const other = $derived(holder ? app.actionById(holder.actionId) : null);
	const label = (b: typeof now, long = false) => bindLabel(b, app.roles, long);
	const modeName = $derived({ ship: 'Ship', srv: 'SRV', foot: 'On foot' }[app.mode]);
	const changedFromFile = $derived(label(now) !== label(file));
	const devices = $derived(
		app.mode === 'foot' ? ['Keyboard', 'Mouse'] : ['Keyboard', ...app.hub.pads.map((p) => p.name)]
	);
	const btn = 'cursor-pointer font-mono notch op-notch-xs';
</script>

<!-- Opening inside a scrolling list, the card scrolls itself into view. -->
<div
	{@attach (el) => el.scrollIntoView({ block: 'nearest' })}
	role="group"
	data-op-capture-controls
	aria-label="Rebinding {action.name}"
	class="flex flex-col gap-[10px] border border-trail bg-trail/6 p-3 notch"
>
	<div class="flex items-center justify-between">
		<span class="op-hud text-trail">Rebinding · {slot ? 'Secondary' : 'Primary'}</span>
		<button
			type="button"
			onclick={() => app.cancelCapture()}
			aria-label="Cancel rebinding"
			class="flex size-8 items-center justify-center border border-trail/40 bg-transparent text-trail {btn}"
		>
			<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"
				><path d="M1 1 L9 9 M9 1 L1 9" stroke="currentColor" stroke-width="1.6" /></svg
			>
		</button>
	</div>

	<div class="flex items-center gap-[10px]">
		<span class="flex flex-col gap-[3px]">
			<span class="op-hud text-[10px]">Now</span>
			<span
				class="flex h-10 min-w-[76px] items-center justify-center border border-dashed border-ink-900/50 px-[10px] font-mono text-[14px] font-bold text-ink-900 notch op-notch-xs {cap.cand
					? 'line-through'
					: ''}">{now ? label(now) : 'Empty'}</span
			>
		</span>
		<svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true" class="mt-[14px]"
			><path
				d="M1 6 H19 M14 1 L20 6 L14 11"
				fill="none"
				stroke="var(--color-trail)"
				stroke-width="1.6"
			/></svg
		>
		<span class="flex flex-1 flex-col gap-[3px]">
			<span class="op-hud text-[10px] text-trail">New</span>
			<span
				class="flex h-10 items-center justify-center border px-3 font-mono text-[15px] font-bold notch op-notch-xs {!cap.cand
					? 'pulse border-dashed border-trail text-trail'
					: holder
						? 'border-alert bg-alert/14 text-alert'
						: 'border-trail bg-trail text-void'}">{cap.cand ? label(cap.cand) : 'Press…'}</span
			>
		</span>
	</div>

	{#if app.capNotice}
		<p role="status" class="font-mono text-[12px] text-alert">{app.capNotice}</p>
	{/if}
	{#if !cap.cand}
		<div class="flex flex-col gap-[6px]">
			<span class="text-[14px] text-ink-500"
				>Press the new input on your gear{app.mode === 'foot'
					? ': a key or mouse button.'
					: ': a key, button or hat.'} Pressing again picks something else.</span
			>
			<ul
				class="flex flex-wrap gap-3 font-mono text-[11px] tracking-[.06em] text-ink-900 uppercase"
			>
				{#each devices as name (name)}
					<li class="flex items-center gap-[6px]">
						<span class="size-[7px] pulse rounded-full bg-trail" aria-hidden="true"></span>{name}
					</li>
				{/each}
			</ul>
		</div>
	{:else if !holder}
		<div class="flex flex-col gap-2">
			<span class="text-[14px] text-ink-500"
				><b class="font-mono text-ink-200">{label(cap.cand, true)}</b> is free in {modeName} mode.</span
			>
			<div class="flex gap-[6px]">
				<button
					type="button"
					onclick={() => app.settle('apply')}
					class="h-9 border-0 bg-trail px-[14px] text-[13px] font-bold text-void {btn}"
					>Apply</button
				>
				<button
					type="button"
					onclick={() => app.retryCapture()}
					class="h-9 border border-trail/50 bg-transparent px-3 text-[12px] font-semibold text-trail {btn}"
					>Try another</button
				>
			</div>
		</div>
	{:else}
		<div class="flex flex-col gap-2 border border-alert bg-alert/8 p-[10px] notch op-notch-xs">
			<span class="text-[14px] text-ink-100"
				><b class="font-mono">{label(cap.cand, true)}</b> already does
				<b>{other?.name}{holder.slot ? ' (secondary)' : ''}</b>.</span
			>
			<div class="flex flex-wrap gap-[6px]">
				<button
					type="button"
					onclick={() => app.settle('move')}
					class="h-[34px] border-0 bg-trail px-[10px] text-[12px] font-bold text-void {btn}"
					>Move it here</button
				>
				<button
					type="button"
					onclick={() => app.settle('swap')}
					class="h-[34px] border border-trail bg-transparent px-[10px] text-[12px] font-bold text-trail {btn}"
					>Swap</button
				>
				<button
					type="button"
					onclick={() => app.settle('keep-both')}
					class="h-[34px] border border-alert bg-transparent px-[10px] text-[12px] font-bold text-alert {btn}"
					>Keep both</button
				>
				<button
					type="button"
					onclick={() => app.retryCapture()}
					class="h-[34px] border border-ink-900/40 bg-transparent px-[10px] text-[12px] font-semibold text-ink-500 {btn}"
					>Try another</button
				>
			</div>
			<span class="font-mono text-[11px] text-ink-500"
				>Swap hands {other?.name} your old {now ? label(now) : 'empty slot'}. Keep both leaves a
				clash.</span
			>
		</div>
	{/if}

	<div class="flex flex-wrap gap-[14px] border-t border-trail/18 pt-[2px] font-mono text-[12px]">
		<button
			type="button"
			onclick={() => app.settle('clear')}
			class="min-h-[30px] cursor-pointer border-0 bg-transparent p-0 text-ink-500 underline"
			>Clear this slot</button
		>
		{#if changedFromFile}
			<button
				type="button"
				onclick={() => app.settle('revert')}
				class="min-h-[30px] cursor-pointer border-0 bg-transparent p-0 text-ink-500 underline"
				>Back to file ({file ? label(file) : 'empty'})</button
			>
		{/if}
	</div>
</div>
