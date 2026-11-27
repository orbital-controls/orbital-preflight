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
	/**
	 * The sim the shipped presets are for, unless a preset names its own. Default
	 * `elite-dangerous`.
	 */
	sim?: SimId;
	/**
	 * Binds files in `static/binds/`. With presets for one sim, a first visit opens the
	 * first of them; with presets for several, it shows the bay with the pilot's preset on
	 * each of those games.
	 */
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
	/** The sim the file is for. Defaults to the config's `sim`. */
	sim?: SimId;
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
	sim: SimId;
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
}

const VARIABLE = /^--[a-z0-9-]+$/i;
// Values end up inside a <style> element. Refuse anything that could close it or open
// a new rule, so a typo can't break the page.
const UNSAFE_VALUE = /[<>{};]/;

/** Fills in defaults and checks the fields a typo would quietly break. */
export function resolveConfig(config: OrbitalPreflightConfig): ResolvedConfig {
	const sim = config.sim ?? 'elite-dangerous';
	const presets = (config.presets ?? []).map((preset): ResolvedPreset => {
		if (!preset.file || preset.file.includes('/') || preset.file.includes('..')) {
			throw new Error(
				`orbital-preflight.config.ts: preset file "${preset.file}" must be a file name inside static/binds/`
			);
		}
		return { ...preset, sim: preset.sim ?? sim, path: `binds/${preset.file}` };
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
		sim,
		presets,
		brand: resolveBrand(config),
		theme,
		poweredBy: config.poweredBy !== false
	};
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

/** Where a first visit lands. */
export type FirstVisit = { kind: 'preset'; index: number } | { kind: 'bay' };

/**
 * The first visit opens straight into a game only when it is the one game with binds to
 * fly: presets for it, and no other game with presets or binds of its own (`withDefaults`,
 * the sims that open on their game's defaults, Star Citizen today). Otherwise the bay.
 */
export function firstVisit(
	presets: readonly ResolvedPreset[],
	withDefaults: readonly SimId[] = []
): FirstVisit {
	const sims = new Set([...presets.map((p) => p.sim), ...withDefaults]);
	if (presets.length && sims.size === 1) return { kind: 'preset', index: 0 };
	return { kind: 'bay' };
}

/** The first pilot's preset for a sim, or -1. */
export function presetFor(presets: readonly ResolvedPreset[], sim: SimId): number {
	return presets.findIndex((p) => p.sim === sim);
}
