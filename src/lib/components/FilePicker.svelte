<script lang="ts">
	import { useOrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';
	import { simById } from '#lib/orbital-preflight/sims/index.ts';

	/** "Choose a file": a real file input under a styled label. Read with FileReader, never uploaded. */
	interface Props {
		id: string;
	}

	let { id }: Props = $props();
	const app = useOrbitalPreflight();
	const sim = $derived(simById(app.sim));

	async function change(event: Event & { currentTarget: HTMLInputElement }) {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (file) await app.loadFile(file);
	}
</script>

<input
	{id}
	type="file"
	accept={sim.extensions.join(',')}
	class="peer op-sr-only"
	onchange={change}
/>
<label
	for={id}
	class="inline-flex h-11 cursor-pointer items-center bg-trail px-5 font-mono text-[15px] font-bold text-void notch peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-trail"
	>Choose a file</label
>
