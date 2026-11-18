<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { themeCss } from '#lib/orbital-preflight/config.ts';
	import { site } from '#lib/orbital-preflight/site.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// The config's theme overrides, after the theme package's own variables.
	const theme = themeCss(site.theme);

	// A favicon can't read CSS variables, so the mark's colours are filled in from the
	// theme package's defaults.
	const FALLBACK: Record<string, string> = {
		course: '#8b88ff',
		trail: '#ffc21a',
		'ink-200': '#e6e8f6',
		void: '#090b1c'
	};
	const icon = site.brand.markSmall
		? `data:image/svg+xml,${encodeURIComponent(
				site.brand.markSmall.replace(
					/var\(--color-([a-z0-9-]+)\)/g,
					(_, name: string) => FALLBACK[name] ?? FALLBACK.course
				)
			)}`
		: favicon;
</script>

<svelte:head>
	<link rel="icon" href={icon} />
	{#if theme}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- validated in resolveConfig -->
		{@html `<style id="op-theme">${theme}</style>`}
	{/if}
</svelte:head>

{@render children()}
