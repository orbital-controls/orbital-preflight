<script lang="ts">
	import { KEY_CLASS, type KeyState } from './styles.ts';

	/** One key or button on the input deck or the editor's device map. */
	interface Props {
		label: string;
		aria: string;
		state: KeyState;
		width?: number;
		compact?: boolean;
		onpress: () => void;
	}

	let { label, aria, state, width, compact = false, onpress }: Props = $props();
</script>

<button
	type="button"
	onclick={onpress}
	aria-label={aria}
	class="cursor-pointer border p-0 font-mono font-bold notch op-notch-xs {compact
		? 'h-9 text-[11px]'
		: 'h-11 text-[12px]'} {KEY_CLASS[state]}"
	style:width="{width ?? (compact ? 36 : 44)}px">{label}</button
>
