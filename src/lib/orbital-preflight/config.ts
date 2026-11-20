import { MARK, MARK_SMALL } from './brand.ts';
import type { SimId } from './types.ts';

/**
 * The one file a fork edits: `orbital-preflight.config.ts` at the repo root. Every field
 * is documented in the README.
 */
export interface OrbitalPreflightConfig {
	/** The page title, in the head and on the share card. */
	title: string;
	/** One plain sentence for the meta description and the share card. */
	description: string;
	/** The pilot or site the app belongs to, e.g. "Orbital Controls" or "CMDR Vex". */
	siteName: string;
	/** The absolute URL the app is served from, for the canonical and Open Graph tags. */
	siteUrl?: string;
	/** Where Leave goes. */
	homeUrl: string;
	/** The sim the shipped presets are for. */
	sim?: SimId;
	/** Binds files in `static/binds/`. The first is the one a first visit opens with. */
	presets?: PresetConfig[];
	/** The mark and wordmark in the top bar. */
	brand?: BrandConfig;
	/** CSS variable overrides, by the theme package's own names (`--color-trail`). */
	theme?: Record<`--${string}`, string>;
	/** A small "Powered by Orbital Preflight" link. On unless set to `false`. */
	poweredBy?: boolean;
	/** Google Analytics and Umami. Off unless an ID is set. */
	analytics?: AnalyticsConfig;
}

export interface AnalyticsConfig {
	/**
	 * A Google Analytics 4 measurement ID (`G-XXXXXXXXXX`). Sets a cookie, so it is held
	 * behind a consent banner and nothing is sent to Google until a visitor allows it.
	 */
	googleMeasurementId?: string;
	/** An Umami website ID (the UUID the Umami dashboard shows). Cookieless, no banner. */
	umamiWebsiteId?: string;
	/** Where the Umami script is served from: scheme and host only. Default `https://cloud.umami.is`. */
	umamiHost?: string;
}

export interface PresetConfig {
	/** The file name inside `static/binds/`, e.g. `hotas.binds`. */
	file: string;
	/** What visitors see, e.g. "My HOTAS setup". */
	label: string;
}

export interface BrandConfig {
	/** The wordmark text. Default "Preflight". */
	wordmark?: string;
	/**
	 * An inline SVG for the mark, drawn at 28px. Defaults to the Orbital Controls mark;
	 * set `false` for the wordmark alone.
	 */
	mark?: string | false;
	/** A heavier SVG for small sizes (the favicon). Falls back to `mark`. */
	markSmall?: string | false;
	/** Accessible name for the mark and wordmark together. Defaults to `siteName`. */
	label?: string;
}

/** Typed helper for the config file. */
export function defineConfig(config: OrbitalPreflightConfig): OrbitalPreflightConfig {
	return config;
}

export interface ResolvedPreset extends PresetConfig {
	/** The path under the base, e.g. `binds/hotas.binds`. Resolve with `asset()`. */
	path: string;
}

export interface ResolvedConfig {
	title: string;
	description: string;
	siteName: string;
	siteUrl: string | null;
	homeUrl: string;
	sim: SimId;
	presets: ResolvedPreset[];
	brand: { wordmark: string; label: string; mark?: string; markSmall?: string };
	theme: [string, string][];
	poweredBy: boolean;
	analytics: ResolvedAnalytics;
}

export interface ResolvedAnalytics {
	/** The GA4 measurement ID, or null for no Google tag. */
	google: string | null;
	/** The Umami website ID and the origin its script comes from, or null for no Umami. */
	umami: { websiteId: string; host: string } | null;
}

const VARIABLE = /^--[a-z0-9-]+$/i;
// Values end up inside a <style> element. Refuse anything that could close it or open
// a new rule, so a typo can't break the page.
const UNSAFE_VALUE = /[<>{};]/;

/** Fills in defaults and checks the fields a typo would quietly break. */
export function resolveConfig(config: OrbitalPreflightConfig): ResolvedConfig {
	const presets = (config.presets ?? []).map((preset) => {
		if (!preset.file || preset.file.includes('/') || preset.file.includes('..')) {
			throw new Error(
				`orbital-preflight.config.ts: preset file "${preset.file}" must be a file name inside static/binds/`
			);
		}
		return { ...preset, path: `binds/${preset.file}` };
	});

	const theme = Object.entries(config.theme ?? {}).map(([name, value]): [string, string] => {
		if (!VARIABLE.test(name) || UNSAFE_VALUE.test(value)) {
			throw new Error(
				`orbital-preflight.config.ts: theme override "${name}: ${value}" is not valid`
			);
		}
		return [name, value];
	});

	return {
		title: config.title,
		description: config.description,
		siteName: config.siteName,
		siteUrl: config.siteUrl ? config.siteUrl.replace(/\/$/, '') : null,
		homeUrl: config.homeUrl,
		sim: config.sim ?? 'elite-dangerous',
		presets,
		brand: resolveBrand(config),
		theme,
		poweredBy: config.poweredBy !== false,
		analytics: resolveAnalytics(config.analytics ?? {})
	};
}

// The IDs end up inside a <script> and its attributes, where escaping means nothing, so
// they are checked against their real shapes and refused otherwise.
const TAG_ID = /^(G|GT|AW)-[A-Z0-9]+$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORIGIN = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i;
const UMAMI_CLOUD = 'https://cloud.umami.is';

function resolveAnalytics(analytics: AnalyticsConfig): ResolvedAnalytics {
	const google = analytics.googleMeasurementId?.trim() || null;
	if (google && !TAG_ID.test(google)) {
		throw new Error(
			`orbital-preflight.config.ts: analytics.googleMeasurementId "${google}" is not a measurement ID (G-XXXXXXXXXX)`
		);
	}

	const websiteId = analytics.umamiWebsiteId?.trim() || null;
	if (websiteId && !UUID.test(websiteId)) {
		throw new Error(
			`orbital-preflight.config.ts: analytics.umamiWebsiteId "${websiteId}" is not the UUID Umami shows for the site`
		);
	}
	const host = analytics.umamiHost?.trim().replace(/\/+$/, '') || UMAMI_CLOUD;
	if (!ORIGIN.test(host)) {
		throw new Error(
			`orbital-preflight.config.ts: analytics.umamiHost "${host}" must be an https origin with no path, e.g. https://umami.example.com`
		);
	}

	return { google, umami: websiteId ? { websiteId, host } : null };
}

function resolveBrand(config: OrbitalPreflightConfig): ResolvedConfig['brand'] {
	const brand = config.brand ?? {};
	const mark = brand.mark === false ? undefined : (brand.mark ?? MARK);
	// The small mark follows the main one: a fork's own mark, or none, never ours.
	const small =
		brand.markSmall === false
			? undefined
			: (brand.markSmall ?? (brand.mark === undefined ? MARK_SMALL : mark));
	return {
		wordmark: brand.wordmark ?? 'Preflight',
		label: brand.label ?? pageName(config.siteName),
		mark,
		markSmall: small
	};
}

/** "CMDR Vex Preflight", without doubling a name that already ends in Preflight. */
export function pageName(siteName: string): string {
	return /\bpreflight$/i.test(siteName.trim()) ? siteName.trim() : `${siteName.trim()} Preflight`;
}

/** The theme overrides as one `:root` rule, applied after the theme package import. */
export function themeCss(theme: ResolvedConfig['theme']): string {
	if (!theme.length) return '';
	return `:root{${theme.map(([name, value]) => `${name}:${value}`).join(';')}}`;
}
