<script lang="ts">
	import { tick } from 'svelte';
	import { useOrbitalPreflight, type GameRow } from '#lib/orbital-preflight/app.svelte.ts';
	import type { SimId } from '#lib/orbital-preflight/types.ts';
	import GameTile from './GameTile.svelte';

	/**
	 * "Binding for" and the game manifest that drops from it (Main and BindEditor ·
	 * Switch game). One component for the fly page's bar and the editor's title row. The
	 * manifest is a non-modal popover: focus moves in, Esc or a click outside closes it,
	 * focus goes back to the button. Bind inputs don't fire while it's open.
	 */
	interface Props {
		context: 'fly' | 'editor';
		/** "Load a different <ABBR> file": the Load binds drawer, over whichever page. */
		onloadfile: (opener: HTMLElement) => void;
		/** "Add a game": the editor goes back to the fly page's file drop first. */
		onadd?: (sim: SimId) => void;
	}

	let { context, onloadfile, onadd }: Props = $props();
	const app = useOrbitalPreflight();

	let button: HTMLButtonElement | undefined = $state();
	let panel: HTMLElement | undefined = $state();

	const rows = $derived(app.gameRows);
	const current = $derived(rows.find((r) => r.current) ?? null);
	const loadedRows = $derived(rows.filter((r) => r.loaded));
	const otherRows = $derived(rows.filter((r) => !r.loaded));
	const abbr = $derived(current?.sim.short ?? '');

	async function open() {
		app.toggleManifest(true);
		await tick();
		panel?.querySelector<HTMLElement>('button, a')?.focus();
	}

	function close(refocus = true) {
		app.toggleManifest(false);
		if (refocus) button?.focus();
	}

	function toggle() {
		if (!app.chosen) {
			// Nothing to switch from yet: the bay below is where a game is picked.
			document.querySelector<HTMLElement>('[data-op-bay] button')?.focus();
			return;
		}
		if (app.manifest) close();
		else void open();
	}

	function pick(row: GameRow) {
		if (row.sim.status !== 'ready') return;
		if (!row.loaded && onadd) {
			app.toggleManifest(false);
			onadd(row.sim.id);
			return;
		}
		app.switchTo(row.sim.id);
		button?.focus();
	}

	function keydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !app.manifest) return;
		event.preventDefault();
		close();
	}

	function focusout(event: FocusEvent & { currentTarget: HTMLElement }) {
		const next = event.relatedTarget as Node | null;
		// Focus moved to something outside (Tab past the end): let it go without stealing it back.
		if (app.manifest && next && !event.currentTarget.contains(next)) close(false);
	}

	const name = $derived(current ? current.sim.name : app.chosen ? '' : 'No game yet');
	const fileLine = $derived(
		!app.chosen ? 'Pick one to start' : app.loaded ? app.fileLine : 'Waiting for your file'
	);
	const aria = $derived(
		app.loaded
			? `Binding for ${current?.sim.name}. Switch game or load another file.`
			: app.chosen
				? `Binding for ${current?.sim.name}, waiting for your file. Switch game.`
				: 'No game chosen. Load binds.'
	);
	const btn = 'cursor-pointer font-mono notch op-notch-xs';
</script>

<svelte:window onkeydown={keydown} />

{#if app.manifest}
	<!-- Click outside: a plain layer under the panel, not a control (Esc is the keyboard way). -->
	<div
		aria-hidden="true"
		data-op-manifest-backdrop
		onclick={() => close()}
		class="fixed inset-x-0 bottom-0 z-30 {context === 'fly'
			? 'top-16 bg-abyss/55'
			: 'top-0 bg-abyss/40'}"
	></div>
{/if}

<span class="relative z-40 flex-none" onfocusout={focusout}>
	<button
		bind:this={button}
		type="button"
		onclick={toggle}
		aria-expanded={app.manifest}
		aria-haspopup="dialog"
		aria-label={aria}
		class="flex min-w-0 flex-none cursor-pointer items-center gap-3 border py-0 pr-[14px] pl-[6px] text-left text-ink-200 notch op-notch-xs {context ===
		'fly'
			? 'h-[52px]'
			: 'h-12'} {app.loaded
			? app.manifest
				? 'border-trail bg-panel/85'
				: 'border-trail/45 bg-panel/85'
			: 'border-ink-900/45 bg-transparent'}"
	>
		<span
			class="flex size-10 items-center justify-center font-display text-[18px] font-black tracking-[.02em] notch op-notch-xs {app.loaded
				? 'bg-trail text-void'
				: 'bg-transparent text-ink-900'}">{app.chosen ? abbr : '?'}</span
		>
		<span class="flex min-w-0 flex-col gap-[2px]">
			<span
				class="font-mono text-[10px] leading-none font-semibold tracking-[.14em] text-course uppercase"
				>Binding for</span
			>
			<span
				class="font-display text-[22px] leading-[0.9] font-black uppercase {app.loaded
					? 'text-ink-200'
					: 'text-ink-900'}">{name}</span
			>
			<span
				class="max-w-[220px] truncate font-mono text-[11px] leading-tight text-ink-900"
				title={app.loaded ? app.fileLine : undefined}>{fileLine}</span
			>
		</span>
		<span
			class="ml-[6px] flex items-center gap-[6px] font-mono text-[12px] font-semibold text-course"
			>Switch game<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"
				><path
					d={app.manifest ? 'M1 7 L5 3 L9 7' : 'M1 3 L5 7 L9 3'}
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
				/></svg
			></span
		>
	</button>

	{#if app.manifest}
		<div
			bind:this={panel}
			role="dialog"
			aria-label="Switch game"
			data-op-manifest
			class="absolute top-[calc(100%+8px)] left-0 flex w-[500px] flex-col gap-[10px] border border-trail/45 bg-panel p-[18px] font-mono whitespace-normal shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
		>
			{#if loadedRows.length}
				<h3 class="op-lbl" id="manifest-loaded">Loaded this session</h3>
				<ul class="flex flex-col gap-[10px]" aria-labelledby="manifest-loaded">
					{#each loadedRows as row (row.sim.id)}
						<li>
							<button
								type="button"
								onclick={() => pick(row)}
								aria-current={row.current ? 'true' : undefined}
								class="grid min-h-16 w-full cursor-pointer grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-[14px] border py-[10px] pr-[14px] pl-[10px] text-left text-ink-200 {row.current
									? 'border-trail/55 bg-trail/8'
									: 'border-course/18 bg-transparent hover:border-course/50'}"
							>
								<GameTile {row} />
								<span class="flex min-w-0 flex-col leading-[1.15]">
									<span class="font-display text-[22px] font-black uppercase">{row.sim.name}</span>
									<span class="truncate text-[12px] text-ink-900"
										>{row.file}{row.modeList ? ` · ${row.modeList}` : ''}</span
									>
								</span>
								<span class="flex flex-col items-end gap-[2px]">
									<span class="text-[12px] font-bold {row.changes ? 'text-trail' : 'text-ink-500'}"
										>{row.status}</span
									>
									{#if row.current}
										<span class="text-[11px] tracking-[.1em] text-trail uppercase">Binding now</span
										>
									{/if}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			<h3 class="mt-[6px] op-lbl" id="manifest-add">Add a game</h3>
			<ul class="flex flex-col gap-[10px]" aria-labelledby="manifest-add">
				{#each otherRows as row (row.sim.id)}
					{@const ready = row.sim.status === 'ready'}
					<li>
						{#if ready}
							<button
								type="button"
								onclick={() => pick(row)}
								aria-current={row.current ? 'true' : undefined}
								class="grid min-h-14 w-full cursor-pointer grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-[14px] border border-dashed py-2 pr-[14px] pl-[10px] text-left text-ink-200 {row.current
									? 'border-trail/55 bg-trail/8'
									: 'border-ink-900/45 bg-transparent hover:border-course/60'}"
							>
								<GameTile {row} />
								<span class="flex min-w-0 flex-col leading-[1.15]">
									<span class="text-[15px] font-bold">{row.sim.name}</span>
									<span class="truncate text-[12px] text-ink-900">{row.file}</span>
								</span>
								<span class="text-[12px] font-bold text-course"
									>{context === 'editor' ? 'Load file · opens in Preflight' : 'Load file'}</span
								>
							</button>
						{:else}
							<!-- Not a control: it can't be picked yet. -->
							<span
								class="grid min-h-14 w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-[14px] border border-dashed border-ink-950/40 py-2 pr-[14px] pl-[10px] text-ink-950"
							>
								<GameTile {row} />
								<span class="flex min-w-0 flex-col leading-[1.15]">
									<span class="text-[15px] font-bold">{row.sim.name}</span>
									<span class="truncate text-[12px] text-ink-900">{row.file}</span>
								</span>
								<span class="text-[12px] font-bold">Coming later</span>
							</span>
						{/if}
					</li>
				{/each}
			</ul>

			<div class="mt-1 flex items-center justify-between gap-3 border-t border-course/18 pt-3">
				<button
					type="button"
					onclick={(e) => {
						app.toggleManifest(false);
						onloadfile(button ?? e.currentTarget);
					}}
					class="min-h-10 border-0 bg-transparent p-0 text-[13px] font-semibold text-course underline {btn}"
					>Load a different {abbr} file</button
				>
				<span class="text-right text-[12px] text-ink-900"
					>{#if context === 'editor'}Filters and search stay put<br />when you switch.{:else}Each
						game keeps its binds and changes<br />while this tab is open.{/if}</span
				>
			</div>
		</div>
	{/if}
</span>
