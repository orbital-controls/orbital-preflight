<script lang="ts">
	import { usePreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { simById } from '#lib/orbital-preflight/sims/index.ts';
	import Brand from './Brand.svelte';

	/** The stand bar: the only chrome on the page (StandFly). */
	interface Props {
		onopenload: (opener: HTMLElement) => void;
		onopendevices: (opener: HTMLElement) => void;
		onopeneditor: () => void;
		onleave: (opener: HTMLElement) => void;
	}

	let { onopenload, onopendevices, onopeneditor, onleave }: Props = $props();
	const app = usePreflight();

	const sim = $derived(simById(app.sim));
	const changes = $derived(app.store.changes);
	const devices = $derived(app.store.file?.parsed.devices ?? []);
	const paired = $derived(devices.filter((d) => app.hub.pads.some((p) => p.deviceId === d.id)));
	const dots = $derived([true, ...devices.map((d) => paired.includes(d))]);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- Leave goes to the external homeUrl -->
<header class="border-b border-course/20 bg-abyss">
	<div class="op-wrap flex h-16 items-center gap-3">
		<span class="mr-[10px]"><Brand /></span>

		<button
			type="button"
			onclick={(e) => onopenload(e.currentTarget)}
			aria-expanded={app.drawer === 'load'}
			aria-label={app.loaded
				? `Binding for ${sim.name}. Switch game or load another file.`
				: 'No game chosen. Load binds.'}
			class="flex h-[52px] cursor-pointer items-center gap-3 border py-0 pr-[14px] pl-[6px] text-left text-ink-200 notch op-notch-xs {app.loaded
				? 'border-trail/45 bg-panel/85'
				: 'border-ink-900/45 bg-transparent'}"
		>
			<span
				class="flex size-10 items-center justify-center font-display text-[18px] font-black tracking-[.02em] notch op-notch-xs {app.loaded
					? 'bg-trail text-void'
					: 'bg-transparent text-ink-900'}">{app.loaded ? sim.short : '?'}</span
			>
			<span class="flex flex-col leading-[1.05]">
				<span class="font-mono text-[10px] font-semibold tracking-[.14em] text-course uppercase"
					>Binding for</span
				>
				<span
					class="font-display text-[22px] font-black uppercase {app.loaded
						? 'text-ink-200'
						: 'text-ink-900'}">{app.loaded ? sim.name : 'No game yet'}</span
				>
				<span class="max-w-[280px] truncate font-mono text-[11px] text-ink-900"
					>{app.loaded ? app.fileLine : 'Pick one to start'}</span
				>
			</span>
			<span class="ml-[6px] font-mono text-[12px] font-semibold text-course underline"
				>{app.loaded ? 'Switch game' : 'Load binds'}</span
			>
		</button>

		<button
			type="button"
			onclick={(e) => onopendevices(e.currentTarget)}
			aria-expanded={app.drawer === 'devices'}
			class="flex h-10 cursor-pointer items-center gap-[10px] border border-course/40 bg-transparent px-[14px] font-mono text-[13px] font-semibold text-ink-200 notch op-notch-xs"
		>
			<span class="flex gap-1" aria-hidden="true">
				{#each dots as ready, i (i)}
					<span class="size-2 rounded-full {ready ? 'bg-trail' : 'bg-ink-950/50'}"></span>
				{/each}
			</span>
			<span>Controllers</span>
			<span class="font-medium opacity-70">· {paired.length + 1} of {devices.length + 1} ready</span
			>
		</button>

		<span class="ml-auto font-mono text-[13px] text-ink-500">
			<span class="font-bold text-trail">{changes}</span>
			unsaved {changes === 1 ? 'change' : 'changes'}
		</span>
		<button
			type="button"
			disabled={!app.loaded}
			onclick={() => app.exportPreset()}
			class="flex h-10 cursor-pointer items-center border px-[14px] font-mono text-[13px] font-semibold notch op-notch-xs disabled:cursor-not-allowed {changes
				? 'border-trail text-trail'
				: 'border-ink-900/35 text-ink-900'}">Export new preset</button
		>
		<button
			type="button"
			disabled={!app.loaded}
			onclick={onopeneditor}
			class="flex h-10 cursor-pointer items-center gap-[10px] border border-course/40 px-[14px] font-mono text-[13px] font-semibold text-ink-200 notch op-notch-xs disabled:cursor-not-allowed disabled:opacity-60"
		>
			<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"
				><path
					d="M1 4 V1 H4 M8 1 H11 V4 M11 8 V11 H8 M4 11 H1 V8"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
				/></svg
			>Full editor
		</button>
		<a
			href={app.config.homeUrl}
			onclick={(e) => {
				if (!changes) return;
				e.preventDefault();
				onleave(e.currentTarget);
			}}
			class="flex h-10 items-center gap-[10px] px-[14px] font-mono text-[13px] font-semibold text-ink-900 no-underline notch op-notch-xs hover:text-course"
		>
			<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"
				><path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" stroke-width="1.6" /></svg
			>Leave
		</a>
	</div>
</header>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
