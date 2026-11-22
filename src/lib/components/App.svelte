<script lang="ts">
	import { onMount } from 'svelte';
	import { OrbitalPreflight, setOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { firstVisit } from '#lib/orbital-preflight/config.ts';
	import { TICK_MS } from '#lib/orbital-preflight/flight.ts';
	import { presetSources } from '#lib/orbital-preflight/presets.ts';
	import { SIMS_WITH_DEFAULTS, simById } from '#lib/orbital-preflight/sims/index.ts';
	import { site } from '#lib/orbital-preflight/site.ts';
	import type { SimId } from '#lib/orbital-preflight/types.ts';
	import Bay from './Bay.svelte';
	import BindsPanel from './BindsPanel.svelte';
	import ControllersDrawer from './ControllersDrawer.svelte';
	import DesktopNotice from './DesktopNotice.svelte';
	import Dialog from './Dialog.svelte';
	import FullEditor from './FullEditor.svelte';
	import InputDeck from './InputDeck.svelte';
	import LeaveDialog from './LeaveDialog.svelte';
	import LoadDrawer from './LoadDrawer.svelte';
	import ModeTabs from './ModeTabs.svelte';
	import TopBar from './TopBar.svelte';
	import Viewport from './Viewport.svelte';

	/**
	 * The one page: the bay or the fly view, binds, deck, drawers and the full editor,
	 * all reading the current game's session.
	 */
	const app = new OrbitalPreflight(site, presetSources);
	setOrbitalPreflight(app);

	let opener: HTMLElement | null = $state(null);
	let editorButton: HTMLElement | null = null;
	let ready = $state(false);
	/**
	 * The prerendered page shows the bay only when a first visit lands there. A fork whose
	 * presets open straight away shows nothing under the bar until the preset is in, rather
	 * than flashing the bay (or offering keys and tiles that do nothing yet).
	 */
	const bayFirst = firstVisit(site.presets, SIMS_WITH_DEFAULTS).kind === 'bay';

	const MODE_NOTES = {
		ship: 'Ship binds. In game, boarding, deploying the SRV or disembarking switches the set for you. Here, pick it.',
		srv: 'The SRV has its own set. Same keys, different jobs: Space fires the vertical thrusters, not boost.',
		foot: 'On-foot binds are keyboard and mouse first, so the stick and throttle step aside. Bind them here if you walk with a HOTAS.'
	};

	onMount(() => {
		app.init();
		ready = true;
		const detach = app.hub.attach(window);
		const unsubscribe = app.hub.subscribe((event) => app.onInput(event));
		// A bound throttle axis drives the throttle.
		const unsubscribeAxes = app.hub.subscribeAxes(() => app.followThrottle());
		const timer = setInterval(() => app.step(), TICK_MS);
		return () => {
			detach();
			unsubscribe();
			unsubscribeAxes();
			clearInterval(timer);
		};
	});

	function openDrawer(kind: 'load' | 'devices', el: HTMLElement) {
		opener = el;
		app.openDrawer(kind);
	}

	function openEditor() {
		app.cancelCapture();
		app.toggleManifest(false);
		editorButton = document.activeElement as HTMLElement | null;
		app.editor = true;
	}

	function closeEditor() {
		app.cancelCapture();
		app.ed = { ...app.ed, pend: null };
		app.editor = false;
		requestAnimationFrame(() => editorButton?.focus());
	}

	/** The editor's "Add a game": back on the fly page, at that game's file drop. */
	function addFromEditor(sim: SimId) {
		closeEditor();
		app.switchTo(sim);
	}

	// "Drop your file anywhere".
	function dragover(event: DragEvent) {
		if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
	}
	function drop(event: DragEvent) {
		const file = event.dataTransfer?.files?.[0];
		if (!file) return;
		event.preventDefault();
		// For the current game only; in the bay there is none to load it for yet.
		if (app.chosen && simById(app.sim).status === 'ready') void app.loadFile(file);
	}
</script>

<svelte:window ondragover={dragover} ondrop={drop} />

<div class="min-[1280px]:hidden"><DesktopNotice /></div>

<div
	class="relative min-h-[1080px] min-w-[1280px] space text-[16px] leading-[1.45] text-ink-200 max-[1279px]:hidden"
	data-ready={ready}
>
	{#if app.editor}
		<FullEditor
			onexit={closeEditor}
			onloadfile={(el) => openDrawer('load', el)}
			onadd={addFromEditor}
		/>
	{:else}
		<TopBar
			onopenload={(el) => openDrawer('load', el)}
			onopendevices={(el) => openDrawer('devices', el)}
			onopeneditor={openEditor}
			onleave={(el) => {
				opener = el;
				app.toggleManifest(false);
				app.leaving = true;
			}}
		/>
		<main>
			{#if !app.chosen}
				{#if ready || bayFirst}<Bay />{/if}
			{:else}
				<section aria-label="Mode" class="op-wrap flex items-center gap-[18px] pt-4">
					<ModeTabs />
					<p class="max-w-[560px] text-[14px] text-ink-900">
						{simById(app.sim).words?.modeNotes?.[app.mode] ?? MODE_NOTES[app.mode]}
					</p>
				</section>
				<section class="op-wrap grid grid-cols-[900px_minmax(0,1fr)] items-start gap-5 pt-3">
					<Viewport onwhere={(el) => openDrawer('load', el)} />
					<BindsPanel />
				</section>
				<InputDeck />
			{/if}
		</main>
	{/if}
</div>

<Dialog
	open={app.drawer === 'load'}
	{opener}
	labelledby="load-title"
	onclose={() => app.closeDrawer()}
>
	<LoadDrawer onclose={() => app.closeDrawer()} />
</Dialog>
<Dialog
	open={app.drawer === 'devices'}
	{opener}
	labelledby="devices-title"
	onclose={() => app.closeDrawer()}
>
	<ControllersDrawer onclose={() => app.closeDrawer()} />
</Dialog>
<Dialog
	open={app.leaving}
	{opener}
	labelledby="leave-title"
	variant="center"
	onclose={() => (app.leaving = false)}
>
	<LeaveDialog onstay={() => (app.leaving = false)} />
</Dialog>
