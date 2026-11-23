<script lang="ts">
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { footHud, pips, shipHud, srvHud, statusChips } from '#lib/orbital-preflight/flight.ts';
	import { bindLabel, inputLabel } from '#lib/orbital-preflight/labels.ts';
	import { STOPS } from '#lib/orbital-preflight/scene/pad.ts';
	import { stopPrompts } from '#lib/orbital-preflight/scene/prompts.ts';

	/**
	 * The HUD, as DOM over the scene. It reads the mock flight and the binds, never the
	 * scene, so swapping in the 3D view leaves it as it is. On foot, the 3D scene reports
	 * the stop zone the pilot is in; the stop's prompts show here with the current binds.
	 */
	interface Props {
		/** The 3D scene is up for this mode (on foot: Pad 7, with stop prompts). */
		live3d?: boolean;
	}

	let { live3d = false }: Props = $props();
	const app = useOrbitalPreflight();
	const s = $derived(app.flight);
	const mode = $derived(app.mode);
	const ship = $derived(shipHud(s));
	const srv = $derived(srvHud(s));
	const foot = $derived(footHud(s));
	const chips = $derived(
		statusChips(s, mode, (e) => app.has(e, mode)).map((c) => ({ ...c, name: app.say(c.name) }))
	);
	const hasPips = $derived(['pSys', 'pEng', 'pWep'].some((e) => app.has(e, mode)));
	const modeName = $derived(app.modeName(mode));

	const interact = $derived.by(() => {
		const action = app.store.actionsIn('foot').find((a) => a.effect === 'interact');
		const slot = action ? app.store.bindings[action.id]?.[0] : null;
		return slot ? bindLabel(slot, app.roles) : null;
	});

	const stop = $derived(
		live3d && mode === 'foot' && app.footStop
			? (STOPS.find((st) => st.n === app.footStop) ?? null)
			: null
	);
	const prompts = $derived(
		stop
			? stopPrompts(stop, app.store.actionsIn('foot'), app.store.bindings, (b) =>
					bindLabel(b, app.roles)
				)
			: []
	);

	const toast = $derived.by(() => {
		if (!app.last) return { head: 'Waiting on you', lines: [] as string[], clash: false };
		const names = app.lastActs.map((id) => app.actionById(id)?.name ?? id);
		// Several actions on one input is a clash unless the sim overloads it on purpose
		// (Star Citizen's Right mouse aims, throws and fires a tool): the store knows which.
		const clash = names.length > 1 && app.lastActs.some((id) => app.store.clashes[mode].has(id));
		return { head: inputLabel(app.last, app.roles, true), lines: names, clash };
	});

	const capAction = $derived(app.cap ? app.actionById(app.cap.target.actionId) : null);
</script>

{#snippet bar(label: string, value: number, fill: string, track: string, height = 'h-[6px]')}
	<div class="flex justify-between op-hud">
		<span>{label}</span><span class="text-ink-200">{value}%</span>
	</div>
	<div class="{height} {track}"><div class="h-full {fill}" style:width="{value}%"></div></div>
{/snippet}

{#snippet pipRow()}
	<div class="flex gap-3">
		{#each pips(s) as p (p.name)}
			<div class="flex flex-col gap-[3px]">
				<span class="op-hud">{app.say(p.name)}</span>
				<div class="flex gap-[2px]">
					{#each [0, 1, 2, 3] as c (c)}
						<span class="h-2 w-[10px] {c < p.value ? 'bg-course' : 'bg-course/18'}"></span>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/snippet}

<div class="pointer-events-none absolute inset-0">
	{#if s.tgt && mode !== 'foot' && !app.map}
		<div
			class="absolute left-[692px] size-10 border-2 border-trail shadow-[0_0_10px_rgba(255,194,26,0.6)]"
			style:top="{mode === 'srv' ? 194 : 112}px"
		></div>
	{/if}
	{#if !app.map && ((mode === 'ship' && s.nv) || (mode === 'foot' && s.fNv))}
		<div class="absolute inset-0 bg-course-deep/20"></div>
	{/if}

	<div aria-hidden="true">
		<!-- An open map draws its own readouts: the vehicle's step aside while it's open. -->
		{#if app.map}{:else if mode === 'ship'}
			<div class="absolute top-4 left-[18px] flex w-[220px] flex-col gap-2">
				{@render bar('Throttle', ship.thr, 'bg-course', 'bg-course/18', 'h-2')}
				<div class="flex items-baseline gap-[10px]">
					<span class="font-mono text-[30px] leading-none font-semibold">{ship.spd}</span>
					<span class="op-hud">m/s</span><span class="op-hud text-trail">{app.say(ship.mode)}</span>
				</div>
				{#if hasPips}{@render pipRow()}{/if}
			</div>
			<div class="absolute right-[18px] bottom-4 flex w-[170px] flex-col gap-[6px]">
				<div class="flex justify-between op-hud">
					<span>Heat</span><span class={ship.hot ? 'text-alert' : 'text-ink-200'}>{ship.heat}%</span
					>
				</div>
				<div class="h-2 bg-alert/18">
					<div class="h-full bg-alert" style:width="{ship.heat}%"></div>
				</div>
			</div>
		{:else if mode === 'srv'}
			<div class="absolute top-4 left-[18px] flex w-[220px] flex-col gap-2">
				<div class="flex items-baseline gap-[10px]">
					<span class="font-mono text-[30px] leading-none font-semibold">{srv.spd}</span>
					<span class="op-hud">m/s</span><span class="op-hud text-trail">{srv.dir}</span>
				</div>
				{#if app.has('da', 'srv')}
					<span class="op-hud {srv.assistOff ? 'text-trail' : ''}">{srv.assist}</span>
				{/if}
				{@render bar('Hull', srv.hull, 'bg-course', 'bg-course/18')}
				{@render bar('Fuel', srv.fuel, 'bg-trail', 'bg-trail/18')}
				{#if hasPips}{@render pipRow()}{/if}
			</div>
			{#if app.has('recall', 'srv')}
				<div
					class="absolute right-[18px] bottom-4 flex flex-col gap-[2px] px-3 py-2 glass notch op-notch-xs"
				>
					<span class="op-hud">Your ship</span>
					<span
						class="font-mono text-[15px] font-bold {srv.shipCalled ? 'text-trail' : 'text-ink-500'}"
						>{srv.ship}</span
					>
				</div>
			{/if}
		{:else}
			<div class="absolute top-4 left-[18px] flex w-[200px] flex-col gap-[6px]">
				{@render bar('Health', foot.health, 'bg-alert', 'bg-alert/20')}
				{@render bar('Shield', foot.shield, 'bg-course', 'bg-course/18')}
				{@render bar('Suit battery', foot.battery, 'bg-trail', 'bg-trail/18')}
				{#if live3d}
					<span class="op-hud" data-op-stops-done={app.footDone.length}
						>Pad 7 · {app.footDone.length} of {STOPS.length} stops</span
					>
				{/if}
			</div>
			{#if live3d}
				{#if stop}
					<div
						class="absolute top-[318px] right-0 left-0 flex justify-center"
						data-op-stop-prompt={stop.n}
					>
						<div class="flex flex-col items-center gap-[6px] bg-abyss/70 px-4 py-[8px]">
							<span class="op-hud text-trail">Stop {stop.n} · {stop.name}</span>
							{#each prompts as row (row.label)}
								<span class="flex items-center gap-[10px] font-mono text-[14px]">
									{#if row.bound}
										{#if row.hold}<span class="text-ink-900">Hold</span>{/if}
										{#each row.keys as key (key)}
											<span
												class="bg-ink-200 px-[9px] py-[3px] font-bold text-void notch op-notch-xs"
												>{key}</span
											>
										{/each}
									{:else}
										<span
											class="border border-ink-900/50 px-[9px] py-[2px] text-[12px] text-ink-900 notch op-notch-xs"
											>Not bound</span
										>
									{/if}
									{row.label}
								</span>
							{/each}
						</div>
					</div>
				{/if}
			{:else if interact}
				<div class="absolute top-[330px] right-0 left-0 flex justify-center">
					<span
						class="flex items-center gap-[10px] bg-abyss/70 px-3 py-[6px] font-mono text-[14px]"
					>
						<span class="bg-ink-200 px-[9px] py-[3px] font-bold text-void notch op-notch-xs"
							>{interact}</span
						>Interact · [Terminal]
					</span>
				</div>
			{/if}
			<div
				class="absolute right-[18px] bottom-4 flex flex-col items-end px-[14px] py-2 glass notch op-notch-xs"
			>
				<span class="op-hud">{foot.weapon}</span>
				<span class="font-mono text-[30px] leading-[1.05] font-semibold"
					>{foot.ammo} <span class="text-[16px] text-ink-900">/ {foot.reserve}</span></span
				>
				{#if foot.reloading}<span class="pulse op-hud text-trail">Reloading</span>{/if}
			</div>
		{/if}

		{#if s.msgT > 0}
			<div class="absolute top-[210px] right-0 left-0 flex justify-center">
				<span
					class="border-y border-trail bg-void/70 px-[22px] py-[10px] font-mono text-[18px] font-semibold tracking-[.14em] text-trail uppercase"
					>{app.say(s.msg)}</span
				>
			</div>
		{/if}

		<div class={['absolute bottom-4 left-[18px] flex gap-[6px]', { hidden: app.map }]}>
			{#each chips as chip (chip.name)}
				<span
					class="border px-[9px] py-[5px] font-mono text-[11px] font-bold tracking-[.1em] notch op-notch-xs {chip.on
						? 'border-trail bg-trail text-void'
						: 'border-ink-900/35 text-ink-900'}">{chip.name}</span
				>
			{/each}
		</div>
	</div>

	<div
		aria-live="polite"
		class="absolute top-4 right-4 flex w-[280px] flex-col gap-1 px-[14px] py-3 glass [--notch:12px] notch"
	>
		<span class="op-hud">{toast.head}</span>
		{#if !app.last}
			<span class="font-display text-[28px] leading-none font-extrabold text-ink-900 uppercase"
				>Press anything</span
			>
		{:else if !toast.lines.length}
			<span class="font-display text-[28px] leading-none font-extrabold text-ink-900 uppercase"
				>Not bound</span
			>
		{:else}
			{#each toast.lines as line, i (i)}
				<span
					class="font-display text-[28px] leading-none font-extrabold uppercase {toast.clash
						? 'text-alert'
						: 'text-ink-200'}">{line}</span
				>
			{/each}
		{/if}
		{#if toast.clash}<span class="font-mono text-[12px] text-alert">Clash · both fired</span>{/if}
	</div>

	{#if app.cap}
		<div
			class="absolute inset-0 pulse border-2 border-trail shadow-[inset_0_0_70px_rgba(255,194,26,0.16)]"
		></div>
		<div
			class="absolute top-[196px] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 border border-trail bg-abyss/88 px-6 py-3 text-center whitespace-nowrap"
		>
			<span class="op-hud text-trail"
				>● Listening · {modeName} · {app.cap.target.slot ? 'secondary' : 'primary'}</span
			>
			<span class="font-display text-[36px] leading-[0.95] font-black uppercase"
				>{capAction?.name}</span
			>
			<span class="text-[14px] text-ink-500"
				>{app.cap.cand
					? `${bindLabel(app.cap.cand, app.roles, true)} picked. Confirm it in the Binds panel.`
					: 'Press the new input. Nothing fires while you’re rebinding.'}</span
			>
		</div>
	{/if}
</div>
