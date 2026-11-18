<script lang="ts">
	import { usePreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { MODES, type Mode } from '#lib/orbital-preflight/types.ts';

	/** Ship / SRV / On foot, with per-mode change badges. Shared by the fly page and the editor. */
	interface Props {
		/** The editor's tabs drop the bind count, as its toolbar already shows one. */
		compact?: boolean;
	}

	let { compact = false }: Props = $props();
	const app = usePreflight();

	const DEFS: Record<Mode, { name: string; sub: string; icon: string }> = {
		ship: {
			name: 'Ship',
			sub: 'Flight',
			icon: 'M15 3 L19 15 L28 21 L19 20 L15 27 L11 20 L2 21 L11 15 Z'
		},
		srv: {
			name: 'SRV',
			sub: 'Surface driving',
			icon: 'M4 19 H26 L23 12 H7 Z M11 12 L13 8 H17 L19 12 M5 23 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M19 23 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0'
		},
		foot: {
			name: 'On foot',
			sub: 'First person',
			icon: 'M12 6 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M15 10 V19 M15 19 L11 27 M15 19 L19 27 M9 14 L15 12 L21 14'
		}
	};

	function keydown(event: KeyboardEvent, index: number) {
		const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
		if (!step) return;
		event.preventDefault();
		const next = MODES[(index + step + MODES.length) % MODES.length];
		app.setMode(next);
		const tabs = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll('button');
		tabs?.[MODES.indexOf(next)]?.focus();
	}
</script>

<div role="tablist" aria-label="Mode" class="flex gap-1 border border-course/28 bg-panel/60 p-1">
	{#each MODES as mode, i (mode)}
		{@const def = DEFS[mode]}
		{@const on = app.mode === mode}
		{@const changes = app.loaded ? app.store.changedIn(mode) : 0}
		<button
			type="button"
			role="tab"
			aria-selected={on}
			tabindex={on ? 0 : -1}
			onclick={() => app.setMode(mode)}
			onkeydown={(e) => keydown(e, i)}
			class="flex cursor-pointer items-center gap-3 border-0 px-[14px] text-left notch op-notch-xs {compact
				? 'h-11 min-w-[160px]'
				: 'h-[52px] min-w-[200px]'} {on ? 'bg-ink-200 text-void' : 'bg-transparent text-ink-500'}"
		>
			<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"
				><path
					d={def.icon}
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linejoin="round"
					stroke-linecap="round"
				/></svg
			>
			<span class="flex flex-col leading-[1.1]">
				<span class="font-display text-[20px] font-black uppercase">{def.name}</span>
				{#if !compact}
					<span class="font-mono text-[11px] opacity-75"
						>{def.sub} · {app.store.actionsIn(mode).length} binds</span
					>
				{/if}
			</span>
			{#if changes > 0}
				<span
					aria-label="{changes} unsaved changes in {def.name}"
					class="ml-auto flex h-5 min-w-5 items-center justify-center rounded-[10px] bg-trail px-[6px] font-mono text-[12px] font-bold text-void"
					>{changes}</span
				>
			{/if}
		</button>
	{/each}
</div>
