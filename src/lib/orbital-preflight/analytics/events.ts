import * as ga from './gtag.ts';
import * as umami from './umami.ts';

/**
 * What the app reports, without naming who it reports to. The adapters beside this are
 * the only files that know a provider, and each is a no-op when its tag isn't in the
 * page: a fork with no IDs, `pnpm dev`, a Google tag the visitor declined.
 *
 * Nothing here carries the visitor's binds, file names or anything about them: only
 * what kind of thing happened.
 */

type EventData = Record<string, string | number | boolean>;

function report(name: string, data: EventData): void {
	if (ga.tagPresent()) ga.trackEvent(name, data);
	if (umami.scriptPresent()) umami.event(name, data);
}

/** Both tags are told not to count views themselves; every one is sent from here. */
export function reportPageView(location: string, title: string): void {
	if (ga.tagPresent()) ga.trackPageView(location, title);
	if (umami.scriptPresent()) umami.pageView(location, title);
}

/** A binds file opened: one of the pilot's presets, or the visitor's own. */
export function reportBindsLoad(source: 'preset' | 'upload', sim: string): void {
	report('binds_load', { source, sim });
}

/** A rebound preset downloaded, with how many binds it changes. */
export function reportBindsExport(sim: string, changes: number): void {
	report('binds_export', { sim, changes });
}
