<script lang="ts">
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { findHolders } from '#lib/orbital-preflight/bindings.ts';
	import { bindLabel } from '#lib/orbital-preflight/labels.ts';
	import type { Action, SlotIndex } from '#lib/orbital-preflight/types.ts';
	import { SLOT_CLASS, type SlotState } from './styles.ts';

	/** One primary or secondary slot. Clicking it starts listening for a new input. */
	interface Props {
		action: Action;
		slot: SlotIndex;
		/** `row` in the binds panel and editor table; `big` in the editor's inspector. */
		size?: 'row' | 'table' | 'big';
		onpick: () => void;
	}

	let { action, slot, size = 'row', onpick }: Props = $props();
	const app = useOrbitalPreflight();

	const bind = $derived(app.store.bindings[action.id]?.[slot] ?? null);
	const listening = $derived(
		app.cap?.target.actionId === action.id && app.cap.target.slot === slot ? app.cap : null
	);
	const pending = $derived(
		app.editor && app.ed.pend?.target.actionId === action.id && app.ed.pend.target.slot === slot
			? app.ed.pend
			: null
	);
	const clash = $derived(
		bind
			? findHolders(app.store.actions, app.store.bindings, action.mode, bind, {
					actionId: action.id,
					slot
				}).length > 0
			: false
	);

	const state = $derived<SlotState>(
		listening
			? listening.cand
				? 'picked'
				: 'listening'
			: pending
				? 'listening'
				: !bind
					? 'empty'
					: clash
						? 'clash'
						: 'bound'
	);
	const shown = $derived(pending ? pending.cand : (listening?.cand ?? bind));
	const text = $derived(
		listening && !listening.cand ? 'Press…' : bindLabel(shown, app.roles, size === 'big')
	);
	const name = $derived(slot ? 'Secondary' : 'Primary');
</script>

<button
	type="button"
	onclick={onpick}
	aria-label="Change {name.toLowerCase()} bind for {action.name}, now {bind
		? bindLabel(bind, app.roles, true)
		: 'empty'}"
	class="cursor-pointer border font-mono font-bold whitespace-nowrap {SLOT_CLASS[state]} {size ===
	'big'
		? 'flex h-[76px] flex-col justify-center gap-[2px] px-[14px] text-left notch'
		: size === 'table'
			? 'h-[38px] w-[118px] truncate px-[6px] text-[13px] notch op-notch-xs'
			: 'h-9 w-full truncate px-[6px] text-[12px] notch op-notch-xs'}"
>
	{#if size === 'big'}
		<span class="text-[11px] font-normal tracking-[.1em] uppercase opacity-80">{name}</span>
		<span class="text-[20px]"
			>{listening && !listening.cand ? 'Press…' : shown ? text : 'Empty'}</span
		>
	{:else}
		{text}
	{/if}
</button>
