<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * A real modal dialog: `showModal()` makes the rest of the page inert (so focus stays
	 * inside), Esc closes it, and focus goes back to whatever opened it.
	 */
	interface Props {
		open: boolean;
		/** Element to return focus to on close. */
		opener?: HTMLElement | null;
		labelledby: string;
		variant?: 'drawer' | 'center';
		onclose: () => void;
		children: Snippet;
	}

	let { open, opener = null, labelledby, variant = 'drawer', onclose, children }: Props = $props();
	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) {
			dialog.close();
			opener?.focus();
		}
	});

	function cancel(event: Event) {
		event.preventDefault();
		onclose();
	}

	function backdrop(event: MouseEvent) {
		if (event.target === dialog) onclose();
	}
</script>

<dialog
	bind:this={dialog}
	aria-labelledby={labelledby}
	oncancel={cancel}
	onclick={backdrop}
	class="text-ink-200 backdrop:bg-abyss/60 {variant === 'drawer'
		? 'm-0 ml-auto h-dvh max-h-none w-[500px] max-w-none overflow-y-auto border-0 border-l border-course/35 bg-panel p-0 shadow-[-20px_0_60px_rgba(0,0,0,0.5)]'
		: 'mx-auto mt-[220px] w-[560px] border border-course/35 bg-panel p-0 notch-card backdrop:bg-abyss/88'}"
>
	{#if open}{@render children()}{/if}
</dialog>
