<script lang="ts">
	import './layout.css';
	import { themeCss } from '#lib/orbital-preflight/config.ts';
	import { faviconHref } from '#lib/orbital-preflight/favicon.ts';
	import { site } from '#lib/orbital-preflight/site.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// The config's theme overrides, after the theme package's own variables.
	const theme = themeCss(site.theme);

	const icon = faviconHref(site.brand.markSmall, site.theme);
</script>

<svelte:head>
	<link rel="icon" href={icon} />
	{#if theme}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- validated in resolveConfig -->
		{@html `<style id="op-theme">${theme}</style>`}
	{/if}
</svelte:head>

{@render children()}
