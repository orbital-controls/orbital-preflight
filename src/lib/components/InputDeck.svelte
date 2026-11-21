<script lang="ts">
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { inputKey, sameInput } from '#lib/orbital-preflight/bindings.ts';
	import { controllerDecks, keyboardRows, MOUSE_DECK } from '#lib/orbital-preflight/deck.ts';
	import { deckLabel, inputLabel } from '#lib/orbital-preflight/labels.ts';
	import type { InputId } from '#lib/orbital-preflight/types.ts';
	import DeckKey from './DeckKey.svelte';
	import { ownersByInput, tap } from './deck.ts';
	import type { KeyState } from './styles.ts';

	/**
	 * The input deck under the viewport. It mirrors real input (a key lights gold while
	 * you press it) and is clickable for testing without the hardware.
	 */
	const app = useOrbitalPreflight();
	const owners = $derived(ownersByInput(app));
	const rows = keyboardRows();
	const decks = $derived(controllerDecks(app.hub.pads, app.roles, app.store.bindings));
	const foot = $derived(app.mode === 'foot');

	function state(input: InputId): KeyState {
		if (!app.loaded) return 'off';
		if (app.cap?.cand && sameInput(app.cap.cand.input, input)) return 'lit';
		if (app.cap) return 'listening';
		if (app.hub.isHeld(input) || (app.last && sameInput(app.last, input))) return 'lit';
		const o = owners.get(inputKey(input));
		return o?.clash ? 'clash' : o ? 'bound' : 'spare';
	}

	/** The deck's own short label: "B5", "H↑", "TRG", without the device prefix. */
	function short(input: InputId): string {
		return deckLabel(input, app.roles);
	}

	function aria(input: InputId, device?: string): string {
		const names = owners.get(inputKey(input))?.names;
		const name = device ? `${device} ${short(input)}` : inputLabel(input, app.roles, true);
		return `${name}: ${names?.length ? names.join(', ') : 'spare'}`;
	}
</script>

{#snippet key(input: InputId, width?: number, device?: string)}
	<DeckKey
		label={short(input)}
		aria={aria(input, device)}
		state={state(input)}
		{width}
		onpress={() => tap(app, input)}
	/>
{/snippet}

<section aria-label="Input deck" class="op-wrap pt-5 pb-10">
	<div class="flex flex-wrap items-start gap-x-9 gap-y-5 px-5 py-4 glass notch-card">
		<div class="flex flex-col gap-2">
			<h2 class="op-lbl">Keyboard</h2>
			<div class="flex flex-col gap-[6px]">
				{#each rows as row, i (i)}
					<div class="flex gap-[6px]" style:padding-left="{row.indent}px">
						{#each row.keys as k (inputKey(k.input))}{@render key(k.input, k.width)}{/each}
					</div>
				{/each}
			</div>
		</div>

		{#if !foot}
			{#each decks as deck (deck.key)}
				<div class="flex max-w-[260px] flex-col gap-2">
					<h2 class="truncate op-lbl" title={deck.name}>{deck.name}</h2>
					{#if !deck.deviceId && app.loaded}
						<p class="font-mono text-[11px] text-ink-900">Not paired yet: open Controllers</p>
					{/if}
					<div class="grid grid-cols-[repeat(4,44px)] gap-[6px]">
						{#each deck.inputs as input (inputKey(input))}{@render key(
								input,
								undefined,
								deck.name
							)}{/each}
					</div>
				</div>
			{:else}
				<div class="flex max-w-[220px] flex-col gap-2">
					<h2 class="op-lbl">Controllers</h2>
					<p class="text-[14px] text-ink-900">
						Press a button on your stick or throttle and it shows up here.
					</p>
				</div>
			{/each}
		{:else}
			<div class="flex flex-col gap-2">
				<h2 class="op-lbl">Mouse</h2>
				<div class="grid grid-cols-[repeat(4,56px)] gap-[6px]">
					{#each MOUSE_DECK as input (inputKey(input))}{@render key(input, 56)}{/each}
				</div>
				<span class="op-hud tracking-[.02em] normal-case">Mouse look turns the camera</span>
			</div>
		{/if}

		<div class="ml-auto flex max-w-[250px] flex-col gap-2 text-[14px] text-ink-500">
			<h2 class="op-lbl">No gear plugged in?</h2>
			<p>
				{foot
					? 'Your keyboard and mouse light this up as you press them. Click the deck to stand in for them.'
					: 'Your keyboard, stick and throttle light this up as you press them. Click the deck to stand in for them.'}
			</p>
			<ul class="flex flex-wrap gap-x-3 gap-y-[6px] font-mono text-[12px]">
				<li>
					<span class="inline-block size-[10px] border border-course bg-course-deep/20"></span> Bound
				</li>
				<li><span class="inline-block size-[10px] border border-alert"></span> Clash</li>
				<li><span class="inline-block size-[10px] border border-ink-900/40"></span> Spare</li>
			</ul>
		</div>
	</div>
</section>
