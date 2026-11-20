<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { reportPageView } from '#lib/orbital-preflight/analytics/events.ts';

	/**
	 * Sends a page view per navigation to whichever providers the build carries. The tags
	 * are already in the head (`src/hooks.server.ts`), each told not to count views itself.
	 * Renders nothing, and reports nothing when the config sets no IDs.
	 */
	afterNavigate(({ shallow, type }) => {
		if (shallow && type === 'goto') return;
		reportPageView(location.href, document.title);
	});
</script>
