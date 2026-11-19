<script lang="ts">
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import PoweredBy from './PoweredBy.svelte';

	/** Controllers (StandFly · Controllers drawer): paired, listening and not-in-file states. */
	interface Props {
		onclose: () => void;
	}

	let { onclose }: Props = $props();
	const app = useOrbitalPreflight();

	const devices = $derived(app.store.file?.parsed.devices ?? []);
	const rows = $derived(
		devices.map((device) => {
			const pad = app.hub.pads.find((p) => p.deviceId === device.id) ?? null;
			return { device, pad };
		})
	);
	// The controller pairs on the next press while this drawer is open (`armPairing`).
	const listeningFor = $derived(rows.find((r) => !r.pad)?.device.id ?? null);
	const strays = $derived(app.hub.pads.filter((p) => !p.deviceId));
</script>

<div class="flex flex-col gap-[18px] px-7 py-6">
	<div class="flex items-center justify-between">
		<h2 id="devices-title" class="font-display text-[40px] leading-[0.9] font-black uppercase">
			Controllers
		</h2>
		<button
			type="button"
			onclick={onclose}
			aria-label="Close"
			class="flex size-11 cursor-pointer items-center justify-center border border-course/40 bg-transparent text-ink-200 notch op-notch-xs"
		>
			<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"
				><path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" stroke-width="1.8" /></svg
			>
		</button>
	</div>
	<p class="text-ink-500">
		Your browser numbers controllers its own way. Press any button on a device to match it to the
		one in your file. Plug things in or swap them whenever you like.
	</p>

	<ul class="flex flex-col gap-3">
		<li
			class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border border-course/20 bg-panel/78 px-4 py-[14px] notch"
		>
			<span class="font-display text-[24px] leading-none font-extrabold uppercase"
				>Keyboard & mouse</span
			>
			<span
				class="border border-trail px-[10px] py-1 font-mono text-[12px] font-bold text-trail notch op-notch-xs"
				>Ready</span
			>
			<span class="font-mono text-[13px] text-ink-900">Works whenever this tab has focus</span>
		</li>
		{#each rows as { device, pad } (device.id)}
			{@const waiting = !pad && listeningFor === device.id}
			<li
				class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border px-4 py-[14px] notch {waiting
					? 'border-course bg-course-deep/12'
					: 'border-course/20 bg-panel/78'}"
			>
				<span class="font-display text-[24px] leading-none font-extrabold uppercase"
					>{pad?.name ?? device.name}</span
				>
				<span
					class="border px-[10px] py-1 font-mono text-[12px] font-bold notch op-notch-xs {pad
						? 'border-trail text-trail'
						: waiting
							? 'pulse border-course text-course'
							: 'border-ink-900/45 text-ink-900'}"
					>{pad ? 'Paired' : waiting ? 'Press any button' : 'Waiting'}</span
				>
				<span class="font-mono text-[13px] text-ink-900"
					>{pad
						? `${device.name} in your file${pad.pairedBy === 'usb' ? ', matched by USB id' : ''}`
						: waiting
							? `${device.name} · waiting for a press`
							: `${device.name} · pairs after the one above`}</span
				>
				{#if pad}
					<button
						type="button"
						onclick={() => app.unpair(pad.index)}
						class="min-h-9 cursor-pointer border-0 bg-transparent font-mono text-[13px] text-course underline"
						>Re-pair</button
					>
				{/if}
			</li>
		{/each}
		{#each strays as pad (pad.index)}
			<li
				class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border border-dashed border-ink-900/45 px-4 py-[14px] notch"
			>
				<span class="font-display text-[24px] leading-none font-extrabold text-ink-500 uppercase"
					>{pad.name}</span
				>
				<span
					class="border border-ink-900/45 px-[10px] py-1 font-mono text-[12px] font-bold text-ink-900 notch op-notch-xs"
					>Not in file</span
				>
				<span class="font-mono text-[13px] text-ink-900"
					>Plugged in, but your binds don't use it yet. Bind anything to it and it joins the export.</span
				>
			</li>
		{/each}
	</ul>
	{#if !devices.length}
		<p class="text-ink-900">These binds use only the keyboard and mouse.</p>
	{/if}
	<p class="px-[14px] py-3 font-mono text-[13px] text-ink-900 glass notch">
		Device not showing? Browsers only reveal a controller after you press one of its buttons. If
		that does nothing, unplug it, plug it back in and press again.
	</p>
	<PoweredBy />
</div>
