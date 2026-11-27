<script lang="ts">
	import { onMount } from 'svelte';
	import './layout.css';
	import Analytics from '#lib/components/Analytics.svelte';
	import { ConsentState } from '#lib/orbital-preflight/consent.svelte.ts';
	import { themeCss } from '#lib/orbital-preflight/config.ts';
	import { faviconHref } from '#lib/orbital-preflight/favicon.ts';
	import { base, site } from '#lib/orbital-preflight/site.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// The config's theme overrides, after the theme package's own variables.
	const theme = themeCss(site.theme);

	const icon = faviconHref(site.brand.markSmall, site.theme);

	const consent = new ConsentState(base);
	// Read after hydration, so the prerendered page and the first render agree.
	onMount(() => consent.hydrate());
	// Only fetched on a first visit to a build with a Google tag, never otherwise.
	const consentBanner = $derived(
		consent.pending ? import('#lib/components/ConsentBanner.svelte') : undefined
	);
</script>

<svelte:head>
	<link rel="icon" href={icon} />
	{#if theme}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- validated in resolveConfig -->
		{@html `<style id="op-theme">${theme}</style>`}
	{/if}
</svelte:head>

{@render children()}

<Analytics />

{#if consentBanner}
	{#await consentBanner then { default: ConsentBanner }}
		<ConsentBanner {consent} />
	{/await}
{/if}
