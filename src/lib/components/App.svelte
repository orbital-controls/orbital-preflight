<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { Preflight, setPreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { TICK_MS } from '#lib/orbital-preflight/flight.ts';
	import { presetSources } from '#lib/orbital-preflight/presets.ts';
	import { simById } from '#lib/orbital-preflight/sims/index.ts';
	import { base, site } from '#lib/orbital-preflight/site.ts';
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

	/** The one page: fly view, binds, deck, drawers and the full editor, sharing one store. */
	const app = new Preflight(site, base, presetSources);
	setPreflight(app);

	let opener: HTMLElement | null = $state(null);
	let editorButton: HTMLElement | null = null;
	let ready = $state(false);

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
		const timer = setInterval(() => app.step(), TICK_MS);
		return () => {
			detach();
			unsubscribe();
			clearInterval(timer);
		};
	});

	// A bound throttle axis drives the throttle.
	$effect(() => {
		void app.hub.axes.size;
		for (const _ of app.hub.axes.values()) void _;
		untrack(() => app.followThrottle());
	});

	// Remembered layouts follow every change.
	$effect(() => {
		void app.store.bindings;
		void app.remember;
		untrack(() => app.persist());
	});

	function openDrawer(kind: 'load' | 'devices', el: HTMLElement) {
		app.cancelCapture();
		opener = el;
		app.drawer = kind;
	}

	function openEditor() {
		app.cancelCapture();
		editorButton = document.activeElement as HTMLElement | null;
		app.editor = true;
	}

	function closeEditor() {
		app.cancelCapture();
		app.ed = { ...app.ed, pend: null };
		app.editor = false;
		requestAnimationFrame(() => editorButton?.focus());
	}

	// "Drop your file anywhere".
	function dragover(event: DragEvent) {
		if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
	}
	function drop(event: DragEvent) {
		const file = event.dataTransfer?.files?.[0];
		if (!file) return;
		event.preventDefault();
		if (simById(app.sim).status === 'ready') void app.loadFile(file);
	}
</script>

<svelte:window ondragover={dragover} ondrop={drop} />

<div class="min-[1280px]:hidden"><DesktopNotice /></div>

<div
	class="relative min-h-[1080px] min-w-[1280px] space text-[16px] leading-[1.45] text-ink-200 max-[1279px]:hidden"
	data-ready={ready}
>
	{#if app.editor}
		<FullEditor onexit={closeEditor} />
	{:else}
		<TopBar
			onopenload={(el) => openDrawer('load', el)}
			onopendevices={(el) => openDrawer('devices', el)}
			onopeneditor={openEditor}
			onleave={(el) => {
				opener = el;
				app.leaving = true;
			}}
		/>
		<main>
			<section aria-label="Mode" class="op-wrap flex items-center gap-[18px] pt-4">
				<ModeTabs />
				<p class="max-w-[560px] text-[14px] text-ink-900">{MODE_NOTES[app.mode]}</p>
			</section>
			<section class="op-wrap grid grid-cols-[900px_minmax(0,1fr)] items-start gap-5 pt-3">
				<Viewport onwhere={(el) => openDrawer('load', el)} />
				<BindsPanel />
			</section>
			<InputDeck />
		</main>
	{/if}
</div>

<Dialog
	open={app.drawer === 'load'}
	{opener}
	labelledby="load-title"
	onclose={() => (app.drawer = null)}
>
	<LoadDrawer onclose={() => (app.drawer = null)} />
</Dialog>
<Dialog
	open={app.drawer === 'devices'}
	{opener}
	labelledby="devices-title"
	onclose={() => (app.drawer = null)}
>
	<ControllersDrawer onclose={() => (app.drawer = null)} />
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
