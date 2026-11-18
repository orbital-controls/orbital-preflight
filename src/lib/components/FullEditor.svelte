<script lang="ts">
	import { usePreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import {
		bindKey,
		inputKey,
		isUnbound,
		sameInput,
		type ShowFilter
	} from '#lib/orbital-preflight/bindings.ts';
	import { deviceDecks, keyboardRows } from '#lib/orbital-preflight/deck.ts';
	import { bindLabel, inputLabel } from '#lib/orbital-preflight/labels.ts';
	import { simById } from '#lib/orbital-preflight/sims/index.ts';
	import type { Action, InputId } from '#lib/orbital-preflight/types.ts';
	import DeckKey from './DeckKey.svelte';
	import { ownersByInput, tap } from './deck.ts';
	import EditorBar from './EditorBar.svelte';
	import ModeTabs from './ModeTabs.svelte';
	import SlotButton from './SlotButton.svelte';
	import { chipClass, type KeyState } from './styles.ts';

	/**
	 * The full-screen bind editor (StandEditor + StandBar): the same store as the fly page,
	 * shown in place of it. The board has no mode tabs; these match the fly page's.
	 */
	interface Props {
		onexit: () => void;
	}

	let { onexit }: Props = $props();
	const app = usePreflight();
	const sim = $derived(simById(app.sim));
	const actions = $derived(app.store.actionsIn(app.mode));
	const clashing = $derived(app.store.clashes[app.mode]);
	const counts = $derived(app.store.counts[app.mode]);
	const owners = $derived(ownersByInput(app));
	const changes = $derived(app.store.changes);
	let heading: HTMLHeadingElement | undefined = $state();

	$effect(() => heading?.focus());

	const categories = $derived(['All', ...new Set(actions.map((a) => a.category))]);
	const label = (b: Parameters<typeof bindLabel>[0], long = false) => bindLabel(b, app.roles, long);

	const rows = $derived.by(() => {
		const q = app.ed.q.trim().toLowerCase();
		return actions.filter((a) => {
			if (app.ed.cat !== 'All' && a.category !== app.ed.cat) return false;
			const b = app.store.bindings[a.id];
			if (app.ed.filter === 'clashes' && !clashing.has(a.id)) return false;
			if (app.ed.filter === 'unbound' && !isUnbound(b)) return false;
			if (app.ed.filter === 'changed' && !app.store.isChanged(a.id)) return false;
			if (
				q &&
				!a.name.toLowerCase().includes(q) &&
				!b?.some((s) => s && label(s, true).toLowerCase().includes(q))
			)
				return false;
			return true;
		});
	});

	function status(a: Action): { text: string; color: string } {
		const binding = app.store.bindings[a.id] ?? [null, null];
		const shared = binding.flatMap((s) =>
			s
				? actions.filter(
						(o) =>
							o.id !== a.id &&
							o.context === a.context &&
							app.store.bindings[o.id]?.some((t) => t && bindKey(t) === bindKey(s))
					)
				: []
		);
		let text = 'Bound';
		let color = 'text-ink-900';
		if (isUnbound(binding)) [text, color] = ['No bind', 'text-ink-500'];
		if (shared.length) [text, color] = [`Clash · ${shared[0].name}`, 'text-alert'];
		if (app.store.isChanged(a.id)) {
			text = shared.length ? `${text} · Changed` : 'Changed';
			color = shared.length ? 'text-alert' : 'text-trail';
		}
		return { text, color };
	}

	const selected = $derived(actions.find((a) => a.id === app.ed.sel) ?? actions[0]);
	const pend = $derived(app.ed.pend);
	const pendOther = $derived(pend ? app.actionById(pend.holder.actionId) : null);

	function pick(action: Action, slot: 0 | 1) {
		app.ed = { ...app.ed, sel: action.id, pend: null };
		app.startCapture({ actionId: action.id, slot });
	}

	function select(action: Action) {
		app.cancelCapture();
		app.ed = { ...app.ed, sel: action.id, pend: null };
	}

	const FILTERS: { id: ShowFilter; name: string; color: string }[] = [
		{ id: 'all', name: 'All', color: 'text-ink-900' },
		{ id: 'clashes', name: 'Clashes', color: 'text-alert' },
		{ id: 'unbound', name: 'Unbound', color: 'text-ink-500' },
		{ id: 'changed', name: 'Changed', color: 'text-trail' }
	];

	const kb = keyboardRows(true);
	const decks = $derived(app.mode === 'foot' ? [] : deviceDecks(app.roles, app.store.bindings));

	function keyState(input: InputId): KeyState {
		const o = owners.get(inputKey(input));
		const mine =
			selected && app.store.bindings[selected.id]?.some((s) => s && sameInput(s.input, input));
		let state: KeyState = o?.clash ? 'clash' : o ? 'bound' : 'spare';
		if (mine) state = 'lit';
		if (app.cap) state = 'listening';
		return state;
	}

	const btn = 'cursor-pointer font-mono notch op-notch-xs';
</script>

{#snippet mapKey(input: InputId, width?: number)}
	{@const names = owners.get(inputKey(input))?.names}
	<DeckKey
		compact
		label={inputLabel(input, app.roles).replace(/^\S+ (?=H|TRG|B\d)/, '')}
		aria="{inputLabel(input, app.roles, true)}: {names?.length ? names.join(', ') : 'spare'}"
		state={keyState(input)}
		{width}
		onpress={() => tap(app, input)}
	/>
{/snippet}

<div class="min-h-dvh bg-void">
	<EditorBar {onexit} />
	<main>
		<section class="op-wrap flex items-end justify-between gap-6 pt-5 pb-4">
			<div class="flex flex-col gap-[6px]">
				<button
					type="button"
					onclick={onexit}
					class="cursor-pointer self-start border-0 bg-transparent p-0 font-mono text-[13px] text-course underline"
					>← Back to flight</button
				>
				<div class="flex items-center gap-4">
					<h2
						bind:this={heading}
						tabindex="-1"
						class="font-display text-[52px] leading-[0.9] font-black uppercase outline-none"
					>
						Bind <span class="text-trail">editor</span>
					</h2>
					<span
						class="flex items-center gap-[10px] border border-trail/45 bg-panel/85 py-[6px] pr-3 pl-[6px] notch op-notch-xs"
					>
						<span
							class="flex size-[34px] items-center justify-center bg-trail font-display text-[16px] font-black text-void notch op-notch-xs"
							>{sim.short}</span
						>
						<span class="flex flex-col leading-[1.05]"
							><span
								class="font-mono text-[10px] font-semibold tracking-[.14em] text-course uppercase"
								>Binding for</span
							><span class="font-display text-[20px] font-black uppercase">{sim.name}</span></span
						>
					</span>
				</div>
			</div>
			<div class="flex items-center gap-[10px]">
				<span class="font-mono text-[14px] text-ink-500"
					><span class="font-bold text-trail">{changes}</span> unsaved {changes === 1
						? 'change'
						: 'changes'}</span
				>
				<button
					type="button"
					onclick={() => {
						app.cancelCapture();
						app.store.resetMode(app.mode);
					}}
					class="h-12 border border-ink-900/40 bg-transparent px-4 text-[14px] font-semibold text-ink-500 {btn} [--notch:12px]"
					>Reset all</button
				>
				<button
					type="button"
					onclick={() => app.exportPreset()}
					class="h-12 border bg-transparent px-4 text-[14px] font-bold {btn} [--notch:12px] {changes
						? 'border-trail text-trail'
						: 'border-ink-900/35 text-ink-900'}">Export new preset</button
				>
				<button
					type="button"
					onclick={onexit}
					class="h-12 border-0 bg-trail px-5 text-[14px] font-bold text-void {btn} [--notch:12px]"
					>Done · fly with these</button
				>
			</div>
		</section>

		<section class="op-wrap flex flex-wrap items-center gap-[14px] pb-[14px]">
			<ModeTabs compact />
			<label for="editor-q" class="op-sr-only">Find an action or an input</label>
			<input
				id="editor-q"
				type="search"
				placeholder="Find an action or an input, like “B6”"
				bind:value={app.ed.q}
				class="h-11 w-[320px] border border-course/30 bg-panel/85 px-[14px] text-[15px] text-ink-200"
			/>
			<div role="group" aria-label="Category" class="flex flex-wrap gap-1">
				{#each categories as c (c)}
					<button
						type="button"
						aria-pressed={app.ed.cat === c}
						onclick={() => (app.ed.cat = c)}
						class="h-11 border px-[14px] text-[13px] font-semibold {btn} {chipClass(
							app.ed.cat === c
						)}"
						>{c}
						<span class="opacity-70"
							>{c === 'All' ? actions.length : actions.filter((a) => a.category === c).length}</span
						></button
					>
				{/each}
			</div>
			<span aria-hidden="true" class="h-7 w-px bg-course/25"></span>
			<div role="group" aria-label="Show" class="flex gap-1">
				{#each FILTERS as f (f.id)}
					{@const on = app.ed.filter === f.id}
					<button
						type="button"
						aria-pressed={on}
						onclick={() => (app.ed.filter = f.id)}
						class="h-11 border px-[14px] text-[13px] font-semibold {btn} {chipClass(on)}"
						>{f.name}
						{#if f.id !== 'all'}<span class={on ? 'text-void' : f.color}>{counts[f.id]}</span
							>{/if}</button
					>
				{/each}
			</div>
		</section>

		<section class="op-wrap grid grid-cols-[minmax(0,1fr)_440px] items-start gap-5 pb-10">
			<div class="flex h-[860px] flex-col glass notch-card">
				<div class="flex-1 op-scroll overflow-y-auto">
					<table class="w-full border-collapse">
						<caption class="op-sr-only"
							>{app.mode === 'ship' ? 'Ship' : app.mode === 'srv' ? 'SRV' : 'On foot'} binds</caption
						>
						<thead class="sticky top-0 z-[1] bg-panel">
							<tr class="op-hud">
								<th scope="col" class="px-[18px] py-[14px] text-left font-medium">Action</th>
								<th scope="col" class="w-[130px] px-2 py-[14px] text-left font-medium">Primary</th>
								<th scope="col" class="w-[130px] px-2 py-[14px] text-left font-medium">Secondary</th
								>
								<th scope="col" class="w-[210px] py-[14px] pr-[18px] pl-2 text-left font-medium"
									>Status</th
								>
							</tr>
						</thead>
						<tbody>
							{#each rows as a (a.id)}
								{@const on = selected?.id === a.id}
								{@const st = status(a)}
								<tr class="border-t border-course/10 {on ? 'bg-course/14' : ''}">
									<td class="px-[18px] py-[6px]">
										<button
											type="button"
											aria-pressed={on}
											onclick={() => select(a)}
											class="flex min-h-10 w-full cursor-pointer flex-col justify-center border-0 bg-transparent p-0 text-left text-ink-200"
										>
											<span class="text-[16px] leading-[1.2]">{a.name}</span>
											<span class="font-mono text-[11px] tracking-[.08em] text-ink-900 uppercase"
												>{a.category}</span
											>
										</button>
									</td>
									<td class="px-2 py-[6px]"
										><SlotButton action={a} slot={0} size="table" onpick={() => pick(a, 0)} /></td
									>
									<td class="px-2 py-[6px]">
										{#if !a.axis}<SlotButton
												action={a}
												slot={1}
												size="table"
												onpick={() => pick(a, 1)}
											/>{/if}
									</td>
									<td class="py-[6px] pr-[18px] pl-2 font-mono text-[12px] {st.color}">{st.text}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
					{#if !rows.length}
						<p class="p-10 text-center text-ink-900">
							Nothing matches. Try another filter or clear the search.
						</p>
					{/if}
				</div>
				<div class="flex justify-between border-t border-course/14 px-[18px] py-3 op-hud">
					<span>{rows.length} of {actions.length} actions</span><span
						>Click a bind to change it · click a name to inspect it</span
					>
				</div>
			</div>

			<aside
				aria-labelledby="inspector-title"
				class="flex h-[860px] flex-col gap-[14px] p-5 glass notch-card"
			>
				{#if selected}
					<div class="flex flex-col gap-1">
						<span class="op-hud">{selected.category}</span>
						<h3
							id="inspector-title"
							class="font-display text-[40px] leading-[0.92] font-black uppercase"
						>
							{selected.name}
						</h3>
					</div>
					<div class="grid grid-cols-2 gap-[10px]">
						<SlotButton action={selected} slot={0} size="big" onpick={() => pick(selected, 0)} />
						{#if !selected.axis}
							<SlotButton action={selected} slot={1} size="big" onpick={() => pick(selected, 1)} />
						{/if}
					</div>

					{#if app.cap}
						<div
							class="flex items-center justify-between gap-3 border border-trail bg-trail/8 px-[14px] py-3 notch"
						>
							<span class="flex flex-col"
								><span class="pulse font-mono text-[13px] font-bold tracking-[.1em] text-trail"
									>● LISTENING · {app.cap.target.slot ? 'SECONDARY' : 'PRIMARY'}</span
								><span class="text-[14px] text-ink-500"
									>Press it on your gear, or click it below.</span
								></span
							>
							<button
								type="button"
								onclick={() => app.cancelCapture()}
								class="h-9 border border-ink-900/45 bg-transparent px-3 text-[12px] font-semibold text-ink-200 {btn}"
								>Cancel</button
							>
						</div>
					{/if}

					{#if pend}
						<div
							class="flex flex-col gap-[10px] border border-alert bg-alert/8 px-[14px] py-3 notch"
						>
							<span class="text-[15px] text-ink-100"
								><b class="font-mono">{label(pend.cand, true)}</b> is already {pendOther?.name}
								{pend.holder.slot ? '(secondary)' : '(primary)'}.</span
							>
							<div class="flex flex-wrap gap-[6px]">
								<button
									type="button"
									onclick={() => app.settlePending('move')}
									class="h-9 border-0 bg-trail px-3 text-[12px] font-bold text-void {btn}"
									>Move it here</button
								>
								<button
									type="button"
									onclick={() => app.settlePending('swap')}
									class="h-9 border border-trail bg-transparent px-3 text-[12px] font-bold text-trail {btn}"
									>Swap them</button
								>
								<button
									type="button"
									onclick={() => app.settlePending('keep-both')}
									class="h-9 border border-alert bg-transparent px-3 text-[12px] font-bold text-alert {btn}"
									>Keep both</button
								>
								<button
									type="button"
									onclick={() => (app.ed = { ...app.ed, pend: null })}
									class="h-9 border border-ink-900/45 bg-transparent px-3 text-[12px] font-semibold text-ink-500 {btn}"
									>Cancel</button
								>
							</div>
						</div>
					{/if}

					<div class="flex flex-wrap gap-[6px]">
						{#if !selected.axis}
							<button
								type="button"
								onclick={() => {
									const b = app.store.bindings[selected.id] ?? [null, null];
									app.store.set(selected.id, [b[1], b[0]]);
								}}
								class="h-9 border border-course/40 bg-transparent px-3 text-[12px] font-semibold text-ink-200 {btn}"
								>Swap primary ⇄ secondary</button
							>
						{/if}
						<button
							type="button"
							onclick={() => app.store.set(selected.id, [null, null])}
							class="h-9 border border-course/40 bg-transparent px-3 text-[12px] font-semibold text-ink-200 {btn}"
							>Clear both</button
						>
						{#if app.store.isChanged(selected.id)}
							<button
								type="button"
								onclick={() => app.store.revert(selected.id)}
								class="h-9 border border-trail bg-transparent px-3 text-[12px] font-semibold text-trail {btn}"
								>Back to file</button
							>
						{/if}
					</div>

					<div class="flex flex-col gap-3 border-t border-course/16 pt-[14px]">
						<div class="flex items-baseline justify-between">
							<h4 class="op-lbl">Where it lives</h4>
							<span class="op-hud tracking-[.02em] normal-case">Gold = this action</span>
						</div>
						<div class="flex flex-col gap-1">
							<span class="op-hud">Keyboard</span>
							{#each kb as row, i (i)}
								<div class="flex gap-1" style:padding-left="{row.indent}px">
									{#each row.keys as k (inputKey(k.input))}{@render mapKey(k.input, k.width)}{/each}
								</div>
							{/each}
						</div>
						<div class="flex flex-wrap gap-[22px]">
							{#each decks as deck (deck.role.id)}
								<div class="flex flex-col gap-1">
									<span class="op-hud">{deck.role.long}</span>
									<div class="grid grid-cols-[repeat(4,36px)] gap-1">
										{#each deck.inputs.slice(0, 12) as input (inputKey(input))}{@render mapKey(
												input
											)}{/each}
									</div>
								</div>
							{/each}
						</div>
						<p class="text-[13px] text-ink-900">
							Not listening? Click any key or button to jump to the action it fires.
						</p>
					</div>
				{/if}
			</aside>
		</section>
	</main>
</div>
