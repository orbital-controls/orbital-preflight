import type { SimId } from './types.ts';

/**
 * The one file a fork edits: `orbital-preflight.config.ts` at the repo root. Every field
 * is documented in the README.
 */
export interface PreflightConfig {
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
}

export interface PresetConfig {
	/** The file name inside `static/binds/`, e.g. `hotas.binds`. */
	file: string;
	/** What visitors see, e.g. "My HOTAS setup". */
	label: string;
}

export interface BrandConfig {
	/** The wordmark text. */
	wordmark?: string;
	/** An inline SVG for the mark, drawn at 28px. Leave out for the wordmark alone. */
	mark?: string;
	/** A heavier SVG for small sizes (the favicon). Falls back to `mark`. */
	markSmall?: string;
	/** Accessible name for the mark and wordmark together. Defaults to `siteName`. */
	label?: string;
}

/** Typed helper for the config file. */
export function defineConfig(config: PreflightConfig): PreflightConfig {
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
	brand: Required<Pick<BrandConfig, 'wordmark' | 'label'>> & Pick<BrandConfig, 'mark' | 'markSmall'>;
	theme: [string, string][];
	poweredBy: boolean;
}

const VARIABLE = /^--[a-z0-9-]+$/i;
// Values end up inside a <style> element. Refuse anything that could close it or open
// a new rule, so a typo can't break the page.
const UNSAFE_VALUE = /[<>{};]/;

/** Fills in defaults and checks the fields a typo would quietly break. */
export function resolveConfig(config: PreflightConfig): ResolvedConfig {
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
			throw new Error(`orbital-preflight.config.ts: theme override "${name}: ${value}" is not valid`);
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
		brand: {
			wordmark: config.brand?.wordmark ?? 'Orbital Preflight',
			label: config.brand?.label ?? config.siteName,
			mark: config.brand?.mark,
			markSmall: config.brand?.markSmall ?? config.brand?.mark
		},
		theme,
		poweredBy: config.poweredBy !== false
	};
}

/** The theme overrides as one `:root` rule, applied after the theme package import. */
export function themeCss(theme: ResolvedConfig['theme']): string {
	if (!theme.length) return '';
	return `:root{${theme.map(([name, value]) => `${name}:${value}`).join(';')}}`;
}
