<script lang="ts">
	import { usePreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { isUnbound, matchesFilter, type ShowFilter } from '#lib/orbital-preflight/bindings.ts';
	import { simById } from '#lib/orbital-preflight/sims/index.ts';
	import RebindCard from './RebindCard.svelte';
	import SlotButton from './SlotButton.svelte';
	import { chipClass } from './styles.ts';

	/** The binds panel beside the viewport (StandFly). */
	const app = usePreflight();
	const sim = $derived(simById(app.sim));
	const actions = $derived(app.store.actionsIn(app.mode));
	const clashing = $derived(app.store.clashes[app.mode]);
	const counts = $derived(app.store.counts[app.mode]);
	const modeName = $derived({ ship: 'Ship', srv: 'SRV', foot: 'On foot' }[app.mode]);

	const categories = $derived([
		'All',
		...[...new Set(actions.map((a) => a.category))].sort((a, b) => order(a) - order(b))
	]);
	function order(category: string) {
		const i = [
			'Flight',
			'Driving',
			'Moving',
			'Navigation',
			'Turret',
			'Combat',
			'Systems',
			'Tools',
			'Panels'
		].indexOf(category);
		return i === -1 ? 99 : i;
	}

	const rows = $derived.by(() => {
		const q = app.q.trim().toLowerCase();
		return actions.filter(
			(a) =>
				(app.cat === 'All' || a.category === app.cat) &&
				matchesFilter(app.filter, a, app.store.bindings, app.store.original, clashing) &&
				(!q || a.name.toLowerCase().includes(q))
		);
	});

	const FILTERS: { id: ShowFilter; name: string; color: string }[] = [
		{ id: 'all', name: 'All', color: 'text-ink-900' },
		{ id: 'unbound', name: 'Unbound', color: 'text-ink-500' },
		{ id: 'clashes', name: 'Clashes', color: 'text-alert' },
		{ id: 'changed', name: 'Changed', color: 'text-trail' }
	];

	const empty = $derived(
		{
			all: ['Nothing matches', 'Try a different search.'],
			unbound: [
				'Everything is bound',
				`Every ${modeName} action in this category has at least one input.`
			],
			clashes: ['No clashes', `No input does two jobs in ${modeName} mode.`],
			changed: ['No changes yet', 'Click any bind to change it.']
		}[app.filter]
	);
	const chip =
		'h-8 cursor-pointer border px-[10px] font-mono text-[12px] font-semibold notch op-notch-xs';
</script>

<aside
	aria-labelledby="binds-heading"
	class="flex h-[560px] flex-col gap-[10px] p-4 glass notch-card"
>
	<div class="flex items-center justify-between">
		<span class="flex items-center gap-[10px]">
			<h2 id="binds-heading" class="font-display text-[26px] leading-none font-extrabold uppercase">
				Binds
			</h2>
			{#if app.loaded}
				<span
					class="border border-trail/50 bg-trail/14 px-2 py-1 font-mono text-[11px] font-bold tracking-[.08em] text-trail uppercase notch op-notch-xs"
					>{sim.name}</span
				>
			{/if}
		</span>
		{#if app.loaded}
			<button
				type="button"
				onclick={() => {
					app.cancelCapture();
					app.store.resetMode(app.mode);
				}}
				class="min-h-8 cursor-pointer border-0 bg-transparent font-mono text-[13px] text-course underline"
				>Reset all</button
			>
		{/if}
	</div>

	{#if app.loaded}
		<label for="binds-q" class="op-sr-only">Find an action</label>
		<input
			id="binds-q"
			type="search"
			placeholder="Find an action"
			bind:value={app.q}
			class="h-10 w-full border border-course/30 bg-void px-3 text-[15px] text-ink-200"
		/>
		<div role="group" aria-label="Category" class="flex flex-wrap gap-1">
			{#each categories as category (category)}
				<button
					type="button"
					aria-pressed={app.cat === category}
					onclick={() => (app.cat = category)}
					class="{chip} tracking-[.04em] {chipClass(app.cat === category)}">{category}</button
				>
			{/each}
		</div>
		<div class="flex items-center gap-2">
			<span class="op-hud" id="show-label">Show</span>
			<div role="group" aria-labelledby="show-label" class="flex flex-wrap gap-1">
				{#each FILTERS as f (f.id)}
					{@const on = app.filter === f.id}
					<button
						type="button"
						aria-pressed={on}
						onclick={() => (app.filter = f.id)}
						class="flex items-center gap-[6px] {chip} {chipClass(on)} {f.id === 'unbound' && !on
							? 'border-dashed'
							: ''}"
					>
						{f.name}
						{#if f.id !== 'all'}
							<span class="font-bold {on ? 'text-void' : f.color}">{counts[f.id]}</span>
						{/if}
					</button>
				{/each}
			</div>
		</div>
		<div class="grid grid-cols-[minmax(0,1fr)_88px_88px] gap-[6px] px-1 op-hud" aria-hidden="true">
			<span>Action</span><span>Primary</span><span>Secondary</span>
		</div>
	{/if}

	<div class="flex flex-1 op-scroll flex-col gap-[2px] overflow-y-auto pr-1">
		{#if !app.loaded}
			<div class="m-auto flex flex-col gap-[6px] p-5 text-center text-ink-900">
				<span class="font-display text-[24px] font-extrabold text-ink-500 uppercase"
					>No binds loaded</span
				>
				<span>Load a file and every action shows up here, ready to change.</span>
			</div>
		{:else if !rows.length}
			<div class="m-auto flex flex-col gap-[6px] p-5 text-center">
				<span class="font-display text-[24px] font-extrabold text-ink-500 uppercase"
					>{empty[0]}</span
				>
				<span class="text-ink-900">{empty[1]}</span>
				<button
					type="button"
					onclick={() => {
						app.filter = 'all';
						app.cat = 'All';
						app.q = '';
					}}
					class="min-h-9 cursor-pointer self-center border-0 bg-transparent font-mono text-[13px] text-course underline"
					>Show everything</button
				>
			</div>
		{:else}
			<ul class="flex flex-col gap-[2px]">
				{#each rows as action (action.id)}
					{@const editing = app.cap?.target.actionId === action.id}
					{@const changed = app.store.isChanged(action.id)}
					<li
						data-action={action.id}
						class="flex flex-col gap-[6px] px-1 py-[6px] {editing
							? 'bg-trail/5'
							: app.lastActs.includes(action.id)
								? 'bg-trail/10'
								: ''}"
					>
						<div class="grid grid-cols-[minmax(0,1fr)_88px_88px] items-center gap-[6px]">
							<div class="flex min-w-0 flex-col">
								<span class="text-[15px] leading-[1.2]">{action.name}</span>
								{#if isUnbound(app.store.bindings[action.id]) && !editing}
									<span class="font-mono text-[11px] text-ink-900">Not bound</span>
								{/if}
								{#if changed}
									<span class="font-mono text-[11px] text-trail"
										>Changed · <button
											type="button"
											onclick={() => app.store.undo(action.id)}
											class="cursor-pointer border-0 bg-transparent p-0 text-trail underline"
											aria-label="Undo the change to {action.name}">Undo</button
										></span
									>
								{/if}
							</div>
							<SlotButton
								{action}
								slot={0}
								onpick={() => app.startCapture({ actionId: action.id, slot: 0 })}
							/>
							{#if action.axis}
								<span class="text-center font-mono text-[12px] text-ink-950/60" aria-hidden="true"
									>axis</span
								>
							{:else}
								<SlotButton
									{action}
									slot={1}
									onpick={() => app.startCapture({ actionId: action.id, slot: 1 })}
								/>
							{/if}
						</div>
						{#if editing}<RebindCard {action} />{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
	<span class="font-mono text-[12px] text-ink-900">Click any bind to change it.</span>
</aside>
