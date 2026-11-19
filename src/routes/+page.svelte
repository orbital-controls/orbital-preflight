<script lang="ts">
	import App from '#lib/components/App.svelte';
	import { pageName } from '#lib/orbital-preflight/config.ts';
	import { site } from '#lib/orbital-preflight/site.ts';
</script>

<svelte:head>
	<title>{site.title}</title>
	<meta name="description" content={site.description} />
	{#if site.siteUrl}
		<link rel="canonical" href="{site.siteUrl}/" />
		<meta property="og:url" content="{site.siteUrl}/" />
		<meta property="og:image" content="{site.siteUrl}/og.png" />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
	{/if}
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={site.siteName} />
	<meta property="og:title" content={site.title} />
	<meta property="og:description" content={site.description} />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<h1 class="op-sr-only">{pageName(site.siteName)}</h1>
<App />
